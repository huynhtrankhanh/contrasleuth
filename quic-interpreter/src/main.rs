use async_std::sync::{channel, Mutex};
use async_std::task;
use futures::{future::FutureExt, select};
use std::sync::Arc;

const MAX_DATAGRAM_SIZE: usize = 1350;
const IP_SIZE: usize = 65535;

fn get_config() -> quiche::Config {
    let mut config = quiche::Config::new(quiche::PROTOCOL_VERSION).unwrap();
    config
        .set_application_protos(b"\x05hq-23\x08http/0.9")
        .unwrap();
    config.set_max_idle_timeout(5000);
    config.set_max_udp_payload_size(MAX_DATAGRAM_SIZE as u64);
    config.set_initial_max_data(10_000_000);
    config.set_initial_max_stream_data_bidi_local(1_000_000);
    config.set_initial_max_stream_data_bidi_remote(1_000_000);
    config.set_initial_max_streams_bidi(100);
    config.set_initial_max_streams_uni(100);
    config.set_disable_active_migration(true);
    config.verify_peer(false);
    config
}

enum Winner {
    Incoming,
    Outgoing,
    Timeout,
}

async fn race(
    signal_incoming_rx: &async_std::sync::Receiver<()>,
    signal_outgoing_rx: &async_std::sync::Receiver<()>,
    timeout: Option<std::time::Duration>,
) -> Winner {
    use Winner::*;
    match timeout {
        Some(duration) => {
            select! {
                _ = async_std::task::sleep(duration).fuse() => Timeout,
                _ = signal_incoming_rx.recv().fuse() => Incoming,
                _ = signal_outgoing_rx.recv().fuse() => Outgoing
            }
        }
        None => {
            select! {
                _ = signal_incoming_rx.recv().fuse() => Incoming,
                _ = signal_outgoing_rx.recv().fuse() => Outgoing
            }
        }
    }
}

fn main() {
    let is_client = false;

    let (signal_incoming_tx, signal_incoming_rx) = channel::<()>(1);
    let (signal_outgoing_tx, signal_outgoing_rx) = channel::<()>(1);
    let (signal_read_outgoing_buffer_tx, signal_read_outgoing_buffer_rx) = channel::<()>(1);
    task::block_on(async {
        // Block the outgoing buffer signaling channel.
        // The task that reads the response from the backend will send a null message to this
        // channel every time it passes some data to the QUIC engine. The send operation will
        // block until the engine is ready to send more data. This avoids the backpressure
        // problem.
        signal_read_outgoing_buffer_tx.send(()).await;
    });

    let incoming_buffer = Arc::new(Mutex::new(vec![]));
    let outgoing_buffer = Arc::new(Mutex::new(vec![]));

    {
        let incoming_buffer = incoming_buffer.clone();
        task::spawn(async move {
            loop {
                let line = {
                    use async_std::io;
                    let mut buffer = String::new();
                    io::stdin().read_line(&mut buffer).await.unwrap();
                    buffer
                };
                let decoded = base64::decode(line).unwrap();
                *incoming_buffer.lock().await = decoded;
                signal_incoming_tx.send(()).await;
            }
        });
    }

    if is_client {
        async_std::task::block_on(async {
            handle_client(
                signal_incoming_rx,
                signal_outgoing_rx,
                signal_read_outgoing_buffer_rx,
                incoming_buffer,
                outgoing_buffer,
            )
            .await;
        });
    } else {
        async_std::task::block_on(async {
            handle_server();
        });
    }
}

async fn handle_client(
    signal_incoming_rx: async_std::sync::Receiver<()>,
    signal_outgoing_rx: async_std::sync::Receiver<()>,
    signal_read_outgoing_buffer_rx: async_std::sync::Receiver<()>,
    incoming_buffer: Arc<Mutex<Vec<u8>>>,
    outgoing_buffer: Arc<Mutex<Vec<u8>>>,
) {
    const STREAM_ID: u64 = 4;

    let mut config = get_config();
    let source_connection_id: [u8; quiche::MAX_CONN_ID_LEN] = [0; quiche::MAX_CONN_ID_LEN];
    let mut connection = quiche::connect(None, &source_connection_id, &mut config).unwrap();

    enum OutgoingBufferReadState {
        FetchFresh,
        FromIndex(usize),
        IgnoreBuffer,
    }

    use OutgoingBufferReadState::*;

    let mut outgoing_buffer_read_state = FetchFresh;
    let mut fresh_buffer_available = false;

    loop {
        let winner = race(
            &signal_incoming_rx,
            &signal_outgoing_rx,
            connection.timeout(),
        )
        .await;

        let mut buffer = [0; IP_SIZE];
        let mut out = [0; IP_SIZE];

        use Winner::*;

        match winner {
            Incoming => {
                connection.recv(&mut incoming_buffer.lock().await).ok();
            }
            Outgoing => {
                fresh_buffer_available = true;
            }
            Timeout => {
                connection.on_timeout();
            }
        };

        if connection.is_closed() {
            break;
        }

        if connection.is_established() {
            match outgoing_buffer_read_state {
                FetchFresh => {
                    if fresh_buffer_available {
                        let mut locked_buffer = outgoing_buffer.lock().await;
                        match connection.stream_send(STREAM_ID, &mut locked_buffer[..], false) {
                            Ok(size) => {
                                if size != locked_buffer.len() {
                                    outgoing_buffer_read_state = FromIndex(size);
                                } else {
                                    outgoing_buffer_read_state = FetchFresh;
                                    signal_read_outgoing_buffer_rx.recv().await.ok();
                                }
                            }
                            Err(_) => {
                                outgoing_buffer_read_state = IgnoreBuffer;
                            }
                        };
                        fresh_buffer_available = false;
                    }
                }
                FromIndex(index) => {
                    let mut locked_buffer = outgoing_buffer.lock().await;
                    match connection.stream_send(STREAM_ID, &mut locked_buffer[index..], false) {
                        Ok(size) => {
                            if size != locked_buffer.len() {
                                outgoing_buffer_read_state = FromIndex(size);
                            } else {
                                outgoing_buffer_read_state = FetchFresh;
                                signal_read_outgoing_buffer_rx.recv().await.ok();
                            }
                        }
                        Err(_) => {
                            outgoing_buffer_read_state = IgnoreBuffer;
                        }
                    };
                }
                IgnoreBuffer => {}
            };
        }

        for stream in connection.readable() {
            while let Ok((read, finished)) = connection.stream_recv(stream, &mut buffer) {
                let stream_buffer = &buffer[..read];

                // Write to STDOUT

                if finished {
                    connection.close(true, 0x00, b"kthxbye").unwrap();
                }
            }
        }

        loop {
            let write = match connection.send(&mut out) {
                Ok(it) => it,
                Err(quiche::Error::Done) => {
                    break;
                }
                Err(_) => {
                    connection.close(false, 0x1, b"fail").ok();
                    break;
                }
            };

            // Write to Unix socket
        }

        if connection.is_closed() {
            break;
        }
    }
}

fn handle_server() {
    let mut config = get_config();
}
