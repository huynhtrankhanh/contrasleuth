use crate::inventory::{get_expiration_time, get_message, InMemory, Mutation, OnDisk};
use crate::private_box::{decrypt, encrypt};
use async_std::sync::{channel, Receiver, Sender};
use async_std::task;
use rusqlite::{params, Connection};
use sodiumoxide::crypto::box_;
use sodiumoxide::crypto::secretbox;
use sodiumoxide::crypto::sign;
use sodiumoxide::crypto::sign::verify;
use std::sync::Arc;

pub enum AutosavePreference {
    Autosave,
    Manual,
}

pub struct PublicHalf {
    public_encryption_key: Vec<u8>,
    public_signing_key: Vec<u8>,
}

pub enum RichTextFormat {
    Plaintext,
    Markdown,
}

pub struct Attachment {
    mime_type: String,
    blob: Vec<u8>,
}

pub struct Message {
    sender: PublicHalf,
    in_reply_to: Option<Vec<u8>>,
    disclosed_recipients: Vec<PublicHalf>,
    rich_text_format: RichTextFormat,
    content: String,
    attachments: Vec<Attachment>,
}

pub struct Contact {
    label: String,
    public_half: PublicHalf,
}

pub enum Command {
    NewInbox {
        label: String,
        id_tx: Sender<Vec<u8>>,
    },
    SetAutosavePreference {
        inbox_id: Vec<u8>,
        autosave_preference: AutosavePreference,
    },
    SetInboxLabel {
        label: String,
        inbox_id: Vec<u8>,
    },
    DeleteInbox {
        inbox_id: Vec<u8>,
    },
    EncodeMessage {
        message: Message,
        inbox_id: Vec<u8>,
        blob_tx: Sender<Vec<u8>>,
    },
    SaveMessage {
        message_id: Vec<u8>,
        inbox_id: Vec<u8>,
    },
    UnsaveMessage {
        message_id: Vec<u8>,
        inbox_id: Vec<u8>,
    },
    HideMessage {
        message_id: Vec<u8>,
        inbox_id: Vec<u8>,
    },
    NewContact {
        contact: Contact,
        id_tx: Sender<Vec<u8>>,
    },
    SetContactLabel {
        contact_id: Vec<u8>,
        label: String,
    },
    SetContactPublicHalf {
        contact_id: Vec<u8>,
        public_half: PublicHalf,
    },
    DeleteContact {
        contact_id: Vec<u8>,
    },
    LookupPublicHalf {
        first_ten_bytes_of_id: Vec<u8>,
        public_half_tx: Sender<PublicHalf>,
    },
}

pub enum MessageType {
    Saved,
    Unsaved,
    Ignored,
}

enum Multiplexed {
    Mutation(Mutation),
    Command(Command),
}

fn multiplex(
    multiplexed_tx: Sender<Multiplexed>,
    mutate_rx: Receiver<Mutation>,
    command_rx: Receiver<Command>,
) {
    {
        let multiplexed_tx = multiplexed_tx.clone();
        task::spawn(async move {
            while let Some(mutation) = mutate_rx.recv().await {
                multiplexed_tx.send(Multiplexed::Mutation(mutation)).await;
            }
        });
    }
    {
        let multiplexed_tx = multiplexed_tx.clone();
        task::spawn(async move {
            while let Some(command) = command_rx.recv().await {
                multiplexed_tx.send(Multiplexed::Command(command)).await;
            }
        });
    }
}

pub enum Event {
    Message {
        message: Message,
        message_type: MessageType,
        global_id: Vec<u8>,
        inbox_id: Vec<u8>,
        expiration_time: i64,
    },
    MessageExpirationTimeExtended {
        global_id: Vec<u8>,
        inbox_id: Vec<u8>,
        expiration_time: i64,
    },
    MessageExpired {
        global_id: Vec<u8>,
        inbox_id: Vec<u8>,
    },
    // This variant is for the frontend to determine inbox
    // expiration time and notify the user when an inbox
    // expires.
    Inbox {
        global_id: Vec<u8>,
        expiration_time: i64,
    },
}

