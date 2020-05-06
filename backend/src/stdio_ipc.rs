use crate::connect::{connect, reverse_connect};
use crate::derive_state::Command;
use crate::inventory::{get_message, get_one_after_counter, insert_message, InMemory, OnDisk};
use crate::log;
use crate::mpmc_manual_reset_event::MPMCManualResetEvent;
use crate::state_derive_ipc::attempt_parse;
use async_std::io;
use async_std::sync::{RwLock, Sender};
use futures::executor::LocalSpawner;
use futures::task::LocalSpawn;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::exit;
use std::rc::Rc;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

/// Using the same operation_id for two or more operations is undefined
/// behavior.
#[derive(Serialize, Deserialize, Debug)]
enum Operation {
    Submit {
        payload: Vec<u8>,
        expiration_time: i64,
        operation_id: String,
        associated_frontend_data: String,
    },
    Query {
        hash: Vec<u8>,
        operation_id: String,
    },
    CancelSubmitOperation {
        to_be_cancelled: String,
    },
    EstablishConnection {
        address: String,
        operation_id: String,
    },
    EstablishReverseConnection {
        address: String,
        operation_id: String,
    },
    DumpPendingProofOfWorkOperations,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProofOfWorkOperation {
    operation_id: String,
    associated_frontend_data: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Message<'a> {
    Inventory(Vec<Vec<u8>>),
    Message {
        in_reply_to: &'a str,
        message: Option<crate::inventory::Message>,
    },
    ProofOfWorkCancelled {
        in_reply_to: &'a str,
    },
    ProofOfWorkCompleted {
        in_reply_to: &'a str,
    },
    ConnectionEstablishmentFailure {
        in_reply_to: &'a str,
    },
    ReconcileFailure {
        in_reply_to: &'a str,
    },
    ConnectionSevered {
        in_reply_to: &'a str,
    },
    ServerListenAddress {
        address: &'a str,
    },
    ClientListenAddress {
        address: &'a str,
    },
    PendingProofOfWorkOperations(Vec<ProofOfWorkOperation>),
}

pub fn format_struct<T: Serialize>(value: &T) -> String {
    base64::encode(&serde_json::to_string(value).unwrap())
}

pub async fn communicate(
    reconciliation_intent: std::rc::Rc<RwLock<MPMCManualResetEvent>>,
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    command_tx: Option<Sender<Command>>,
    spawner: LocalSpawner,
    dump_inventory: bool,
) {
    let atomic_cancel_flags: Rc<RwLock<HashMap<String, Arc<AtomicBool>>>> =
        Rc::new(RwLock::new(HashMap::new()));

    let associated_frontend_data_map: Rc<RwLock<HashMap<String, String>>> =
        Rc::new(RwLock::new(HashMap::new()));

    if dump_inventory {
        let reconciliation_intent = reconciliation_intent.clone();
        let in_memory_tx = in_memory_tx.clone();
        spawner
            .spawn_local_obj(
                Box::new(async move {
                    let handle = reconciliation_intent.write().await.get_handle();
                    loop {
                        let mut hashes = Vec::new();
                        let mut counter = 0u128;
                        while let Some((hash, new_counter)) =
                            get_one_after_counter(&in_memory_tx, counter).await
                        {
                            counter = new_counter;
                            hashes.push((&hash as &Vec<u8>).to_owned());
                        }
                        log::ipc(format_struct(&Message::Inventory(hashes)));
                        let event = reconciliation_intent.read().await.get_event(handle);
                        event.wait().await;
                        event.reset();
                    }
                })
                .into(),
            )
            .unwrap();
    }
    loop {
        let mut line = String::new();
        match io::stdin().read_line(&mut line).await {
            Ok(_) => {
                if let Some(command_tx) = &command_tx {
                    if attempt_parse(&command_tx, &line).await {
                        continue;
                    }
                }
                let operation_result =
                    serde_json::from_slice::<Operation>(&match base64::decode(&line.trim()) {
                        Ok(value) => value,
                        Err(_) => {
                            log::fatal(format!(
                                "Received RPC command can't be parsed. Offending command: {}",
                                line.trim()
                            ));
                            exit(1);
                        }
                    });
                let operation = match operation_result {
                    Ok(operation) => operation,
                    Err(_) => {
                        log::fatal(format!(
                            "Received RPC command can't be parsed. Offending command: {}",
                            line.trim()
                        ));
                        exit(1);
                    }
                };
                match operation {
                    Operation::Submit {
                        payload,
                        expiration_time,
                        operation_id,
                        associated_frontend_data,
                    } => {
                        log::notice(
                            "A task has been spawned to calculate the proof of work. Hang tight.",
                        );
                        associated_frontend_data_map
                            .write()
                            .await
                            .insert(operation_id.clone(), associated_frontend_data);
                        let atomic_cancel_flags = atomic_cancel_flags.clone();
                        let reconciliation_intent = reconciliation_intent.clone();
                        let on_disk_tx = on_disk_tx.clone();
                        let associated_frontend_data_map = associated_frontend_data_map.clone();
                        spawner.spawn_local_obj(
                                Box::new(async move {
                                    use crate::proof_of_work::{get_expected_target2, prove};
                                    let target = get_expected_target2(&payload, expiration_time);
                                    let cancelled = Arc::new(AtomicBool::new(false));
                                    let cancelled2 = cancelled.clone();
                                    atomic_cancel_flags
                                        .write()
                                        .await
                                        .insert(operation_id.to_owned(), cancelled);
                                    let nonce = prove(
                                        &payload,
                                        match target {
                                            Some(target) => target,
                                            None => {
                                                log::fatal(format!(
                                                    "Expiration time is in the past. Offending command: {}",
                                                    line.trim()
                                                ));
                                                atomic_cancel_flags
                                                    .write()
                                                    .await
                                                    .remove(&operation_id);
                                                exit(1);
                                            }
                                        },
                                        cancelled2,
                                    )
                                    .await;
                                    let nonce = match nonce {
                                        Some(nonce) => nonce,
                                        None => {
                                            log::ipc(format_struct(
                                                &Message::ProofOfWorkCancelled {
                                                    in_reply_to: &operation_id,
                                                },
                                            ));
                                            atomic_cancel_flags
                                                .write()
                                                .await
                                                .remove(&operation_id);
                                            associated_frontend_data_map.write().await.remove(&operation_id);
                                            log::notice("Proof of work cancelled");
                                            return;
                                        }
                                    };
                                    insert_message(&on_disk_tx, crate::inventory::Message { payload, nonce, expiration_time }).await;
                                    reconciliation_intent.read().await.broadcast();
                                    log::ipc(format_struct(&Message::ProofOfWorkCompleted {
                                        in_reply_to: &operation_id,
                                    }));
                                    atomic_cancel_flags
                                        .write()
                                        .await
                                        .remove(&operation_id);
                                    associated_frontend_data_map.write().await.remove(&operation_id);
                                    log::notice("Message submitted successfully");
                                })
                                .into(),
                            ).unwrap();
                    }
                    Operation::Query { hash, operation_id } => {
                        let on_disk_tx = on_disk_tx.clone();
                        spawner
                            .spawn_local_obj(
                                Box::new(async move {
                                    log::ipc(format_struct(&Message::Message {
                                        in_reply_to: &operation_id,
                                        message: get_message(&on_disk_tx, Arc::new(hash)).await,
                                    }));
                                })
                                .into(),
                            )
                            .unwrap();
                    }
                    Operation::CancelSubmitOperation { to_be_cancelled } => {
                        let locked = atomic_cancel_flags.read().await;
                        let flag = match locked.get(&to_be_cancelled) {
                            Some(flag) => flag,
                            None => {
                                log::warning(format!(
                                    "Submit operation doesn't exist. Offending command: {}",
                                    line.trim()
                                ));
                                continue;
                            }
                        };
                        flag.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                    Operation::EstablishConnection {
                        address,
                        operation_id,
                    } => {
                        let operation_id1 = std::rc::Rc::new(operation_id);
                        let operation_id2 = operation_id1.clone();
                        let operation_id3 = operation_id1.clone();
                        let socket_address1 = std::rc::Rc::new(address.clone());
                        let socket_address2 = socket_address1.clone();
                        let socket_address3 = socket_address1.clone();
                        connect(
                            address,
                            in_memory_tx.clone(),
                            on_disk_tx.clone(),
                            spawner.clone(),
                            reconciliation_intent.clone(),
                            move |error| {
                                log::warning(format!(
                                    "Can't connect to {} due to error {:?}",
                                    socket_address1, error
                                ));
                                log::ipc(format_struct(&Message::ConnectionEstablishmentFailure {
                                    in_reply_to: &operation_id1,
                                }));
                            },
                            move |error| {
                                log::warning(format!(
                                    "Error occurred while reconciling with {} due to error {:?}",
                                    socket_address2, error
                                ));
                                log::ipc(format_struct(&Message::ReconcileFailure {
                                    in_reply_to: &operation_id2,
                                }));
                            },
                            move || {
                                log::warning(format!("Connection to {} severed", socket_address3));
                                log::ipc(format_struct(&Message::ConnectionSevered {
                                    in_reply_to: &operation_id3,
                                }));
                            },
                        );
                    }
                    Operation::EstablishReverseConnection {
                        address,
                        operation_id,
                    } => {
                        let operation_id1 = std::rc::Rc::new(operation_id);
                        let operation_id2 = operation_id1.clone();
                        let operation_id3 = operation_id1.clone();
                        let socket_address1 = std::rc::Rc::new(address.clone());
                        let socket_address2 = socket_address1.clone();
                        let socket_address3 = socket_address1.clone();
                        reverse_connect(
                            address,
                            in_memory_tx.clone(),
                            on_disk_tx.clone(),
                            spawner.clone(),
                            reconciliation_intent.clone(),
                            move |error| {
                                log::warning(format!(
                                    "Can't connect to {} due to error {:?}",
                                    socket_address1, error
                                ));
                                log::ipc(format_struct(&Message::ConnectionEstablishmentFailure {
                                    in_reply_to: &operation_id1,
                                }));
                            },
                            move |error| {
                                log::warning(format!(
                                    "Error occurred while reconciling with {} due to error {:?}",
                                    socket_address2, error
                                ));
                                log::ipc(format_struct(&Message::ReconcileFailure {
                                    in_reply_to: &operation_id2,
                                }));
                            },
                            move || {
                                log::warning(format!("Connection to {} severed", socket_address3));
                                log::ipc(format_struct(&Message::ConnectionSevered {
                                    in_reply_to: &operation_id3,
                                }));
                            },
                        );
                    }
                    Operation::DumpPendingProofOfWorkOperations => {
                        let mut dump = Vec::new();
                        for (operation_id, associated_frontend_data) in
                            associated_frontend_data_map.read().await.iter()
                        {
                            dump.push(ProofOfWorkOperation {
                                operation_id: operation_id.to_string(),
                                associated_frontend_data: associated_frontend_data.to_string(),
                            })
                        }
                        log::ipc(format_struct(&Message::PendingProofOfWorkOperations(dump)));
                    }
                }
            }
            Err(error) => {
                log::warning(format!("Unexpected STDIN error: {:?}", error));
            }
        }
    }
}
