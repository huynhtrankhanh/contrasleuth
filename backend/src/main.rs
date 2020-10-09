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
mod state_derive_ipc;
mod stdio_ipc;
mod reconcile_capnp {
    include!(concat!(env!("OUT_DIR"), "/capnp/reconcile_capnp.rs"));
}
mod message_capnp {
    include!(concat!(env!("OUT_DIR"), "/capnp/message_capnp.rs"));
}
mod mockable_date_and_time;
use async_std::prelude::*;
use async_std::sync::{channel, RwLock};
use derive_state::derive;
use mockable_date_and_time::TrueTime;
use state_derive_ipc::state_derive_ipc;
use std::sync::Arc;
use stdio_ipc::{format_struct, Message};

fn main() {
    if let Err(()) = sodiumoxide::init() {
        log::fatal("sodiumoxide initialization failed");
        exit(1);
    }
    let matches = App::new("Contrasleuth")
        .version("alpha")
        .author("Huỳnh Trần Khanh")
        .arg(
            Arg::with_name("database")
                .short("f")
                .long("database")
                .value_name("FILE")
                .help("Sets the backend SQLite database file")
                .takes_value(true)
                .required(true),
        )
        .arg(
            Arg::with_name("frontend database")
                .short("g")
                .long("frontend-database")
                .value_name("FILE")
                .help("Sets the frontend SQLite database file")
                .takes_value(true)
                .required(false),
        )
        .arg(
            Arg::with_name("address")
                .short("l")
                .long("address")
                .value_name("ADDRESS")
                .help("Sets the TCP listen address")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("reverse client address")
                .short("r")
                .long("reverse-address")
                .value_name("ADDRESS")
                .help("Sets the reverse reconciliation client address")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("dump inventory")
                .long("dump-inventory")
                .help("Dumps inventory hashes when new messages get inserted")
                .takes_value(false),
        )
        .arg(
            Arg::with_name("unix socket")
                .long("unix-socket")
                .value_name("PATH")
                .help("Unix socket equivalent of the `address` parameter")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("reverse client unix socket")
                .long("reverse-unix-socket")
                .help("Unix socket equivalent of the `reverse-address` parameter")
                .takes_value(true),
        )
        .get_matches();

    if !cfg!(unix) {
        if matches.is_present("unix socket") || matches.is_present("reverse client unix socket") {
            log::fatal("Unix sockets are not available on your platform");
            exit(1);
        }
    }

    let database_path = matches.value_of("database").unwrap().to_owned();

    let frontend_database_path = match matches.value_of("frontend database") {
        Some(value) => Some(value.to_owned()),
        None => None,
    };

    let address = match matches.value_of("address") {
        Some(value) => Some(value.to_owned()),
        None => None,
    };

    let parsed_address = match address.to_owned() {
        Some(address) => match address.parse::<SocketAddr>() {
            Ok(address) => Some(address),
            Err(_) => {
                log::fatal("TCP listen address is invalid");
                exit(1);
            }
        },
        None => None,
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

    let unix_socket = match matches.value_of("unix socket") {
        Some(value) => Some(value.to_owned()),
        None => None,
    };

    let reverse_unix_socket = match matches.value_of("reverse client unix socket") {
        Some(value) => Some(value.to_owned()),
        None => None,
    };

    let dump_inventory = matches.is_present("dump inventory");

    log::welcome("Standard streams are being used for interprocess communication");

    if let Some(address) = address.to_owned() {
        log::notice(format!(
            "Listening for incoming client connections on {}",
            address
        ));
    }

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

    let command_tx = match frontend_database_path {
        Some(path) => {
            let in_memory_tx = in_memory_tx.clone();
            let on_disk_tx = on_disk_tx.clone();

            let (command_tx, command_rx) = channel(1);
            let (event_tx, event_rx) = channel(1);

            spawner
                .spawn_local_obj(
                    Box::new(async move {
                        state_derive_ipc(event_rx).await;
                    })
                    .into(),
                )
                .unwrap();

            std::thread::spawn(move || {
                let connection = match Connection::open(path) {
                    Ok(connection) => connection,
                    Err(_) => {
                        log::fatal("Unable to open database file");
                        exit(1);
                    }
                };

                async_std::task::block_on(async move {
                    derive(
                        in_memory_tx,
                        on_disk_tx,
                        mutate_rx,
                        command_rx,
                        connection,
                        event_tx,
                    )
                    .await;
                });
            });
            Some(command_tx)
        }
        None => {
            spawner
                .spawn_local_obj(
                    Box::new(async move { while let Ok(_) = mutate_rx.recv().await {} }).into(),
                )
                .unwrap();
            None
        }
    };

    std::thread::spawn(move || {
        let connection = match Connection::open(database_path) {
            Ok(connection) => connection,
            Err(_) => {
                log::fatal("Unable to open database file");
                exit(1);
            }
        };

        init_inventory::init_inventory(
            connection,
            mutate_tx,
            in_memory_rx,
            on_disk_rx,
            Arc::new(TrueTime {}),
        );
    });

    let spawner_clone = spawner.clone();

    let reconciliation_intent = std::rc::Rc::new(RwLock::new(
        mpmc_manual_reset_event::MPMCManualResetEvent::new(),
    ));

    let reconciliation_intent_clone = reconciliation_intent.clone();

    if let Some(parsed_address) = parsed_address {
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
                                address.unwrap(), error
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
                                            if let Err(error) = socket.set_nodelay(true) {
                                                log::warning(format!(
                                                    "Error occurred while accepting an incoming connection: {:?}",
                                                    error
                                                ));
                                                return;
                                            };
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
    if let Some(parsed_reverse_address) = parsed_reverse_address {
        let in_memory_tx = in_memory_tx.clone();
        let on_disk_tx = on_disk_tx.clone();
        spawner
            .spawn_local_obj(
                Box::new(async move {
                    let listener = match async_std::net::TcpListener::bind(&parsed_reverse_address).await {
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
                                            if let Err(error) = socket.set_nodelay(true) {
                                                log::warning(format!(
                                                    "Error occurred while accepting an incoming connection: {:?}",
                                                    error
                                                ));
                                                return;
                                            };
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

    #[cfg(unix)]
    {
        let spawner_clone = spawner.clone();
        let reconciliation_intent_clone = reconciliation_intent.clone();

        if let Some(unix_socket) = unix_socket {
            let in_memory_tx = in_memory_tx.clone();
            let on_disk_tx = on_disk_tx.clone();
            spawner
                .spawn_local_obj(
                    Box::new(async move {
                        let listener = match async_std::os::unix::net::UnixListener::bind(
                            &unix_socket,
                        )
                        .await
                        {
                            Ok(listener) => listener,
                            Err(error) => {
                                log::fatal(format!(
                                    "Failed to bind to {} due to error {:?}",
                                    unix_socket, error
                                ));
                                exit(1);
                            }
                        };
                        let mut incoming = listener.incoming();
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
        if let Some(unix_socket) = reverse_unix_socket {
            let in_memory_tx = in_memory_tx.clone();
            let on_disk_tx = on_disk_tx.clone();
            spawner
                .spawn_local_obj(
                    Box::new(async move {
                        let listener = match async_std::os::unix::net::UnixListener::bind(
                            &unix_socket,
                        )
                        .await
                        {
                            Ok(listener) => listener,
                            Err(error) => {
                                log::fatal(format!(
                                    "Failed to bind to {} due to error {:?}",
                                    unix_socket, error
                                ));
                                exit(1);
                            }
                        };
                        let mut incoming = listener.incoming();
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
    }

    let spawner_clone = spawner.clone();
    spawner
        .spawn_local_obj(
            Box::new(async move {
                stdio_ipc::communicate(
                    reconciliation_intent,
                    in_memory_tx,
                    on_disk_tx,
                    command_tx,
                    spawner_clone,
                    dump_inventory,
                )
                .await;
            })
            .into(),
        )
        .unwrap();
    exec.run();
}
