use crate::inventory::{
    get_expiration_time, get_message, get_one_after_counter, InMemory, Mutation, OnDisk,
};
use crate::private_box::{decrypt, encrypt};
use async_std::sync::{channel, Receiver, Sender};
use async_std::task;
use rusqlite::{params, Connection};
use sodiumoxide::crypto::box_;
use sodiumoxide::crypto::secretbox;
use sodiumoxide::crypto::sign;
use sodiumoxide::crypto::sign::verify;
use sodiumoxide::randombytes::randombytes;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug)]
pub enum AutosavePreference {
    Autosave,
    Manual,
}

#[derive(Debug)]
pub struct PublicHalf {
    pub public_encryption_key: Vec<u8>,
    pub public_signing_key: Vec<u8>,
}

#[derive(Debug)]
pub enum RichTextFormat {
    Plaintext,
    Markdown,
}

#[derive(Debug)]
pub struct Attachment {
    pub mime_type: String,
    pub blob: Vec<u8>,
}

#[derive(Debug)]
pub struct Message {
    pub sender: PublicHalf,
    pub in_reply_to: Option<Vec<u8>>,
    pub disclosed_recipients: Vec<PublicHalf>,
    pub rich_text_format: RichTextFormat,
    pub content: String,
    pub attachments: Vec<Attachment>,
}

#[derive(Debug)]
pub struct Contact {
    pub label: String,
    pub public_half: PublicHalf,
}

#[derive(Debug)]
pub struct StoredContact {
    pub contact: Contact,
    pub global_id: Vec<u8>,
}

#[derive(Debug)]
pub struct StoredMessage {
    pub message: Message,
    pub expiration_time: Option<i64>,
    pub inbox_id: Vec<u8>,
    pub global_id: Vec<u8>,
    pub message_type: MessageType,
}

#[derive(Debug)]
pub struct Inbox {
    pub global_id: Vec<u8>,
    pub label: String,
    pub public_half: PublicHalf,
    pub autosave_preference: AutosavePreference,
}

#[derive(Debug)]
pub struct InboxExpirationTime {
    pub inbox_id: Vec<u8>,
    pub expiration_time: i64,
}

