#[macro_use]
extern crate lazy_static;
use clap::{App, Arg};
use futures::task::LocalSpawn;
use rusqlite::Connection;
use std::net::SocketAddr;
use std::process::exit;
mod connect;
mod derive_state;
mod init_inventory;
mod inventory;
mod log;
mod message_hash;
mod mpmc_manual_reset_event;
mod private_box;
mod proof_of_work;
mod reconcile_client;
mod reconcile_server;
mod stdio_ipc;
mod reconcile_capnp {
    include!(concat!(env!("OUT_DIR"), "/capnp/reconcile_capnp.rs"));
}
mod message_capnp {
    include!(concat!(env!("OUT_DIR"), "/capnp/message_capnp.rs"));
}
use async_std::prelude::*;
use async_std::sync::{channel, RwLock};
use stdio_ipc::{format_struct, Message};

fn main() {
    if let Err(()) = sodiumoxide::init() {
        log::fatal("sodiumoxide initialization failed");
        exit(1);
    }
    let matches = App::new("Parlance")
        .version("alpha")
        .author("Huỳnh Trần Khanh")
        .arg(
            Arg::with_name("database")
                .short("f")
                .long("database")
                .value_name("FILE")
                .help("Sets the SQLite database file")
                .takes_value(true)
                .required(true),
        )
        .arg(
            Arg::with_name("address")
                .short("l")
                .long("address")
                .value_name("ADDRESS")
                .help("Sets the TCP listen address")
                .takes_value(true)
                .required(true),
        )
        .arg(
            Arg::with_name("reverse client address")
                .short("r")
                .long("reverse-address")
                .value_name("REVERSE_ADDRESS")
                .help("Sets the reverse reconciliation client address")
                .takes_value(true),
        )
        .get_matches();

    let database_path = matches.value_of("database").unwrap().to_owned();
    let address = matches.value_of("address").unwrap().to_owned();

    let parsed_address = match address.parse::<SocketAddr>() {
        Ok(address) => address,
        Err(_) => {
            log::fatal("TCP listen address is invalid");
            exit(1);
        }
    };

    let reverse_address = match matches.value_of("reverse client address") {
        Some(value) => Some(value.to_owned()),
        None => None,
    };

    let parsed_reverse_address = match reverse_address.to_owned() {
        Some(address) => match address.parse::<SocketAddr>() {
            Ok(address) => Some(address),
            Err(_) => {
                log::fatal("Reverse reconciliation client address is invalid");
                exit(1);
            }
        },
        None => None,
    };

    log::welcome("Standard streams are being used for interprocess communication");
    log::notice(format!(
        "Listening for incoming client connections on {}",
        address
    ));

    if let Some(address) = reverse_address.to_owned() {
        log::notice(format!(
            "Listening for incoming reverse server connections on {}",
            address
        ));
    }

    let mut exec = futures::executor::LocalPool::new();
    let spawner = exec.spawner();

    let (in_memory_tx, in_memory_rx) = channel(1);
    let (on_disk_tx, on_disk_rx) = channel(1);
    let (mutate_tx, mutate_rx) = channel(1);

    async_std::task::spawn(async move { while let Some(_) = mutate_rx.recv().await {} });

    std::thread::spawn(move || {
        let connection = match Connection::open(database_path) {
            Ok(connection) => connection,
            Err(_) => {
                log::fatal("Unable to open database file");
                exit(1);
            }
        };

        init_inventory::init_inventory(connection, mutate_tx, in_memory_rx, on_disk_rx);
    });

    let spawner_clone = spawner.clone();

    let reconciliation_intent = std::rc::Rc::new(RwLock::new(
        mpmc_manual_reset_event::MPMCManualResetEvent::new(),
    ));

    let reconciliation_intent_clone = reconciliation_intent.clone();
    {
        let in_memory_tx = in_memory_tx.clone();
        let on_disk_tx = on_disk_tx.clone();
        spawner
            .spawn_local_obj(
                Box::new(async move {
                    let listener = match async_std::net::TcpListener::bind(&parsed_address).await {
                        Ok(listener) => listener,
                        Err(error) => {
                            log::fatal(format!(
                                "Failed to bind to {} due to error {:?}",
                                address, error
                            ));
                            exit(1);
                        }
                    };
                    let mut incoming = listener.incoming();
                    log::ipc(format_struct(&Message::ServerListenAddress {
                        address: &listener.local_addr().unwrap().to_string(),
                    }));
                    let spawner_clone2 = spawner_clone.clone();
                    while let Some(socket) = incoming.next().await {
                        match socket {
                            Ok(socket) => {
                                let in_memory_tx = in_memory_tx.clone();
                                let on_disk_tx = on_disk_tx.clone();
                                let reconciliation_intent_clone =
                                    reconciliation_intent_clone.clone();
                                spawner_clone2
                                    .spawn_local_obj(
                                        Box::new(async move {
                                            if let Err(error) = reconcile_server::init_server(
                                                socket,
                                                in_memory_tx,
                                                on_disk_tx,
                                                reconciliation_intent_clone.clone(),
                                            )
                                            .await
                                            {
                                                log::warning(format!(
                                                    "Error occurred while reconciling: {:?}",
                                                    error
                                                ));
                                            }
                                        })
                                        .into(),
                                    )
                                    .unwrap();
                            }
                            Err(error) => {
                                log::warning(format!(
                                    "Unexpected error while accepting incoming socket: {:?}",
                                    error
                                ));
                            }
                        }
                    }
                })
                .into(),
            )
            .unwrap();
    }
    let spawner_clone = spawner.clone();
    let reconciliation_intent_clone = reconciliation_intent.clone();
    if let Some(address) = parsed_reverse_address {
        let in_memory_tx = in_memory_tx.clone();
        let on_disk_tx = on_disk_tx.clone();
        spawner
            .spawn_local_obj(
                Box::new(async move {
                    let listener = match async_std::net::TcpListener::bind(&address).await {
                        Ok(listener) => listener,
                        Err(error) => {
                            log::fatal(format!(
                                "Failed to bind to {} due to error {:?}",
                                reverse_address.unwrap(),
                                error
                            ));
                            exit(1);
                        }
                    };
                    let mut incoming = listener.incoming();
                    log::ipc(format_struct(&Message::ClientListenAddress {
                        address: &listener.local_addr().unwrap().to_string(),
                    }));
                    let spawner_clone2 = spawner_clone.clone();
                    while let Some(socket) = incoming.next().await {
                        match socket {
                            Ok(socket) => {
                                let spawner_clone3 = spawner_clone2.clone();
                                let reconciliation_intent = reconciliation_intent_clone.clone();
                                let in_memory_tx = in_memory_tx.clone();
                                let on_disk_tx = on_disk_tx.clone();
                                spawner_clone2
                                    .spawn_local_obj(
                                        Box::new(async move {
                                            if let Err(error) = reconcile_client::reconcile(
                                                socket,
                                                &in_memory_tx,
                                                &on_disk_tx,
                                                spawner_clone3.clone(),
                                                reconciliation_intent.clone(),
                                            )
                                            .await
                                            {
                                                log::warning(format!(
                                                    "Error occurred while reconciling: {:?}",
                                                    error
                                                ));
                                            }
                                        })
                                        .into(),
                                    )
                                    .unwrap();
                            }
                            Err(error) => {
                                log::warning(format!(
                                    "Unexpected error while accepting incoming socket: {:?}",
                                    error
                                ));
                            }
                        }
                    }
                })
                .into(),
            )
            .unwrap();
    }

    let spawner_clone = spawner.clone();
    spawner
        .spawn_local_obj(
            Box::new(async move {
                stdio_ipc::communicate(
                    reconciliation_intent,
                    in_memory_tx,
                    on_disk_tx,
                    spawner_clone,
                )
                .await;
            })
            .into(),
        )
        .unwrap();
    exec.run();
}
