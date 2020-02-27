use crate::message_hash::message_hash;
use async_std::sync::{channel, Receiver, RwLock, Sender};
use chrono::Utc;
use futures_intrusive::sync::ManualResetEvent;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub payload: Vec<u8>,
    pub nonce: i64,
    pub expiration_time: i64,
}

pub enum InMemory {
    GetAllAfterCounter(u128, Sender<Arc<Vec<u8>>>, Sender<u128>),
    MessageExists(Arc<Vec<u8>>, Sender<bool>),
    GetExpirationTime(Arc<Vec<u8>>, Sender<Option<i64>>),
}

pub enum OnDisk {
    GetMessage(Arc<Vec<u8>>, Sender<Option<Message>>),
    InsertMessage(Message, Arc<ManualResetEvent>),
}

pub enum Mutation {
    Insert(Arc<Vec<u8>>),
    Purge(Arc<Vec<u8>>),
}

pub async fn get_all_after_counter(
    tx: &Sender<InMemory>,
    counter: u128,
) -> (Receiver<Arc<Vec<u8>>>, Receiver<u128>) {
    let (tx1, rx1) = channel(1);
    let (tx2, rx2) = channel(1);
    tx.send(InMemory::GetAllAfterCounter(counter, tx1, tx2))
        .await;
    (rx1, rx2)
}

pub async fn message_exists(tx: &Sender<InMemory>, hash: Arc<Vec<u8>>) -> bool {
    let (tx1, rx1) = channel(1);
    tx.send(InMemory::MessageExists(hash, tx1)).await;
    rx1.recv().await.unwrap()
}

pub async fn get_expiration_time(tx: &Sender<InMemory>, hash: Arc<Vec<u8>>) -> Option<i64> {
    let (tx1, rx1) = channel(1);
    tx.send(InMemory::GetExpirationTime(hash, tx1)).await;
    rx1.recv().await.unwrap()
}

pub async fn get_message(tx: &Sender<OnDisk>, hash: Arc<Vec<u8>>) -> Option<Message> {
    let (tx1, rx1) = channel(1);
    tx.send(OnDisk::GetMessage(hash, tx1)).await;
    rx1.recv().await.unwrap()
}

pub async fn insert_message(tx: &Sender<OnDisk>, message: Message) {
    let event = Arc::new(ManualResetEvent::new(false));
    tx.send(OnDisk::InsertMessage(message, event.clone())).await;
    event.wait().await;
}

pub async fn in_memory(
    rx: Receiver<InMemory>,
    map_counter_to_hash: &RwLock<BTreeMap<u128, Arc<Vec<u8>>>>,
    map_hash_to_counter: &RwLock<HashMap<Arc<Vec<u8>>, u128>>,
    map_hash_to_expiration_time: &RwLock<HashMap<Arc<Vec<u8>>, i64>>,
) {
    while let Some(command) = rx.recv().await {
        match command {
            InMemory::GetAllAfterCounter(counter, tx, final_counter_tx) => {
                let acquired = map_counter_to_hash.read().await;
                let mut final_counter = counter;
                let now = Utc::now().timestamp();
                use std::ops::Bound::{Excluded, Unbounded};
                for (&counter, hash) in acquired.range((Excluded(counter), Unbounded)) {
                    match map_hash_to_expiration_time.read().await.get(&hash.clone()) {
                        None => continue,
                        Some(expiration_time) => {
                            if expiration_time <= &now {
                                continue;
                            }
                        }
                    }
                    tx.send(hash.clone()).await;
                    final_counter = counter;
                }
                final_counter_tx.send(final_counter).await;
            }
            InMemory::MessageExists(hash, tx) => {
                let now = Utc::now().timestamp();
                match map_hash_to_expiration_time.read().await.get(&hash.clone()) {
                    None => {
                        tx.send(false).await;
                        continue;
                    }
                    Some(expiration_time) => {
                        if expiration_time <= &now {
                            tx.send(false).await;
                            continue;
                        }
                    }
                }
                tx.send(map_hash_to_counter.read().await.contains_key(&hash))
                    .await;
            }
            InMemory::GetExpirationTime(hash, tx) => {
                tx.send(match map_hash_to_expiration_time.read().await.get(&hash) {
                    Some(it) => Some(*it),
                    None => None,
                })
                .await;
            }
        }
    }
}

async fn add_hash(
    hash: Arc<Vec<u8>>,
    counter: u128,
    expiration_time: i64,
    map_counter_to_hash: &RwLock<BTreeMap<u128, Arc<Vec<u8>>>>,
    map_expiration_time_to_hashes: &RwLock<BTreeMap<i64, RwLock<HashSet<Arc<Vec<u8>>>>>>,
    map_hash_to_counter: &RwLock<HashMap<Arc<Vec<u8>>, u128>>,
    map_hash_to_expiration_time: &RwLock<HashMap<Arc<Vec<u8>>, i64>>,
) {
    map_counter_to_hash
        .write()
        .await
        .insert(counter, hash.clone());
    map_expiration_time_to_hashes
        .write()
        .await
        .entry(expiration_time)
        .or_insert(RwLock::new(HashSet::new()))
        .write()
        .await
        .insert(hash.clone());
    map_hash_to_counter
        .write()
        .await
        .insert(hash.clone(), counter);
    map_hash_to_expiration_time
        .write()
        .await
        .insert(hash.clone(), expiration_time);
}

