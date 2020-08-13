use crate::inventory::{get_message, get_one_after_counter, InMemory, OnDisk};
use crate::mpmc_manual_reset_event::MPMCManualResetEvent;
use crate::reconcile_capnp::reconcile as Reconcile;
use async_std::io::{Read, Write};
use async_std::sync::{RwLock, Sender};
use capnp_rpc::{rpc_twoparty_capnp, twoparty, RpcSystem};
use futures::task::LocalSpawn;
use futures::AsyncReadExt;
use futures_intrusive::channel::LocalUnbufferedChannel;

pub async fn reconcile<T: Read + Write + 'static>(
    stream: T,
    in_memory_tx: &Sender<InMemory>,
    on_disk_tx: &Sender<OnDisk>,
    spawner: futures::executor::LocalSpawner,
    reconciliation_intent: std::rc::Rc<RwLock<MPMCManualResetEvent>>,
) -> Result<(), capnp::Error> {
    let (reader, writer) = stream.split();
    let network = twoparty::VatNetwork::new(
        reader,
        writer,
        rpc_twoparty_capnp::Side::Client,
        Default::default(),
    );
    let mut rpc_system = RpcSystem::new(Box::new(network), None);
    let reconcile: Reconcile::Client = rpc_system.bootstrap(rpc_twoparty_capnp::Side::Server);
    let handle = reconciliation_intent.write().await.get_handle();
    let reconciliation_intent1 = reconciliation_intent.clone();
    let reconciliation_intent2 = reconciliation_intent.clone();

    #[derive(Debug)]
    enum TerminateOrProceed {
        Terminate(Result<(), capnp::Error>),
        Proceed,
    };

    let channel = std::rc::Rc::new(LocalUnbufferedChannel::new());
    let channel1 = channel.clone();
    let channel2 = channel.clone();

    spawner
        .spawn_local_obj(
            Box::new(async move {
                if let Err(error) = rpc_system.await {
                    if let Err(_) = channel1
                        .send(TerminateOrProceed::Terminate(Err(error)))
                        .await
                    {}
                } else {
                    if let Err(_) = channel1.send(TerminateOrProceed::Terminate(Ok(()))).await {}
                }
                reconciliation_intent1.write().await.drop_handle(handle);
            })
            .into(),
        )
        .unwrap();

    spawner
        .spawn_local_obj(
            Box::new(async move {
                let event = reconciliation_intent2.read().await.get_event(handle);
                loop {
                    event.wait().await;
                    event.reset();
                    if let Err(_) = channel2.send(TerminateOrProceed::Proceed).await {
                        break;
                    }
                }
            })
            .into(),
        )
        .unwrap();

    let mut counter = 0u128;

    loop {
        {
            while let Some((hash, new_counter)) =
                get_one_after_counter(&in_memory_tx, counter).await
            {
                counter = new_counter;
                {
                    let mut request = reconcile.test_request();
                    request.get().set_hash(&hash);
                    let result = request.send().promise.await?;
                    if result.get()?.get_exists() {
                        continue;
                    }
                }
                if let Some(message) = get_message(&on_disk_tx, hash).await {
                    let mut request = reconcile.submit_request();
                    request.get().get_message()?.set_payload(&message.payload);
                    request.get().get_message()?.set_nonce(message.nonce);
                    request
                        .get()
                        .get_message()?
                        .set_expiration_time(message.expiration_time);
                    request.send().promise.await?;
                }
            }
        }

        match channel.receive().await {
            Some(terminate_or_proceed) => match terminate_or_proceed {
                TerminateOrProceed::Terminate(result) => return result,
                TerminateOrProceed::Proceed => continue,
            },
            None => return Ok(()),
        }
    }
}