pub enum Command {
    NewInbox {
        label: String,
        id_and_public_half_tx: Sender<(Vec<u8>, PublicHalf)>,
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
    GetPublicHalfEntry {
        inbox_id: Vec<u8>,
        blob_tx: Sender<Vec<u8>>,
    },
    EncodeMessage {
        in_reply_to: Option<Vec<u8>>,
        disclosed_recipients: Vec<PublicHalf>,
        rich_text_format: RichTextFormat,
        content: String,
        attachments: Vec<Attachment>,
        hidden_recipients: Vec<Vec<u8>>,
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
        id_tx: Sender<Vec<u8>>,
    },
    DeleteContact {
        contact_id: Vec<u8>,
    },
    LookupPublicHalf {
        first_ten_bytes_of_id: Vec<u8>,
        public_half_tx: Sender<PublicHalf>,
    },
    RequestStateDump {
        inbox_tx: Sender<Inbox>,
        stored_message_tx: Sender<StoredMessage>,
        contact_tx: Sender<StoredContact>,
        inbox_expiration_time_tx: Sender<InboxExpirationTime>,
    },
    Stop,
}

pub async fn new_inbox(tx: &Sender<Command>, label: String) -> (Vec<u8>, PublicHalf) {
    let (id_and_public_half_tx, id_and_public_half_rx) = channel(1);
    tx.send(Command::NewInbox {
        label,
        id_and_public_half_tx,
    })
    .await;
    id_and_public_half_rx.recv().await.unwrap()
}

pub async fn set_autosave_preference(
    tx: &Sender<Command>,
    inbox_id: Vec<u8>,
    autosave_preference: AutosavePreference,
) {
    tx.send(Command::SetAutosavePreference {
        inbox_id,
        autosave_preference,
    })
    .await;
}

pub async fn set_inbox_label(tx: &Sender<Command>, inbox_id: Vec<u8>, label: String) {
    tx.send(Command::SetInboxLabel { label, inbox_id }).await;
}

pub async fn delete_inbox(tx: &Sender<Command>, inbox_id: Vec<u8>) {
    tx.send(Command::DeleteInbox { inbox_id }).await;
}

pub async fn get_public_half_entry(tx: &Sender<Command>, inbox_id: Vec<u8>) -> Vec<u8> {
    let (blob_tx, blob_rx) = channel(1);
    tx.send(Command::GetPublicHalfEntry { inbox_id, blob_tx })
        .await;
    blob_rx.recv().await.unwrap()
}

pub async fn encode_message(
    tx: &Sender<Command>,
    in_reply_to: Option<Vec<u8>>,
    disclosed_recipients: Vec<PublicHalf>,
    rich_text_format: RichTextFormat,
    content: String,
    attachments: Vec<Attachment>,
    hidden_recipients: Vec<Vec<u8>>,
    inbox_id: Vec<u8>,
) -> Vec<u8> {
    let (blob_tx, blob_rx) = channel(1);
    tx.send(Command::EncodeMessage {
        in_reply_to,
        disclosed_recipients,
        rich_text_format,
        content,
        attachments,
        hidden_recipients,
        inbox_id,
        blob_tx,
    })
    .await;
    blob_rx.recv().await.unwrap()
}

pub async fn save_message(tx: &Sender<Command>, message_id: Vec<u8>, inbox_id: Vec<u8>) {
    tx.send(Command::SaveMessage {
        message_id,
        inbox_id,
    })
    .await;
}

pub async fn unsave_message(tx: &Sender<Command>, message_id: Vec<u8>, inbox_id: Vec<u8>) {
    tx.send(Command::UnsaveMessage {
        message_id,
        inbox_id,
    })
    .await;
}

pub async fn new_contact(tx: &Sender<Command>, contact: Contact) -> Vec<u8> {
    let (id_tx, id_rx) = channel(1);
    tx.send(Command::NewContact { contact, id_tx }).await;
    id_rx.recv().await.unwrap()
}

pub async fn set_contact_label(tx: &Sender<Command>, contact_id: Vec<u8>, label: String) {
    tx.send(Command::SetContactLabel { contact_id, label })
        .await;
}

pub async fn set_contact_public_half(
    tx: &Sender<Command>,
    contact_id: Vec<u8>,
    public_half: PublicHalf,
) -> Vec<u8> {
    let (id_tx, id_rx) = channel(1);
    tx.send(Command::SetContactPublicHalf {
        contact_id,
        public_half,
        id_tx,
    })
    .await;
    id_rx.recv().await.unwrap()
}

pub async fn delete_contact(tx: &Sender<Command>, contact_id: Vec<u8>) {
    tx.send(Command::DeleteContact { contact_id }).await;
}

pub async fn lookup_public_half(
    tx: &Sender<Command>,
    first_ten_bytes_of_id: Vec<u8>,
    public_half_tx: Sender<PublicHalf>,
) {
    tx.send(Command::LookupPublicHalf {
        first_ten_bytes_of_id,
        public_half_tx,
    })
    .await;
}

pub async fn request_state_dump(
    tx: &Sender<Command>,
    inbox_tx: Sender<Inbox>,
    stored_message_tx: Sender<StoredMessage>,
    contact_tx: Sender<StoredContact>,
    inbox_expiration_time_tx: Sender<InboxExpirationTime>,
) {
    tx.send(Command::RequestStateDump {
        inbox_tx,
        stored_message_tx,
        contact_tx,
        inbox_expiration_time_tx,
    })
    .await;
}

pub async fn stop(tx: &Sender<Command>) {
    tx.send(Command::Stop).await;
}

#[derive(Debug)]
pub enum MessageType {
    Saved,
    Unsaved,
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

#[derive(Debug)]
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

lazy_static! {
    static ref CALCULATE_PUBLIC_HALF_ID_DOMAIN: Vec<u8> = {
        let domain = blake3::hash(b"CONTRASLEUTH CALCULATE PUBLIC HALF ID");
        domain.as_bytes().to_vec()
    };
}

fn calculate_public_half_id(public_encryption_key: &[u8], public_signing_key: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(&public_encryption_key);
    hasher.update(&public_signing_key);
    hasher.update(&CALCULATE_PUBLIC_HALF_ID_DOMAIN);
    hasher.finalize().as_bytes().to_vec()
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
    let obfuscate_public_half_domain = blake3::hash(b"CONTRASLEUTH OBFUSCATE PUBLIC HALF");
    let obfuscate_public_half_domain = obfuscate_public_half_domain.as_bytes();
    let obfuscate_public_half_domain = &obfuscate_public_half_domain[..];
    let calculate_message_id_domain = blake3::hash(b"CONTRASLEUTH CALCULATE MESSAGE ID");
    let calculate_message_id_domain = calculate_message_id_domain.as_bytes();
    let calculate_message_id_domain = &calculate_message_id_domain[..];

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

    let derive_public_half_encryption_key = |first_ten_bytes: &[u8]| {
        assert_eq!(first_ten_bytes.len(), 10);

        let mut hasher = blake3::Hasher::new();
        hasher.update(first_ten_bytes);
        hasher.update(&obfuscate_public_half_domain);
        let mut hash = [0; secretbox::KEYBYTES];
        hasher.finalize_xof().fill(&mut hash);
        secretbox::Key::from_slice(&hash).unwrap()
    };

    async fn purge_or_flag(
        connection: &Connection,
        event_tx: &Sender<Event>,
        message_id: Vec<u8>,
        inbox_id: Vec<u8>,
        flag: &str,
    ) {
        let mut statement = connection
            .prepare(include_str!("../sql/C. Frontend/Fetch derivations.sql"))
            .unwrap();
        let mut rows = statement.query(params![&message_id, &inbox_id]).unwrap();
        match rows.next().unwrap() {
            Some(_) => {
                connection
                    .execute(
                        include_str!("../sql/C. Frontend/Update message type.sql"),
                        params![flag, &message_id, &inbox_id],
                    )
                    .unwrap();
            }
            None => {
                connection
                    .execute(
                        include_str!("../sql/C. Frontend/Delete message.sql"),
                        params![&message_id, &inbox_id],
                    )
                    .unwrap();
                event_tx
                    .send(Event::MessageExpired {
                        global_id: message_id,
                        inbox_id,
                    })
                    .await;
            }
        }
    }

    let parse_public_half = |plaintext: &mut &[u8]| {
        let deserialized =
            match capnp::serialize::read_message(plaintext, capnp::message::ReaderOptions::new()) {
                Ok(deserialized) => deserialized,
                Err(_) => return None,
            };
        let reader = match deserialized.get_root::<crate::message_capnp::public_key::Reader>() {
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

        Some(PublicHalf {
            public_encryption_key,
            public_signing_key,
        })
    };

    let deobfuscate_public_half = |payload: &[u8], first_ten_bytes: &[u8]| {
        if payload.len() < secretbox::NONCEBYTES {
            return None;
        }

        let nonce = secretbox::Nonce::from_slice(&payload[..secretbox::NONCEBYTES]).unwrap();
        let message = &payload[secretbox::NONCEBYTES..];

        let key = derive_public_half_encryption_key(first_ten_bytes);

        match secretbox::open(message, &nonce, &key) {
            Ok(it) => Some(it),
            Err(_) => None,
        }
    };

    async fn stored_message_expiration_time(
        connection: &Connection,
        in_memory_tx: &Sender<InMemory>,
        global_id: &Vec<u8>,
        inbox_id: &Vec<u8>,
    ) -> Option<i64> {
        let mut statement = connection
            .prepare(include_str!("../sql/C. Frontend/Fetch derivations.sql"))
            .unwrap();
        let mut rows = statement.query(params![&global_id, &inbox_id]).unwrap();

        let mut max_expiration_time: Option<i64> = None;
        while let Some(row) = rows.next().unwrap() {
            let inventory_item: Arc<Vec<u8>> = Arc::new(row.get(0).unwrap());
            if let Some(expiration_time) = get_expiration_time(&in_memory_tx, inventory_item).await
            {
                match max_expiration_time {
                    None => max_expiration_time = Some(expiration_time),
                    Some(it) => {
                        if expiration_time > it {
                            max_expiration_time = Some(expiration_time);
                        }
                    }
                }
            }
        }
        max_expiration_time
    }

    let mut inbox_expiration_time: HashMap<Vec<u8>, i64> = HashMap::new();

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

                        {
                            let public_encryption_key: Vec<u8> = row.get(2).unwrap();
                            let public_signing_key: Vec<u8> = row.get(4).unwrap();
                            let first_ten_bytes = &inbox_id[..10];

                            if let Some(plaintext) =
                                deobfuscate_public_half(&payload, &first_ten_bytes)
                            {
                                if let Some(public_half) =
                                    parse_public_half(&mut plaintext.as_slice())
                                {
                                    if public_half.public_encryption_key == public_encryption_key
                                        && public_half.public_signing_key == public_signing_key
                                    {
                                        use std::cmp::max;
                                        inbox_expiration_time.insert(
                                            inbox_id.clone(),
                                            match inbox_expiration_time.get(&inbox_id) {
                                                Some(old_expiration_time) => {
                                                    max(*old_expiration_time, expiration_time)
                                                }
                                                None => expiration_time,
                                            },
                                        );
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
                            let preference: String = row.get(6).unwrap();
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

                        let global_id = {
                            let mut hasher = blake3::Hasher::new();
                            hasher.update(&plaintext);
                            hasher.update(&calculate_message_id_domain);
                            hasher.finalize().as_bytes().to_vec()
                        };

                        {
                            let stored_message_expiration_time = stored_message_expiration_time(
                                &connection,
                                &in_memory_tx,
                                &global_id,
                                &inbox_id,
                            )
                            .await;
                            let current_expiration_time =
                                get_expiration_time(&in_memory_tx, hash.clone()).await;
                            if let Some(current_expiration_time) = current_expiration_time {
                                if let Some(stored_message_expiration_time) =
                                    stored_message_expiration_time
                                {
                                    connection
                                        .execute(
                                            include_str!(
                                                "../sql/C. Frontend/Insert derivation.sql"
                                            ),
                                            params![
                                                &hash.clone() as &Vec<u8>,
                                                &global_id,
                                                &inbox_id
                                            ],
                                        )
                                        .unwrap();
                                    if current_expiration_time > stored_message_expiration_time {
                                        event_tx
                                            .send(Event::MessageExpirationTimeExtended {
                                                global_id: global_id.clone(),
                                                inbox_id: inbox_id.clone(),
                                                expiration_time: current_expiration_time,
                                            })
                                            .await;
                                    }
                                    continue 'outer;
                                }
                            }
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
                                params![&hash.clone() as &Vec<u8>, &global_id, &inbox_id],
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
                Command::NewInbox {
                    label,
                    id_and_public_half_tx,
                } => {
                    let (public_encryption_key, private_encryption_key) = box_::gen_keypair();
                    let public_encryption_key = public_encryption_key.as_ref();
                    let private_encryption_key = private_encryption_key.as_ref();
                    let (public_signing_key, private_signing_key) = sign::gen_keypair();
                    let public_signing_key = public_signing_key.as_ref();
                    let private_signing_key = private_signing_key.as_ref();
                    let global_id =
                        calculate_public_half_id(&public_encryption_key, &public_signing_key);
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Create inbox.sql"),
                            params![
                                global_id,
                                label,
                                public_encryption_key,
                                private_encryption_key,
                                public_signing_key,
                                private_signing_key
                            ],
                        )
                        .unwrap();
                    id_and_public_half_tx
                        .send((
                            global_id,
                            PublicHalf {
                                public_encryption_key: public_encryption_key.to_vec(),
                                public_signing_key: public_signing_key.to_vec(),
                            },
                        ))
                        .await;
                }
                Command::SetAutosavePreference {
                    inbox_id,
                    autosave_preference,
                } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Update autosave preference.sql"),
                            params![
                                match autosave_preference {
                                    AutosavePreference::Manual => "manual",
                                    AutosavePreference::Autosave => "autosave",
                                },
                                inbox_id
                            ],
                        )
                        .unwrap();
                }
                Command::SetInboxLabel { label, inbox_id } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Update inbox label.sql"),
                            params![label, inbox_id],
                        )
                        .unwrap();
                }
                Command::DeleteInbox { inbox_id } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Delete all derivations.sql"),
                            params![&inbox_id],
                        )
                        .unwrap();
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Delete all messages.sql"),
                            params![&inbox_id],
                        )
                        .unwrap();
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Delete inbox.sql"),
                            params![&inbox_id],
                        )
                        .unwrap();
                }
                Command::GetPublicHalfEntry { inbox_id, blob_tx } => {
                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch inbox.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![inbox_id]).unwrap();
                    let row = rows.next().unwrap().unwrap();
                    let public_encryption_key: Vec<u8> = row.get(2).unwrap();
                    let public_signing_key: Vec<u8> = row.get(4).unwrap();
                    let mut builder = capnp::message::Builder::new_default();
                    let mut serialized =
                        builder.init_root::<crate::message_capnp::public_key::Builder>();
                    serialized.set_public_encryption_key(&public_encryption_key);
                    serialized.set_public_signing_key(&public_signing_key);

                    let plaintext = {
                        let mut buffer = Vec::new();
                        capnp::serialize::write_message(&mut buffer, &builder).unwrap();
                        buffer
                    };

                    let mut blob = Vec::new();

                    let nonce = randombytes(secretbox::NONCEBYTES);

                    blob.extend_from_slice(&nonce);

                    let encrypted = secretbox::seal(
                        &plaintext,
                        &secretbox::Nonce::from_slice(&nonce).unwrap(),
                        &derive_public_half_encryption_key(&inbox_id[..10]),
                    );

                    blob.extend_from_slice(&encrypted);

                    blob_tx.send(blob).await;
                }
                Command::EncodeMessage {
                    in_reply_to,
                    disclosed_recipients,
                    rich_text_format,
                    content,
                    attachments,
                    inbox_id,
                    blob_tx,
                    hidden_recipients,
                } => {
                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch inbox.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![inbox_id]).unwrap();
                    let row = rows.next().unwrap().unwrap();
                    let public_encryption_key: Vec<u8> = row.get(2).unwrap();
                    let public_signing_key: Vec<u8> = row.get(4).unwrap();
                    let private_signing_key: Vec<u8> = row.get(5).unwrap();

                    let mut builder = capnp::message::Builder::new_default();
                    let mut serialized =
                        builder.init_root::<crate::message_capnp::message::Builder>();
                    match &in_reply_to {
                        Some(id) => serialized.reborrow().init_in_reply_to().set_id(id),
                        None => serialized.reborrow().init_in_reply_to().set_genesis(()),
                    }
                    let nonce = randombytes(10);
                    serialized.set_nonce(&nonce);
                    serialized.set_content(&content);
                    match rich_text_format {
                        RichTextFormat::Plaintext => serialized
                            .reborrow()
                            .init_rich_text_format()
                            .set_plaintext(()),
                        RichTextFormat::Markdown => serialized
                            .reborrow()
                            .init_rich_text_format()
                            .set_markdown(()),
                    }
                    use std::convert::TryInto;
                    {
                        let length = disclosed_recipients.len();
                        let mut list = serialized
                            .reborrow()
                            .init_disclosed_recipients(length.try_into().unwrap());
                        for i in 0..length {
                            let mut recipient = list.reborrow().get(i.try_into().unwrap());
                            recipient.set_public_encryption_key(
                                &disclosed_recipients[i].public_encryption_key,
                            );
                            recipient.set_public_signing_key(
                                &disclosed_recipients[i].public_signing_key,
                            );
                        }
                    }
                    {
                        let length = attachments.len();
                        let mut list = serialized
                            .reborrow()
                            .init_attachments(length.try_into().unwrap());
                        for i in 0..length {
                            let mut attachment = list.reborrow().get(i.try_into().unwrap());
                            attachment.set_mime_type(&attachments[i].mime_type);
                            attachment.set_blob(&attachments[i].blob);
                        }
                    }

                    let to_be_signed = {
                        let mut buffer = Vec::new();
                        capnp::serialize::write_message(&mut buffer, &builder).unwrap();
                        buffer
                    };

                    let signed = sign::sign(
                        &to_be_signed,
                        &sign::SecretKey::from_slice(&private_signing_key).unwrap(),
                    );

                    let mut builder = capnp::message::Builder::new_default();
                    let mut serialized =
                        builder.init_root::<crate::message_capnp::unverified_message::Builder>();
                    serialized.set_payload(&signed);
                    serialized.set_public_encryption_key(&public_encryption_key);
                    serialized.set_public_signing_key(&public_signing_key);

                    let plaintext = {
                        let mut buffer = Vec::new();
                        capnp::serialize::write_message(&mut buffer, &builder).unwrap();
                        buffer
                    };

                    let recipients = {
                        let mut recipients = Vec::new();
                        for i in 0..hidden_recipients.len() {
                            recipients.push(hidden_recipients[i].as_ref());
                        }

                        for i in 0..disclosed_recipients.len() {
                            recipients.push(disclosed_recipients[i].public_encryption_key.as_ref());
                        }

                        recipients.push(public_encryption_key.as_ref());

                        recipients
                    };

                    blob_tx
                        .send(match encrypt(&plaintext, &recipients) {
                            Some(it) => it,
                            None => continue,
                        })
                        .await;
                }
                Command::SaveMessage {
                    message_id,
                    inbox_id,
                } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Update message type.sql"),
                            params!["saved", message_id, inbox_id],
                        )
                        .unwrap();
                }
                Command::UnsaveMessage {
                    message_id,
                    inbox_id,
                } => {
                    purge_or_flag(&connection, &event_tx, message_id, inbox_id, "unsaved").await;
                }
                Command::NewContact { contact, id_tx } => {
                    let public_encryption_key = contact.public_half.public_encryption_key;
                    let public_signing_key = contact.public_half.public_signing_key;
                    let label = contact.label;
                    let global_id =
                        calculate_public_half_id(&public_encryption_key, &public_signing_key);
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Insert contact.sql"),
                            params![&global_id, public_encryption_key, public_signing_key, label],
                        )
                        .unwrap();
                    id_tx.send(global_id).await;
                }
                Command::SetContactLabel { contact_id, label } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Update contact label.sql"),
                            params![label, contact_id],
                        )
                        .unwrap();
                }
                Command::SetContactPublicHalf {
                    contact_id,
                    public_half,
                    id_tx,
                } => {
                    let new_id = calculate_public_half_id(
                        &public_half.public_encryption_key,
                        &public_half.public_signing_key,
                    );
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Update public half.sql"),
                            params![
                                &public_half.public_encryption_key,
                                &public_half.public_signing_key,
                                &new_id,
                                contact_id
                            ],
                        )
                        .unwrap();
                    id_tx.send(new_id).await;
                }
                Command::DeleteContact { contact_id } => {
                    connection
                        .execute(
                            include_str!("../sql/C. Frontend/Delete contact.sql"),
                            params![contact_id],
                        )
                        .unwrap();
                }
                Command::LookupPublicHalf {
                    first_ten_bytes_of_id,
                    public_half_tx,
                } => {
                    let mut counter = 0u128;
                    while let Some((hash, new_counter)) =
                        get_one_after_counter(&in_memory_tx, counter).await
                    {
                        counter = new_counter;
                        if let Some(message) = get_message(&on_disk_tx, hash).await {
                            let payload = message.payload;
                            if let Some(plaintext) =
                                deobfuscate_public_half(&payload, &first_ten_bytes_of_id)
                            {
                                if let Some(public_half) =
                                    parse_public_half(&mut plaintext.as_slice())
                                {
                                    let id = calculate_public_half_id(
                                        &public_half.public_encryption_key,
                                        &public_half.public_signing_key,
                                    );
                                    if &id[..10] == (&first_ten_bytes_of_id as &[u8]) {
                                        public_half_tx.send(public_half).await;
                                    }
                                }
                            }
                        }
                    }
                }
                Command::RequestStateDump {
                    inbox_tx,
                    stored_message_tx,
                    contact_tx,
                    inbox_expiration_time_tx,
                } => {
                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch inboxes.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![]).unwrap();
                    while let Some(row) = rows.next().unwrap() {
                        let global_id: Vec<u8> = row.get(0).unwrap();
                        let label: String = row.get(1).unwrap();
                        let public_encryption_key: Vec<u8> = row.get(2).unwrap();
                        let public_signing_key: Vec<u8> = row.get(4).unwrap();
                        let autosave_preference: String = row.get(6).unwrap();
                        inbox_tx
                            .send(Inbox {
                                global_id,
                                label,
                                public_half: PublicHalf {
                                    public_encryption_key,
                                    public_signing_key,
                                },
                                autosave_preference: if autosave_preference == "autosave" {
                                    AutosavePreference::Autosave
                                } else {
                                    AutosavePreference::Manual
                                },
                            })
                            .await;
                    }
                    drop(inbox_tx);

                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch messages.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![]).unwrap();
                    while let Some(row) = rows.next().unwrap() {
                        let global_id: Vec<u8> = row.get(0).unwrap();
                        let message_type: String = row.get(1).unwrap();
                        let message_type = if message_type == "unsaved" {
                            MessageType::Unsaved
                        } else if message_type == "saved" {
                            MessageType::Saved
                        } else {
                            unreachable!()
                        };
                        let content: Vec<u8> = row.get(2).unwrap();
                        let inbox_id: Vec<u8> = row.get(3).unwrap();

                        let expiration_time = stored_message_expiration_time(
                            &connection,
                            &in_memory_tx,
                            &global_id,
                            &inbox_id,
                        )
                        .await;

                        stored_message_tx
                            .send(StoredMessage {
                                expiration_time,
                                global_id,
                                inbox_id,
                                message_type,
                                message: parse(&mut content.as_slice()).unwrap(),
                            })
                            .await;
                    }
                    drop(stored_message_tx);

                    let mut statement = connection
                        .prepare(include_str!("../sql/C. Frontend/Fetch contacts.sql"))
                        .unwrap();
                    let mut rows = statement.query(params![]).unwrap();
                    while let Some(row) = rows.next().unwrap() {
                        let global_id = row.get(0).unwrap();
                        let public_encryption_key = row.get(1).unwrap();
                        let public_signing_key = row.get(2).unwrap();
                        let label = row.get(3).unwrap();
                        contact_tx
                            .send(StoredContact {
                                contact: Contact {
                                    label,
                                    public_half: PublicHalf {
                                        public_encryption_key,
                                        public_signing_key,
                                    },
                                },
                                global_id,
                            })
                            .await;
                    }
                    drop(contact_tx);

                    for (inbox_id, expiration_time) in inbox_expiration_time.iter() {
                        inbox_expiration_time_tx
                            .send(InboxExpirationTime {
                                inbox_id: inbox_id.to_vec(),
                                expiration_time: *expiration_time,
                            })
                            .await;
                    }
                }
                Command::Stop => {
                    return;
                }
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::init_inventory::init_inventory;
    use futures::task::LocalSpawn;

    #[test]
    fn works_as_expected() {
        sodiumoxide::init().unwrap();

        // No need for a valid nonce value.
        let nonce = 0xdeadbeefi64;

        use chrono::Utc;
        let now = Utc::now().timestamp();

        let (in_memory_tx, in_memory_rx) = channel(1);
        let (on_disk_tx, on_disk_rx) = channel(1);
        let (mutate_tx, mutate_rx) = channel(1);
        let (command_tx, command_rx) = channel(1);
        let (event_tx, event_rx) = channel(1);

        std::thread::spawn(move || {
            let connection = Connection::open_in_memory().unwrap();
            init_inventory(connection, mutate_tx, in_memory_rx, on_disk_rx);
        });

        let mut exec = futures::executor::LocalPool::new();
        let spawner = exec.spawner();
        {
            let on_disk_tx = on_disk_tx.clone();
            spawner
                .spawn_local_obj(
                    Box::new(async move {
                        let connection = Connection::open_in_memory().unwrap();
                        derive(
                            in_memory_tx,
                            on_disk_tx,
                            mutate_rx,
                            command_rx,
                            connection,
                            event_tx,
                        )
                        .await;
                    })
                    .into(),
                )
                .unwrap();
        }

        spawner
            .spawn_local_obj(
                Box::new(async move {
                    let (inbox_id, _) = new_inbox(&command_tx, "Hello, World!".to_string()).await;

                    let (hidden_recipient_public_key, hidden_recipient_private_key) =
                        box_::gen_keypair();

                    let message = encode_message(
                        &command_tx,
                        None,
                        vec![PublicHalf {
                            public_encryption_key: box_::gen_keypair().0.as_ref().to_vec(),
                            public_signing_key: sign::gen_keypair().0.as_ref().to_vec(),
                        }],
                        RichTextFormat::Plaintext,
                        "some content".to_string(),
                        vec![Attachment {
                            mime_type: "text/plain".to_string(),
                            blob: b"some content".to_vec(),
                        }],
                        vec![hidden_recipient_public_key.as_ref().to_vec()],
                        inbox_id.clone(),
                    )
                    .await;

                    assert!(
                        match decrypt(&message, hidden_recipient_private_key.as_ref()) {
                            Some(_) => true,
                            None => false,
                        }
                    );

                    use crate::inventory;
                    use crate::inventory::insert_message;

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 2,
                        },
                    )
                    .await;

                    let event = event_rx.recv().await.unwrap();

                    let assert_message_content = |message: Message| {
                        let sender_id = calculate_public_half_id(
                            &message.sender.public_encryption_key,
                            &message.sender.public_signing_key,
                        );
                        assert_eq!(sender_id, inbox_id);

                        if let Some(_) = message.in_reply_to {
                            panic!();
                        }

                        assert_eq!(message.disclosed_recipients.len(), 1);

                        if let RichTextFormat::Markdown = message.rich_text_format {
                            panic!();
                        }

                        assert_eq!(message.content, "some content".to_string());

                        assert_eq!(message.attachments[0].mime_type, "text/plain".to_string());
                        assert_eq!(message.attachments[0].blob, b"some content".to_vec());
                    };

                    let global_id = match event {
                        Event::Message {
                            message,
                            message_type,
                            global_id,
                            inbox_id: this_inbox_id,
                            expiration_time: _,
                        } => {
                            assert_message_content(message);

                            assert_eq!(this_inbox_id, inbox_id);

                            if let MessageType::Unsaved = message_type {
                            } else {
                                panic!();
                            }

                            global_id
                        }
                        _ => panic!(),
                    };

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 1,
                        },
                    )
                    .await;

                    // No event should be emitted.

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 3,
                        },
                    )
                    .await;

                    let event = event_rx.recv().await.unwrap();
                    match event {
                        Event::MessageExpirationTimeExtended {
                            global_id: this_global_id,
                            inbox_id: this_inbox_id,
                            expiration_time,
                        } => {
                            assert_eq!(global_id, this_global_id);
                            assert_eq!(inbox_id, this_inbox_id);
                            assert_eq!(expiration_time, now + 3);
                        }
                        _ => panic!(),
                    };

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 2,
                        },
                    )
                    .await;

                    // No event should be emitted.

                    {
                        let (drained1_tx, drained1_rx) = channel(1);
                        let (stored_message_tx, stored_message_rx) = channel(1);
                        let (drained2_tx, drained2_rx) = channel(1);
                        let (drained3_tx, drained3_rx) = channel(1);
                        request_state_dump(
                            &command_tx,
                            drained1_tx,
                            stored_message_tx,
                            drained2_tx,
                            drained3_tx,
                        )
                        .await;

                        while let Some(_) = drained1_rx.recv().await {}

                        if let Some(message) = stored_message_rx.recv().await {
                            assert_message_content(message.message);
                            assert_eq!(message.expiration_time.unwrap(), now + 3);
                            assert_eq!(message.inbox_id, inbox_id);
                            if let MessageType::Unsaved = message.message_type {
                            } else {
                                panic!();
                            }
                        }

                        if let Some(_) = stored_message_rx.recv().await {
                            panic!();
                        }

                        while let Some(_) = drained2_rx.recv().await {}
                        while let Some(_) = drained3_rx.recv().await {}
                    }

                    use std::time::Duration;
                    task::sleep(Duration::from_millis(3100)).await;

                    // Consume expiration event
                    event_rx.recv().await;

                    let assert_no_messages = || {
                        async {
                            let (drained1_tx, drained1_rx) = channel(1);
                            let (stored_message_tx, stored_message_rx) = channel(1);
                            let (drained2_tx, drained2_rx) = channel(1);
                            let (drained3_tx, drained3_rx) = channel(1);
                            request_state_dump(
                                &command_tx,
                                drained1_tx,
                                stored_message_tx,
                                drained2_tx,
                                drained3_tx,
                            )
                            .await;

                            while let Some(_) = drained1_rx.recv().await {}

                            if let Some(_) = stored_message_rx.recv().await {
                                panic!();
                            }

                            while let Some(_) = drained2_rx.recv().await {}
                            while let Some(_) = drained3_rx.recv().await {}
                        }
                    };

                    let now = Utc::now().timestamp();

                    set_autosave_preference(
                        &command_tx,
                        inbox_id.clone(),
                        AutosavePreference::Autosave,
                    )
                    .await;

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 1,
                        },
                    )
                    .await;

                    match event_rx.recv().await.unwrap() {
                        Event::Message {
                            message: _message,
                            message_type,
                            global_id,
                            inbox_id,
                            expiration_time: _expiration_time,
                        } => {
                            match message_type {
                                MessageType::Saved => {}
                                _ => panic!(),
                            }
                            unsave_message(&command_tx, global_id.clone(), inbox_id.clone()).await;
                            save_message(&command_tx, global_id.clone(), inbox_id.clone()).await;

                            task::sleep(Duration::from_millis(1100)).await;
                            // The message has expired.

                            unsave_message(&command_tx, global_id.clone(), inbox_id.clone()).await;
                            match event_rx.recv().await.unwrap() {
                                Event::MessageExpired {
                                    global_id: global_id1,
                                    inbox_id: inbox_id1,
                                } => {
                                    assert_eq!(global_id, global_id1);
                                    assert_eq!(inbox_id, inbox_id1);
                                    assert_no_messages().await;
                                }
                                _ => panic!(),
                            }
                        }
                        _ => panic!(),
                    }

                    let now = Utc::now().timestamp();

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 1,
                        },
                    )
                    .await;

                    match event_rx.recv().await.unwrap() {
                        Event::Message {
                            message: _message,
                            message_type,
                            global_id,
                            inbox_id,
                            expiration_time: _expiration_time,
                        } => {
                            match message_type {
                                MessageType::Saved => {}
                                _ => panic!(),
                            }

                            task::sleep(Duration::from_millis(1100)).await;
                            // The message has expired.

                            unsave_message(&command_tx, global_id.clone(), inbox_id.clone()).await;
                            match event_rx.recv().await.unwrap() {
                                Event::MessageExpired {
                                    global_id: global_id1,
                                    inbox_id: inbox_id1,
                                } => {
                                    assert_eq!(global_id, global_id1);
                                    assert_eq!(inbox_id, inbox_id1);
                                    assert_no_messages().await;
                                }
                                _ => panic!(),
                            }
                        }
                        _ => panic!(),
                    }

                    let now = Utc::now().timestamp();

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: message.clone(),
                            nonce,
                            expiration_time: now + 3600,
                        },
                    )
                    .await;

                    // Consume message event
                    event_rx.recv().await.unwrap();

                    set_inbox_label(&command_tx, inbox_id.clone(), "Lorem Ipsum".to_string()).await;
                    let (inbox_tx, inbox_rx) = channel(1);
                    let (drained1_tx, drained1_rx) = channel(1);
                    let (drained2_tx, drained2_rx) = channel(1);
                    let (drained3_tx, drained3_rx) = channel(1);
                    request_state_dump(
                        &command_tx,
                        inbox_tx,
                        drained1_tx,
                        drained2_tx,
                        drained3_tx,
                    )
                    .await;
                    assert_eq!(
                        inbox_rx.recv().await.unwrap().label,
                        "Lorem Ipsum".to_string()
                    );
                    while let Some(_) = drained1_rx.recv().await {}
                    while let Some(_) = drained2_rx.recv().await {}
                    while let Some(_) = drained3_rx.recv().await {}

                    delete_inbox(&command_tx, inbox_id.clone()).await;
                    let (inbox_tx, inbox_rx) = channel(1);
                    let (stored_message_tx, stored_message_rx) = channel(1);
                    let (drained1_tx, drained1_rx) = channel(1);
                    let (drained2_tx, drained2_rx) = channel(1);
                    request_state_dump(
                        &command_tx,
                        inbox_tx,
                        stored_message_tx,
                        drained1_tx,
                        drained2_tx,
                    )
                    .await;
                    if let Some(_) = inbox_rx.recv().await {
                        panic!();
                    }
                    if let Some(_) = stored_message_rx.recv().await {
                        panic!();
                    }
                    while let Some(_) = drained1_rx.recv().await {}
                    while let Some(_) = drained2_rx.recv().await {}

                    let publichalf1 = PublicHalf {
                        public_encryption_key: box_::gen_keypair().0.as_ref().to_vec(),
                        public_signing_key: sign::gen_keypair().0.as_ref().to_vec(),
                    };

                    let publichalf2 = PublicHalf {
                        public_encryption_key: box_::gen_keypair().0.as_ref().to_vec(),
                        public_signing_key: sign::gen_keypair().0.as_ref().to_vec(),
                    };

                    let id = new_contact(
                        &command_tx,
                        Contact {
                            label: "Hello, World!".to_string(),
                            public_half: publichalf1,
                        },
                    )
                    .await;

                    let id = set_contact_public_half(&command_tx, id, publichalf2).await;

                    set_contact_label(&command_tx, id.clone(), "New Label".to_string()).await;
                    let (drained1_tx, drained1_rx) = channel(1);
                    let (drained2_tx, drained2_rx) = channel(1);
                    let (contact_tx, contact_rx) = channel(1);
                    let (drained3_tx, drained3_rx) = channel(1);
                    request_state_dump(
                        &command_tx,
                        drained1_tx,
                        drained2_tx,
                        contact_tx,
                        drained3_tx,
                    )
                    .await;
                    while let Some(_) = drained1_rx.recv().await {}
                    while let Some(_) = drained2_rx.recv().await {}
                    let contact = contact_rx.recv().await.unwrap();
                    while let Some(_) = drained3_rx.recv().await {}
                    assert_eq!(contact.global_id, id);
                    assert_eq!(contact.contact.label, "New Label".to_string());

                    delete_contact(&command_tx, id).await;
                    let (drained1_tx, drained1_rx) = channel(1);
                    let (drained2_tx, drained2_rx) = channel(1);
                    let (contact_tx, contact_rx) = channel(1);
                    let (drained3_tx, drained3_rx) = channel(1);
                    request_state_dump(
                        &command_tx,
                        drained1_tx,
                        drained2_tx,
                        contact_tx,
                        drained3_tx,
                    )
                    .await;
                    while let Some(_) = drained1_rx.recv().await {}
                    while let Some(_) = drained2_rx.recv().await {}
                    if let Some(_) = contact_rx.recv().await {
                        panic!();
                    }
                    while let Some(_) = drained3_rx.recv().await {}

                    let (inbox_id, _) = new_inbox(&command_tx, "Hello, World!".to_string()).await;
                    let entry = get_public_half_entry(&command_tx, inbox_id.clone()).await;
                    let now = Utc::now().timestamp();

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: entry.clone(),
                            nonce,
                            expiration_time: now + 1,
                        },
                    )
                    .await;

                    match event_rx.recv().await.unwrap() {
                        Event::Inbox {
                            global_id,
                            expiration_time,
                        } => {
                            assert_eq!(global_id, inbox_id);
                            assert_eq!(expiration_time, now + 1);
                        }
                        _ => panic!(),
                    }

                    let (drained1_tx, drained1_rx) = channel(1);
                    let (drained2_tx, drained2_rx) = channel(1);
                    let (drained3_tx, drained3_rx) = channel(1);
                    let (inbox_expiration_time_tx, inbox_expiration_time_rx) = channel(1);
                    request_state_dump(
                        &command_tx,
                        drained1_tx,
                        drained2_tx,
                        drained3_tx,
                        inbox_expiration_time_tx,
                    )
                    .await;
                    while let Some(_) = drained1_rx.recv().await {}
                    while let Some(_) = drained2_rx.recv().await {}
                    while let Some(_) = drained3_rx.recv().await {}
                    let inbox_expiration_time = inbox_expiration_time_rx.recv().await.unwrap();
                    assert_eq!(inbox_expiration_time.inbox_id, inbox_id);
                    assert_eq!(inbox_expiration_time.expiration_time, now + 1);

                    insert_message(
                        &on_disk_tx,
                        inventory::Message {
                            payload: entry.clone(),
                            nonce,
                            expiration_time: now + 3,
                        },
                    )
                    .await;

                    match event_rx.recv().await.unwrap() {
                        Event::Inbox {
                            global_id,
                            expiration_time,
                        } => {
                            assert_eq!(global_id, inbox_id);
                            assert_eq!(expiration_time, now + 3);
                        }
                        _ => panic!(),
                    }

                    let public_half = {
                        let (public_half_tx, public_half_rx) = channel(1);
                        lookup_public_half(&command_tx, inbox_id[..10].to_vec(), public_half_tx)
                            .await;
                        public_half_rx.recv().await.unwrap()
                    };

                    assert_eq!(
                        calculate_public_half_id(
                            &public_half.public_encryption_key,
                            &public_half.public_signing_key
                        ),
                        inbox_id
                    );

                    stop(&command_tx).await;
                })
                .into(),
            )
            .unwrap();

        exec.run();
    }
}