pub async fn populate(
    map_counter_to_hash: &RwLock<BTreeMap<u128, Arc<Vec<u8>>>>,
    map_expiration_time_to_hashes: &RwLock<BTreeMap<i64, RwLock<HashSet<Arc<Vec<u8>>>>>>,
    map_hash_to_counter: &RwLock<HashMap<Arc<Vec<u8>>, u128>>,
    map_hash_to_expiration_time: &RwLock<HashMap<Arc<Vec<u8>>, i64>>,
    connection: &Connection,
    mutate_tx: &Sender<Mutation>,
) -> u128 {
    let mut counter: u128 = 0;
    let mut statement = connection
        .prepare(include_str!("../sql/B. RPC/Retrieve messages.sql"))
        .unwrap();
    let mut rows = statement.query(params![]).unwrap();
    while let Some(row) = rows.next().unwrap() {
        counter += 1;
        let hash: Vec<u8> = row.get(0).unwrap();
        let hash = Arc::new(hash);
        let expiration_time: i64 = row.get(3).unwrap();
        add_hash(
            hash.clone(),
            counter,
            expiration_time,
            &map_counter_to_hash,
            &map_expiration_time_to_hashes,
            &map_hash_to_counter,
            &map_hash_to_expiration_time,
        )
        .await;
        mutate_tx.send(Mutation::Insert(hash.clone())).await;
    }
    counter
}

pub async fn purge_expired(
    map_counter_to_hash: &RwLock<BTreeMap<u128, Arc<Vec<u8>>>>,
    map_expiration_time_to_hashes: &RwLock<BTreeMap<i64, RwLock<HashSet<Arc<Vec<u8>>>>>>,
    map_hash_to_counter: &RwLock<HashMap<Arc<Vec<u8>>, u128>>,
    map_hash_to_expiration_time: &RwLock<HashMap<Arc<Vec<u8>>, i64>>,
    connection: &Connection,
    mutate_tx: &Sender<Mutation>,
) {
    let now = Utc::now().timestamp();
    for (_, hashes) in map_expiration_time_to_hashes.read().await.range(..=now) {
        for hash in hashes.read().await.iter() {
            let hash = hash.clone();
            match map_hash_to_counter.read().await.get(&hash) {
                None => continue,
                Some(counter) => {
                    map_counter_to_hash.write().await.remove(&counter);
                    hashes.write().await.remove(&hash);
                    map_hash_to_expiration_time.write().await.remove(&hash);
                    map_hash_to_counter.write().await.remove(&hash);
                    connection
                        .execute(
                            include_str!("../sql/B. RPC/Delete message.sql"),
                            params![&hash as &Vec<u8>],
                        )
                        .unwrap();
                    mutate_tx.send(Mutation::Purge(hash)).await;
                }
            }
        }
    }
}

/// This task is meant to be spawned. It executes blocking DB operations.
pub async fn on_disk(
    rx: Receiver<OnDisk>,
    initial_counter: u128,
    map_counter_to_hash: &RwLock<BTreeMap<u128, Arc<Vec<u8>>>>,
    map_expiration_time_to_hashes: &RwLock<BTreeMap<i64, RwLock<HashSet<Arc<Vec<u8>>>>>>,
    map_hash_to_counter: &RwLock<HashMap<Arc<Vec<u8>>, u128>>,
    map_hash_to_expiration_time: &RwLock<HashMap<Arc<Vec<u8>>, i64>>,
    connection: &Connection,
    mutate_tx: &Sender<Mutation>,
) {
    let mut counter = initial_counter;
    // It is better to execute SQLite operations sequentially. SQLite locks the database
    // during an operation, so there is nothing gained from spawning dedicated tasks for
    // each operation.
    while let Some(command) = rx.recv().await {
        match command {
            OnDisk::GetMessage(hash, tx) => {
                let now = Utc::now().timestamp();
                match map_hash_to_expiration_time.read().await.get(&hash.clone()) {
                    None => {
                        tx.send(None).await;
                        continue;
                    }
                    Some(expiration_time) => {
                        if expiration_time <= &now {
                            tx.send(None).await;
                            continue;
                        }
                    }
                }
                let mut statement = connection
                    .prepare(include_str!("../sql/B. RPC/Retrieve message.sql"))
                    .unwrap();
                let mut rows = statement.query(params![&hash as &Vec<u8>]).unwrap();
                match rows.next().unwrap() {
                    Some(row) => {
                        let payload: Vec<u8> = row.get(0).unwrap();
                        let nonce: i64 = row.get(1).unwrap();
                        let expiration_time: i64 = row.get(2).unwrap();
                        tx.send(Some(Message {
                            payload,
                            nonce,
                            expiration_time,
                        }))
                        .await;
                    }
                    None => tx.send(None).await,
                }
            }
            OnDisk::InsertMessage(
                Message {
                    payload,
                    nonce,
                    expiration_time,
                },
                event,
            ) => {
                counter += 1;
                let hash = Arc::new(message_hash(&payload, expiration_time).to_vec());
                add_hash(
                    hash.clone(),
                    counter,
                    expiration_time,
                    &map_counter_to_hash,
                    &map_expiration_time_to_hashes,
                    &map_hash_to_counter,
                    &map_hash_to_expiration_time,
                )
                .await;
                connection
                    .execute(
                        include_str!("../sql/B. RPC/Put message.sql"),
                        params![&hash as &Vec<u8>, payload, nonce, expiration_time],
                    )
                    .unwrap();
                mutate_tx.send(Mutation::Insert(hash)).await;
                event.set();
            }
        }
    }
}
