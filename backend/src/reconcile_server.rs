use crate::inventory::{insert_message, message_exists, InMemory, Message, OnDisk};
use crate::message_hash::message_hash;
use crate::mpmc_manual_reset_event::MPMCManualResetEvent;
use crate::reconcile_capnp::reconcile as Reconcile;
use async_std::io::{Read, Write};
use async_std::sync::{RwLock, Sender};
use capnp::capability::Promise;
use capnp::Error;
use capnp_rpc::{pry, rpc_twoparty_capnp, twoparty, RpcSystem};
use futures::AsyncReadExt;

struct ReconcileRPCServer {
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    reconciliation_intent: std::rc::Rc<RwLock<MPMCManualResetEvent>>,
}

impl ReconcileRPCServer {
    fn new(
        in_memory_tx: Sender<InMemory>,
        on_disk_tx: Sender<OnDisk>,
        reconciliation_intent: std::rc::Rc<RwLock<MPMCManualResetEvent>>,
    ) -> ReconcileRPCServer {
        ReconcileRPCServer {
            in_memory_tx,
            on_disk_tx,
            reconciliation_intent,
        }
    }
}

impl Reconcile::Server for ReconcileRPCServer {
    fn test(
        &mut self,
        params: Reconcile::TestParams,
        mut results: Reconcile::TestResults,
    ) -> Promise<(), Error> {
        let in_memory_tx = self.in_memory_tx.clone();
        Promise::from_future(async move {
            let hash = params.get()?.get_hash()?.to_vec();
            results
                .get()
                .set_exists(message_exists(&in_memory_tx, std::sync::Arc::new(hash)).await);
            Ok(())
        })
    }

    fn submit(
        &mut self,
        params: Reconcile::SubmitParams,
        _results: Reconcile::SubmitResults,
    ) -> Promise<(), Error> {
        let in_memory_tx = self.in_memory_tx.clone();
        let on_disk_tx = self.on_disk_tx.clone();
        let reconciliation_intent = self.reconciliation_intent.clone();
        let message = pry!(pry!(params.get()).get_message());
        let payload = pry!(message.get_payload()).to_vec();
        let nonce = message.get_nonce();
        let expiration_time = message.get_expiration_time();
        Promise::from_future(async move {
            let hash1 = std::sync::Arc::new(message_hash(&payload, expiration_time).to_vec());
            let message_exists = message_exists(&in_memory_tx, hash1).await;

            let proof_of_work_valid =
                crate::proof_of_work::verify(&payload, nonce, expiration_time);

            if !message_exists && proof_of_work_valid {
                insert_message(
                    &on_disk_tx,
                    Message {
                        payload,
                        nonce,
                        expiration_time,
                    },
                )
                .await;
                let cloned = reconciliation_intent.clone();
                cloned.read().await.broadcast();
            }
            Ok(())
        })
    }
}

pub async fn init_server<T: Read + Write + 'static>(
    stream: T,
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    reconciliation_intent: std::rc::Rc<RwLock<MPMCManualResetEvent>>,
) -> Result<(), capnp::Error> {
    let reconcile: Reconcile::Client = capnp_rpc::new_client(ReconcileRPCServer::new(
        in_memory_tx,
        on_disk_tx,
        reconciliation_intent,
    ));
    let (reader, writer) = stream.split();
    let network = twoparty::VatNetwork::new(
        reader,
        writer,
        rpc_twoparty_capnp::Side::Server,
        Default::default(),
    );
    let rpc_system = RpcSystem::new(Box::new(network), Some(reconcile.clone().client));
    rpc_system.await
}
