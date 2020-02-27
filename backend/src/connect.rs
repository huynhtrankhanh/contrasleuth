use crate::inventory::{InMemory, OnDisk};
use crate::log;
use crate::mpmc_manual_reset_event;
use crate::reconcile_client;
use crate::reconcile_server;
use async_std::sync::{RwLock, Sender};
use futures::executor::LocalSpawner;
use futures::task::LocalSpawn;
pub fn connect<F1, F2, F3>(
    address: String,
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    handle: LocalSpawner,
    reconciliation_intent: std::rc::Rc<RwLock<mpmc_manual_reset_event::MPMCManualResetEvent>>,
    on_connection_failed: F1,
    on_reconcile_failed: F2,
    on_connection_severed: F3,
) where
    F1: FnOnce(std::io::Error) -> () + 'static,
    F2: FnOnce(capnp::Error) -> () + 'static,
    F3: FnOnce() -> () + 'static,
{
    let handle1 = handle.clone();
    handle
        .spawn_local_obj(
            Box::new(async move {
                log::notice(format!("Connecting to {}", address));
                let stream = match async_std::net::TcpStream::connect(&address).await {
                    Ok(stream) => stream,
                    Err(error) => {
                        on_connection_failed(error);
                        return;
                    }
                };
                match reconcile_client::reconcile(
                    stream,
                    &in_memory_tx,
                    &on_disk_tx,
                    handle1,
                    reconciliation_intent,
                )
                .await
                {
                    Err(error) => on_reconcile_failed(error),
                    Ok(()) => on_connection_severed(),
                }
            })
            .into(),
        )
        .unwrap();
}

pub fn reverse_connect<F1, F2, F3>(
    address: String,
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    handle: LocalSpawner,
    reconciliation_intent: std::rc::Rc<RwLock<mpmc_manual_reset_event::MPMCManualResetEvent>>,
    on_connection_failed: F1,
    on_reconcile_failed: F2,
    on_connection_severed: F3,
) where
    F1: FnOnce(std::io::Error) -> () + 'static,
    F2: FnOnce(capnp::Error) -> () + 'static,
    F3: FnOnce() -> () + 'static,
{
    handle
        .spawn_local_obj(
            Box::new(async move {
                log::notice(format!("Connecting to {}", address));
                let stream = match async_std::net::TcpStream::connect(&address).await {
                    Ok(stream) => stream,
                    Err(error) => {
                        on_connection_failed(error);
                        return;
                    }
                };
                match reconcile_server::init_server(
                    stream,
                    in_memory_tx,
                    on_disk_tx,
                    reconciliation_intent,
                )
                .await
                {
                    Err(error) => on_reconcile_failed(error),
                    Ok(()) => on_connection_severed(),
                }
            })
            .into(),
        )
        .unwrap();
}
