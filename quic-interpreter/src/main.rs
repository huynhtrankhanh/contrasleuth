use async_std::sync::{channel, RwLock};
use async_std::task;
use futures::{future::FutureExt, select};

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

async fn handle_client(
    signal_incoming_rx: async_std::sync::Receiver<()>,
    signal_outgoing_rx: async_std::sync::Receiver<()>,
    signal_read_buffer_rx: async_std::sync::Receiver<()>,
) {
    const STREAM_ID: u64 = 4;

    let mut config = get_config();
    let source_connection_id: [u8; quiche::MAX_CONN_ID_LEN] = [0; quiche::MAX_CONN_ID_LEN];
    let mut connection = quiche::connect(None, &source_connection_id, &mut config).unwrap();

    enum IncomingBufferReadState {
        FetchFresh,
        FromIndex(usize),
        IgnoreIncoming,
    }

    use IncomingBufferReadState::*;

    let mut incoming_buffer_read_state = FetchFresh;
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
                connection.recv(&mut buffer).ok();
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
            match incoming_buffer_read_state {
                FetchFresh => {
                    if fresh_buffer_available {
                        match connection.stream_send(STREAM_ID, &mut buffer, false) {
                            Ok(size) => {
                                if size != buffer.len() {
                                    incoming_buffer_read_state = FromIndex(size);
                                } else {
                                    incoming_buffer_read_state = FetchFresh;
                                    signal_read_buffer_rx.recv().await;
                                }
                            }
                            Err(_) => {
                                incoming_buffer_read_state = IgnoreIncoming;
                            }
                        };
                        fresh_buffer_available = false;
                    }
                }
                FromIndex(index) => {
                    match connection.stream_send(STREAM_ID, &mut buffer[index..], false) {
                        Ok(size) => {
                            if size != buffer.len() {
                                incoming_buffer_read_state = FromIndex(size);
                            } else {
                                incoming_buffer_read_state = FetchFresh;
                                signal_read_buffer_rx.recv().await;
                            }
                        }
                        Err(_) => {
                            incoming_buffer_read_state = IgnoreIncoming;
                        }
                    };
                }
                IgnoreIncoming => {}
            };
        }

        for stream in connection.readable() {
            while let Ok((read, finished)) = connection.stream_recv(stream, &mut buffer) {
                let stream_buffer = &buffer[..read];

                print!("{}", unsafe {
                    std::str::from_utf8_unchecked(&stream_buffer)
                });

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
        }

        if connection.is_closed() {
            break;
        }
    }
}

fn handle_server() {
    let mut config = get_config();
}

fn main() {
    println!("Hello, world!");
    let is_client = false;

    let (signal_incoming_tx, signal_incoming_rx) = channel::<()>(1);
    let (signal_outgoing_tx, signal_outgoing_rx) = channel::<()>(1);

    task::spawn(async move {});

    if is_client {
        async_std::task::block_on(async {
            handle_client();
        });
    } else {
        async_std::task::block_on(async {
            handle_server();
        });
    }
}