/// This task is meant to be spawned. It executes blocking DB operations.
pub async fn derive(
    in_memory_tx: Sender<InMemory>,
    on_disk_tx: Sender<OnDisk>,
    mutate_rx: Receiver<Mutation>,
    command_rx: Receiver<Command>,
    connection: Connection,
    event_tx: Sender<Event>,
) {
    let init = |query| {
        connection.execute(query, params![]).unwrap();
    };
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 1. User version.sql"
    ));
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 2. Foreign keys.sql"
    ));
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 3. Inbox table.sql"
    ));
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 4. Message table.sql"
    ));
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 5. Message derivation table.sql"
    ));
    init(include_str!(
        "../sql/A. Schema/Initial schema for frontend - 6. Contact table.sql"
    ));
    fn parse(plaintext: &mut &[u8]) -> Option<Message> {
        let deserialized =
            match capnp::serialize::read_message(plaintext, capnp::message::ReaderOptions::new()) {
                Ok(deserialized) => deserialized,
                Err(_) => return None,
            };
        let reader =
            match deserialized.get_root::<crate::message_capnp::unverified_message::Reader>() {
                Ok(reader) => reader,
                Err(_) => return None,
            };
        let public_encryption_key: Vec<u8> = match reader.get_public_encryption_key() {
            Ok(key) => key.to_vec(),
            Err(_) => return None,
        };
        if public_encryption_key.len() != box_::PUBLICKEYBYTES {
            return None;
        }
        let public_signing_key: Vec<u8> = match reader.get_public_signing_key() {
            Ok(key) => key.to_vec(),
            Err(_) => return None,
        };
        if public_signing_key.len() != sign::PUBLICKEYBYTES {
            return None;
        }
        let unverified_message: Vec<u8> = match reader.get_payload() {
            Ok(payload) => payload.to_vec(),
            Err(_) => return None,
        };
        let message = match verify(
            &unverified_message,
            &sign::PublicKey::from_slice(&public_signing_key).unwrap(),
        ) {
            Ok(message) => message,
            Err(_) => return None,
        };
        let deserialized = match capnp::serialize::read_message(
            &mut message.as_slice(),
            capnp::message::ReaderOptions::new(),
        ) {
            Ok(deserialized) => deserialized,
            Err(_) => return None,
        };
        let reader = match deserialized.get_root::<crate::message_capnp::message::Reader>() {
            Ok(reader) => reader,
            Err(_) => return None,
        };
        let in_reply_to = match reader.get_in_reply_to().which() {
            Ok(in_reply_to) => in_reply_to,
            Err(_) => return None,
        };
        use crate::message_capnp::message::in_reply_to::Which::{Genesis, Id};
        let in_reply_to: Option<Vec<u8>> = match in_reply_to {
            Genesis(()) => None,
            Id(id) => match id {
                Ok(id) => Some(id.to_vec()),
                Err(_) => return None,
            },
        };
        let disclosed_recipients = {
            let disclosed_recipients = match reader.get_disclosed_recipients() {
                Ok(it) => it,
                Err(_) => return None,
            };
            let mut converted_disclosed_recipients = Vec::<PublicHalf>::new();
            for i in 0..disclosed_recipients.len() {
                let recipient = disclosed_recipients.get(i);
                let public_encryption_key = match recipient.get_public_encryption_key() {
                    Ok(key) => key.to_vec(),
                    Err(_) => return None,
                };
                if public_encryption_key.len() != box_::PUBLICKEYBYTES {
                    return None;
                }
                let public_signing_key = match recipient.get_public_signing_key() {
                    Ok(key) => key.to_vec(),
                    Err(_) => return None,
                };
                if public_signing_key.len() != box_::PUBLICKEYBYTES {
                    return None;
                }
                converted_disclosed_recipients.push(PublicHalf {
                    public_encryption_key,
                    public_signing_key,
                });
            }
            converted_disclosed_recipients
        };
        let rich_text_format = match reader.get_rich_text_format().which() {
            Ok(it) => it,
            Err(_) => return None,
        };
        use crate::message_capnp::message::rich_text_format::Which::{Markdown, Plaintext};
        let rich_text_format = match rich_text_format {
            Plaintext(()) => RichTextFormat::Plaintext,
            Markdown(()) => RichTextFormat::Markdown,
        };
        let content = match reader.get_content() {
            Ok(it) => it.to_string(),
            Err(_) => return None,
        };
        let attachments = {
            let attachments = match reader.get_attachments() {
                Ok(it) => it,
                Err(_) => return None,
            };
            let mut converted_attachments = Vec::<Attachment>::new();
            for i in 0..attachments.len() {
                let attachment = attachments.get(i);
                let mime_type = match attachment.get_mime_type() {
                    Ok(it) => it.to_string(),
                    Err(_) => return None,
                };
                let blob = match attachment.get_blob() {
                    Ok(it) => it.to_vec(),
                    Err(_) => return None,
                };
                converted_attachments.push(Attachment { mime_type, blob });
            }
            converted_attachments
        };

        Some(Message {
            in_reply_to,
            disclosed_recipients,
            rich_text_format,
            content,
            attachments,
            sender: PublicHalf {
                public_encryption_key,
                public_signing_key,
            },
        })
    }

    fn derive_public_half_encryption_key(first_ten_bytes: &[u8]) -> secretbox::Key {
        assert_eq!(first_ten_bytes.len(), 10);

        let mut hasher = blake3::Hasher::new();
        hasher.update(first_ten_bytes);
        hasher.update(b"PARLANCE PUBLIC HALF OBFUSCATION");
        let mut hash = [0; secretbox::KEYBYTES];
        hasher.finalize_xof().fill(&mut hash);
        secretbox::Key::from_slice(&hash).unwrap()
    }

    let (multiplexed_tx, multiplexed_rx) = channel(1);
    multiplex(multiplexed_tx, mutate_rx, command_rx);

    while let Some(multiplexed) = multiplexed_rx.recv().await {
        match multiplexed {
            Multiplexed::Mutation(mutation) => match mutation {
                Mutation::Insert(hash) => {
                    let message = match get_message(&on_disk_tx, hash.clone()).await {
                        Some(it) => it,
                        None => continue,
                    };

                    let payload = message.payload;
                    let expiration_time = message.expiration_time;

                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch inboxes.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![]).unwrap();
                    'outer: while let Some(row) = rows.next().unwrap() {
                        let private_encryption_key: Vec<u8> = row.get(3).unwrap();
                        let inbox_id: Vec<u8> = row.get(0).unwrap();

                        if payload.len() >= secretbox::NONCEBYTES {
                            let public_encryption_key: Vec<u8> = row.get(2).unwrap();
                            let public_signing_key: Vec<u8> = row.get(4).unwrap();
                            let first_ten_bytes = &inbox_id[0..10];
                            let key = derive_public_half_encryption_key(first_ten_bytes);

                            let nonce =
                                secretbox::Nonce::from_slice(&payload[..secretbox::NONCEBYTES])
                                    .unwrap();
                            let message = &payload[secretbox::NONCEBYTES..];

                            if let Ok(plaintext) = secretbox::open(message, &nonce, &key) {
                                let parse = || {
                                    let deserialized = match capnp::serialize::read_message(
                                        &mut plaintext.as_slice(),
                                        capnp::message::ReaderOptions::new(),
                                    ) {
                                        Ok(deserialized) => deserialized,
                                        Err(_) => return None,
                                    };
                                    let reader = match deserialized
                                        .get_root::<crate::message_capnp::public_key::Reader>(
                                    ) {
                                        Ok(reader) => reader,
                                        Err(_) => return None,
                                    };
                                    let public_encryption_key: Vec<u8> =
                                        match reader.get_public_encryption_key() {
                                            Ok(key) => key.to_vec(),
                                            Err(_) => return None,
                                        };
                                    if public_encryption_key.len() != box_::PUBLICKEYBYTES {
                                        return None;
                                    }
                                    let public_signing_key: Vec<u8> =
                                        match reader.get_public_signing_key() {
                                            Ok(key) => key.to_vec(),
                                            Err(_) => return None,
                                        };
                                    if public_signing_key.len() != sign::PUBLICKEYBYTES {
                                        return None;
                                    }

                                    Some(PublicHalf {
                                        public_encryption_key,
                                        public_signing_key,
                                    })
                                };

                                if let Some(public_half) = parse() {
                                    if public_half.public_encryption_key == public_encryption_key
                                        && public_half.public_signing_key == public_signing_key
                                    {
                                        event_tx
                                            .send(Event::Inbox {
                                                global_id: inbox_id,
                                                expiration_time,
                                            })
                                            .await;
                                        continue 'outer;
                                    }
                                }
                            }
                        }

                        let (message_type, message_type_string) = {
                            let preference: String = row.get(7).unwrap();
                            if preference == "autosave" {
                                (MessageType::Saved, "saved")
                            } else {
                                (MessageType::Unsaved, "unsaved")
                            }
                        };

                        let plaintext = match decrypt(&payload, &private_encryption_key) {
                            Some(it) => it,
                            None => continue,
                        };

                        let global_id = blake3::hash(&plaintext).as_bytes().to_vec();

                        let mut statement = connection
                            .prepare(include_str!("../sql/C. Frontend/Fetch derivations.sql"))
                            .unwrap();
                        let mut rows = statement
                            .query(params![&global_id as &Vec<u8>, &inbox_id])
                            .unwrap();

                        while let Some(row) = rows.next().unwrap() {
                            connection
                                .execute(
                                    include_str!("../sql/C. Frontend/Insert derivation.sql"),
                                    params![&hash.clone() as &Vec<u8>, &global_id],
                                )
                                .unwrap();

                            let inventory_item: Vec<u8> = row.get(0).unwrap();
                            let max_expiration_time = {
                                let mut max_expiration_time = match get_expiration_time(
                                    &in_memory_tx,
                                    std::sync::Arc::new(inventory_item),
                                )
                                .await
                                {
                                    Some(it) => it,
                                    None => continue,
                                };

                                while let Some(row) = rows.next().unwrap() {
                                    let inventory_item: Vec<u8> = row.get(0).unwrap();
                                    let expiration_time = match get_expiration_time(
                                        &in_memory_tx,
                                        Arc::new(inventory_item),
                                    )
                                    .await
                                    {
                                        Some(it) => it,
                                        None => continue,
                                    };

                                    if expiration_time > max_expiration_time {
                                        max_expiration_time = expiration_time;
                                    }
                                }
                                max_expiration_time
                            };
                            if expiration_time > max_expiration_time {
                                event_tx
                                    .send(Event::MessageExpirationTimeExtended {
                                        global_id,
                                        inbox_id,
                                        expiration_time,
                                    })
                                    .await;
                            }

                            continue 'outer;
                        }

                        let message = match parse(&mut plaintext.as_slice()) {
                            Some(it) => it,
                            None => continue,
                        };

                        connection
                            .execute(
                                include_str!("../sql/C. Frontend/Insert message.sql"),
                                params![global_id, message_type_string, plaintext, inbox_id],
                            )
                            .unwrap();

                        connection
                            .execute(
                                include_str!("../sql/C. Frontend/Insert derivation.sql"),
                                params![&hash.clone() as &Vec<u8>, &global_id],
                            )
                            .unwrap();

                        event_tx
                            .send(Event::Message {
                                global_id,
                                inbox_id,
                                expiration_time,
                                message,
                                message_type,
                            })
                            .await;
                    }
                }
                Mutation::Purge(hash) => {
                    let mut statement = connection
                        .prepare(include_str!(
                            "../sql/C. Frontend/Fetch derivations by inventory item.sql"
                        ))
                        .unwrap();
                    let mut rows = statement.query(params![&hash as &Vec<u8>]).unwrap();
                    while let Some(row) = rows.next().unwrap() {
                        let derives: Vec<u8> = row.get(0).unwrap();
                        let inbox_id: Vec<u8> = row.get(1).unwrap();
                        let derivation_count: i64 = {
                            let mut statement = connection
                                .prepare(include_str!("../sql/C. Frontend/Count derivations.sql"))
                                .unwrap();
                            let mut rows = statement.query(params![&derives, &inbox_id]).unwrap();
                            rows.next().unwrap().unwrap().get(0).unwrap()
                        };
                        connection
                            .execute(
                                include_str!("../sql/C. Frontend/Delete derivation.sql"),
                                params![&hash as &Vec<u8>, &derives, &inbox_id],
                            )
                            .unwrap();

                        if derivation_count <= 1 {
                            let mut statement = connection
                                .prepare(include_str!("../sql/C. Frontend/Get message type.sql"))
                                .unwrap();
                            let mut rows = statement.query(params![&derives, &inbox_id]).unwrap();
                            if let Some(row) = rows.next().unwrap() {
                                let message_type: String = row.get(0).unwrap();
                                if message_type != "saved" {
                                    connection
                                        .execute(
                                            include_str!("../sql/C. Frontend/Delete message.sql"),
                                            params![&derives, &inbox_id],
                                        )
                                        .unwrap();
                                    event_tx
                                        .send(Event::MessageExpired {
                                            global_id: derives,
                                            inbox_id,
                                        })
                                        .await;
                                }
                            }
                        }
                    }
                }
            },
            Multiplexed::Command(command) => match command {
                Command::NewInbox { label, id_tx } => {}
                Command::SetAutosavePreference {
                    inbox_id,
                    autosave_preference,
                } => {}
                Command::SetInboxLabel { label, inbox_id } => {}
                Command::DeleteInbox { inbox_id } => {}
                Command::EncodeMessage {
                    message,
                    inbox_id,
                    blob_tx,
                } => {}
                Command::SaveMessage {
                    message_id,
                    inbox_id,
                } => {}
                Command::UnsaveMessage {
                    message_id,
                    inbox_id,
                } => {}
                Command::HideMessage {
                    message_id,
                    inbox_id,
                } => {}
                Command::NewContact { contact, id_tx } => {}
                Command::SetContactLabel { contact_id, label } => {}
                Command::SetContactPublicHalf {
                    contact_id,
                    public_half,
                } => {}
                Command::DeleteContact { contact_id } => {}
                Command::LookupPublicHalf {
                    first_ten_bytes_of_id,
                    public_half_tx,
                } => {}
            },
        }
    }
}
