use async_std::os::unix::net::UnixStream;
use async_std::prelude::*;
use async_std::sync::{channel, Mutex};
use async_std::task;
use futures::{future::FutureExt, select};
use std::sync::Arc;

const MAX_DATAGRAM_SIZE: usize = 1350;
const IP_SIZE: usize = 65535;

fn get_config() -> quiche::Config {
    let mut config = quiche::Config::new(quiche::PROTOCOL_VERSION).unwrap();
    config
        .set_application_protos(b"\x05hq-23\x08contrasleuth-mvp-quic-tunnel")
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
    let path = String::new();

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
    let outgoing_buffer = Arc::new(Mutex::new(([0u8; IP_SIZE], 0usize)));

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
                signal_outgoing_tx,
                signal_read_outgoing_buffer_rx,
                incoming_buffer,
                outgoing_buffer,
                path,
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
    signal_outgoing_tx: async_std::sync::Sender<()>,
    signal_read_outgoing_buffer_rx: async_std::sync::Receiver<()>,
    incoming_buffer: Arc<Mutex<Vec<u8>>>,
    outgoing_buffer: Arc<Mutex<([u8; IP_SIZE], usize)>>,
    path: String,
) {
    let socket = UnixStream::connect(path).await.unwrap();
    let (mut reader, mut writer) = {
        use futures::AsyncReadExt;
        socket.split()
    };

    {
        let outgoing_buffer = outgoing_buffer.clone();
        task::spawn(async move {
            loop {
                let outgoing_buffer = outgoing_buffer.lock().await;
                let mut buffer = outgoing_buffer.0;

                // This value will be read by the QUIC engine, however static
                // analysis isn't good enough to detect this.
                let mut _length = outgoing_buffer.1;
                _length = reader.read(&mut buffer[..]).await.unwrap();

                signal_outgoing_tx.send(()).await;
            }
        });
    }

    const STREAM_ID: u64 = 4;

    let mut config = get_config();
    use rand::Rng;
    let source_connection_id = rand::thread_rng().gen::<[u8; quiche::MAX_CONN_ID_LEN]>();
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
                        let outgoing_buffer = outgoing_buffer.lock().await;
                        let mut buffer = outgoing_buffer.0;
                        let length = outgoing_buffer.1;
                        match connection.stream_send(STREAM_ID, &mut buffer[..length], false) {
                            Ok(size) => {
                                if size != length {
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
                    let outgoing_buffer = outgoing_buffer.lock().await;
                    let mut buffer = outgoing_buffer.0;
                    let length = outgoing_buffer.1;
                    match connection.stream_send(STREAM_ID, &mut buffer[index..length], false) {
                        Ok(size) => {
                            if size != length {
                                outgoing_buffer_read_state = FromIndex(index + size);
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

        {
            let mut buffer = [0; IP_SIZE];
            while let Ok((read, finished)) = connection.stream_recv(STREAM_ID, &mut buffer) {
                let stream_buffer = &buffer[..read];

                writer.write_all(stream_buffer).await.unwrap();

                if finished {
                    connection.close(true, 0x00, b"kthxbye").unwrap();
                }
            }
        }

        loop {
            let mut buffer = [0; IP_SIZE];

            let length = match connection.send(&mut buffer) {
                Ok(it) => it,
                Err(quiche::Error::Done) => {
                    break;
                }
                Err(_) => {
                    connection.close(false, 0x1, b"fail").ok();
                    break;
                }
            };

            // Actually broadcast the packet
            println!("{}\n", base64::encode(&buffer[..length]));
        }

        if connection.is_closed() {
            break;
        }
    }
}

#[derive(Hash, PartialEq, Eq)]
struct OpaqueIdentifier(u128);

struct ServerIncomingBuffer {
    source: OpaqueIdentifier,
    buffer: Vec<u8>,
}

struct ServerOutgoingBuffer {
    destination: OpaqueIdentifier,
    buffer: [u8; IP_SIZE],
    length: usize,
}

async fn handle_server(
    signal_incoming_rx: async_std::sync::Receiver<()>,
    signal_outgoing_rx: async_std::sync::Receiver<()>,
    signal_outgoing_tx: async_std::sync::Sender<()>,
    signal_read_outgoing_buffer_rx: async_std::sync::Receiver<()>,
    incoming_buffer: Arc<Mutex<ServerIncomingBuffer>>,
    outgoing_buffer: Arc<Mutex<ServerOutgoingBuffer>>,
    path: String,
) {
    let mut config = get_config();
    config
        .load_cert_chain_from_pem_file("self-signed-key-from-quiche/cert.crt")
        .unwrap();
    config
        .load_priv_key_from_pem_file("self-signed-key-from-quiche/cert.key")
        .unwrap();

    use sodiumoxide::crypto::auth;
    let connection_id_seed = auth::gen_key();

    let generate_connection_id = |destination_connnection_id: &[u8]| {
        auth::authenticate(destination_connnection_id, &connection_id_seed)
    };

    struct Client {
        connection: std::pin::Pin<Box<quiche::Connection>>,
    }

    use sodiumoxide::crypto::auth::Tag;
    use std::collections::HashMap;

    type ClientMap = HashMap<Tag, Client>;
    let mut clients = ClientMap::new();

    loop {
        let timeout = clients
            .values()
            .filter_map(|client| client.connection.timeout())
            .min();

        let winner = race(&signal_incoming_rx, &signal_outgoing_rx, timeout).await;

        use Winner::*;

        match winner {
            Incoming => {
                let mut incoming_buffer = incoming_buffer.lock().await;
                let header = match quiche::Header::from_slice(
                    &mut incoming_buffer.buffer,
                    quiche::MAX_CONN_ID_LEN,
                ) {
                    Ok(it) => it,
                    Err(_) => {
                        continue;
                    }
                };

                let connection_id = generate_connection_id(&header.dcid);
                let source_connection_id = &connection_id[..quiche::MAX_CONN_ID_LEN];

                let client = {
                    if !clients.contains_key(&connection_id) {
                        let header_type = header.ty;
                        if header_type != quiche::Type::Initial {
                            continue;
                        }

                        if !quiche::version_is_supported(header.version) {
                            let source_connection_id = &header.scid;
                            let destination_connnection_id = &header.dcid;

                            let mut buffer = [0; IP_SIZE];

                            let length = quiche::negotiate_version(
                                source_connection_id,
                                destination_connnection_id,
                                &mut buffer,
                            )
                            .unwrap();

                            // Actually broadcast the packet
                            println!("{}\n", base64::encode(&buffer[..length]));

                            continue;
                        }

                        let connection =
                            quiche::accept(&source_connection_id, None, &mut config).unwrap();

                        let client = Client { connection };
                        clients.insert(connection_id.clone(), client);
                    }

                    clients.get_mut(&connection_id).unwrap()
                };

                client.connection.recv(&mut incoming_buffer.buffer).ok();
            }
            Outgoing => {
                //
            }
            Timeout => {
                for client in clients.values_mut() {
                    client.connection.on_timeout();
                }
            }
        };

        for client in clients.values_mut() {
            loop {
                let mut buffer = [0u8; IP_SIZE];
                let length = match client.connection.send(&mut buffer) {
                    Ok(it) => it,
                    Err(quiche::Error::Done) => {
                        break;
                    }
                    Err(error) => {
                        client.connection.close(false, 0x1, b"fail").ok();
                        break;
                    }
                };

                // Actually broadcast the packet
                println!("{}\n", base64::encode(&buffer[..length]));
            }
        }

        // Garbage collect closed connections
        clients.retain(|_, client| !client.connection.is_closed());
    }
}
