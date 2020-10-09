use crate::inventory::{in_memory, on_disk, populate, purge_expired, InMemory, Mutation, OnDisk};
use crate::mockable_date_and_time::Clock;
use async_std::sync::{Mutex, Receiver, RwLock, Sender};
use async_std::task;
use futures::task::LocalSpawn;
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

/// This function blocks the thread it runs on.
pub fn init_inventory(
    connection: Connection,
    mutate_tx: Sender<Mutation>,
    in_memory_rx: Receiver<InMemory>,
    on_disk_rx: Receiver<OnDisk>,
    clock: Arc<impl Clock + Send + Sync + 'static>,
) {
    let connection = Arc::new(connection);
    connection
        .execute(
            include_str!("../sql/A. Schema/Initial schema for backend.sql"),
            params![],
        )
        .unwrap();
    let mut exec = futures::executor::LocalPool::new();
    let spawner = exec.spawner();
    let map_counter_to_hash = Arc::new(RwLock::new(BTreeMap::<u128, Arc<Vec<u8>>>::new()));
    let map_expiration_time_to_hashes = Arc::new(RwLock::new(BTreeMap::<
        i64,
        RwLock<HashSet<Arc<Vec<u8>>>>,
    >::new()));
    let map_hash_to_counter = Arc::new(RwLock::new(HashMap::<Arc<Vec<u8>>, u128>::new()));
    let map_hash_to_expiration_time = Arc::new(RwLock::new(HashMap::<Arc<Vec<u8>>, i64>::new()));

    let counter = Arc::new(Mutex::new(0u128));

    {
        let map_counter_to_hash = map_counter_to_hash.clone();
        let map_expiration_time_to_hashes = map_expiration_time_to_hashes.clone();
        let map_hash_to_counter = map_hash_to_counter.clone();
        let map_hash_to_expiration_time = map_hash_to_expiration_time.clone();
        let connection = connection.clone();
        let mutate_tx = mutate_tx.clone();
        let counter = counter.clone();
        spawner
            .spawn_local_obj(
                Box::new(async move {
                    populate(
                        &map_counter_to_hash,
                        &map_expiration_time_to_hashes,
                        &map_hash_to_counter,
                        &map_hash_to_expiration_time,
                        &connection,
                        &mutate_tx,
                        &counter,
                    )
                    .await;
                })
                .into(),
            )
            .unwrap();
    }

    {
        let map_counter_to_hash = map_counter_to_hash.clone();
        let map_hash_to_counter = map_hash_to_counter.clone();
        let map_hash_to_expiration_time = map_hash_to_expiration_time.clone();
        let clock = clock.clone();
        task::spawn(async move {
            in_memory(
                in_memory_rx,
                &map_counter_to_hash,
                &map_hash_to_counter,
                &map_hash_to_expiration_time,
                clock.as_ref(),
            )
            .await;
        });
    }

    {
        let map_counter_to_hash = map_counter_to_hash.clone();
        let map_expiration_time_to_hashes = map_expiration_time_to_hashes.clone();
        let map_hash_to_counter = map_hash_to_counter.clone();
        let map_hash_to_expiration_time = map_hash_to_expiration_time.clone();
        let connection = connection.clone();
        {
            let mutate_tx = mutate_tx.clone();

            let clock = clock.clone();
            spawner
                .spawn_local_obj(
                    Box::new(async move {
                        loop {
                            purge_expired(
                                &map_counter_to_hash,
                                &map_expiration_time_to_hashes,
                                &map_hash_to_counter,
                                &map_hash_to_expiration_time,
                                &connection,
                                &mutate_tx,
                                clock.as_ref(),
                            )
                            .await;
                            clock.wait(1000u64).await;
                        }
                    })
                    .into(),
                )
                .unwrap();
        }
    }

    spawner
        .spawn_local_obj(
            Box::new(async move {
                on_disk(
                    on_disk_rx,
                    &counter,
                    &map_counter_to_hash,
                    &map_expiration_time_to_hashes,
                    &map_hash_to_counter,
                    &map_hash_to_expiration_time,
                    &connection,
                    &mutate_tx,
                    clock.as_ref(),
                )
                .await;
            })
            .into(),
        )
        .unwrap();

    exec.run();
}
