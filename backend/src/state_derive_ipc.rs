use crate::derive_state::{
    delete_contact, delete_inbox, encode_message, get_public_half_entry, hide_message,
    lookup_public_half, new_contact, new_inbox, request_state_dump, save_message,
    set_autosave_preference, set_contact_label, set_contact_public_half, set_inbox_label,
    unsave_message, AutosavePreference, Command, Event,
};
use crate::log;
use async_std::sync::{channel, Receiver, Sender};
use serde::{Deserialize, Serialize};
use std::process::exit;

#[derive(Serialize, Deserialize)]
struct PublicHalf {
    public_encryption_key: Vec<u8>,
    public_signing_key: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
struct Attachment {
    mime_type: String,
    blob: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
enum IpcCommand {
    NewInbox(String),
    SetAutosavePreference {
        inbox_id: Vec<u8>,
        // Yes, a String. And it will be validated later.
        autosave_preference: String,
    },
    SetInboxLabel {
        inbox_id: Vec<u8>,
        label: String,
    },
    DeleteInbox(Vec<u8>),
    GetPublicHalfEntry(Vec<u8>),
    EncodeMessage {
        in_reply_to: Option<Vec<u8>>,
        disclosed_recipients: Vec<PublicHalf>,
        rich_text_format: String,
        content: String,
        attachments: Vec<Attachment>,
        hidden_recipients: Vec<Vec<u8>>,
        inbox_id: Vec<u8>,
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
        label: String,
        public_encryption_key: Vec<u8>,
        public_signing_key: Vec<u8>,
    },
    SetContactLabel {
        contact_id: Vec<u8>,
        label: String,
    },
    SetContactPublicHalf {
        contact_id: Vec<u8>,
        public_encryption_key: Vec<u8>,
        public_signing_key: Vec<u8>,
    },
    DeleteContact(Vec<u8>),
    LookupPublicHalf(Vec<u8>),
    RequestStateDump,
}

#[derive(Serialize, Deserialize)]
struct Inbox {
    global_id: Vec<u8>,
    label: String,
    public_half: PublicHalf,
    autosave_preference: String,
}

#[derive(Serialize, Deserialize)]
struct StoredMessage {
    sender: PublicHalf,
    in_reply_to: Option<Vec<u8>>,
    disclosed_recipients: Vec<PublicHalf>,
    rich_text_format: String,
    content: String,
    attachments: Vec<Attachment>,
    expiration_time: Option<i64>,
    inbox_id: Vec<u8>,
    global_id: Vec<u8>,
    message_type: String,
}

#[derive(Serialize, Deserialize)]
struct Message {
    sender: PublicHalf,
    in_reply_to: Option<Vec<u8>>,
    disclosed_recipients: Vec<PublicHalf>,
    rich_text_format: String,
    content: String,
    attachments: Vec<Attachment>,
}

#[derive(Serialize, Deserialize)]
struct Contact {
    global_id: Vec<u8>,
    label: String,
    public_encryption_key: Vec<u8>,
    public_signing_key: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
enum IpcAnswer {
    InboxId(Vec<u8>),
    PublicHalfEntry(Vec<u8>),
    EncodedMessage(Vec<u8>),
    ContactId(Vec<u8>),
    PublicHalves(Vec<PublicHalf>),
    StateDump {
        inboxes: Vec<Inbox>,
        messages: Vec<StoredMessage>,
        contacts: Vec<Contact>,
    },
}

#[derive(Serialize, Deserialize)]
enum IpcEvent {
    Message {
        message: Message,
        message_type: String,
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
    Inbox {
        global_id: Vec<u8>,
        expiration_time: i64,
    },
}

fn send<T: Serialize>(value: &T) {
    log::frontend(serde_json::to_string(value).unwrap());
}

pub async fn attempt_parse(command_tx: &Sender<Command>, line: &str) -> bool {
    let command = match serde_json::from_str::<IpcCommand>(&line) {
        Ok(it) => it,
        Err(_) => return false,
    };

    use crate::derive_state;
    use IpcAnswer::*;
    use IpcCommand::*;
    match command {
        NewInbox(label) => {
            send(&InboxId(new_inbox(&command_tx, label).await));
        }
        SetAutosavePreference {
            inbox_id,
            autosave_preference,
        } => {
            let autosave_preference = match &autosave_preference[..] {
                "autosave" => AutosavePreference::Autosave,
                "manual" => AutosavePreference::Manual,
                _ => {
                    log::fatal(format!(
                        "Invalid autosave preference. Offending command: {}",
                        line
                    ));
                    exit(1);
                }
            };

            set_autosave_preference(&command_tx, inbox_id, autosave_preference).await;
        }
        SetInboxLabel { inbox_id, label } => {
            set_inbox_label(&command_tx, inbox_id, label).await;
        }
        DeleteInbox(inbox_id) => {
            delete_inbox(&command_tx, inbox_id).await;
        }
        GetPublicHalfEntry(inbox_id) => {
            send(&PublicHalfEntry(
                get_public_half_entry(&command_tx, inbox_id).await,
            ));
        }
        EncodeMessage {
            in_reply_to,
            disclosed_recipients,
            rich_text_format,
            content,
            attachments,
            hidden_recipients,
            inbox_id,
        } => {
            let disclosed_recipients = {
                let mut result = Vec::new();
                for recipient in disclosed_recipients {
                    result.push(derive_state::PublicHalf {
                        public_encryption_key: recipient.public_encryption_key,
                        public_signing_key: recipient.public_signing_key,
                    });
                }
                result
            };

            let rich_text_format = match &rich_text_format[..] {
                "plaintext" => derive_state::RichTextFormat::Plaintext,
                "markdown" => derive_state::RichTextFormat::Markdown,
                _ => {
                    log::fatal(format!(
                        "Invalid rich text format. Offending command: {}",
                        line.trim()
                    ));
                    exit(1);
                }
            };

            let attachments = {
                let mut result = Vec::new();
                for attachment in attachments {
                    result.push(derive_state::Attachment {
                        mime_type: attachment.mime_type,
                        blob: attachment.blob,
                    });
                }
                result
            };

            send(&EncodedMessage(
                encode_message(
                    &command_tx,
                    in_reply_to,
                    disclosed_recipients,
                    rich_text_format,
                    content,
                    attachments,
                    hidden_recipients,
                    inbox_id,
                )
                .await,
            ));
        }
        SaveMessage {
            message_id,
            inbox_id,
        } => {
            save_message(&command_tx, message_id, inbox_id).await;
        }
        UnsaveMessage {
            message_id,
            inbox_id,
        } => {
            unsave_message(&command_tx, message_id, inbox_id).await;
        }
        HideMessage {
            message_id,
            inbox_id,
        } => {
            hide_message(&command_tx, message_id, inbox_id).await;
        }
        NewContact {
            label,
            public_encryption_key,
            public_signing_key,
        } => {
            send(&ContactId(
                new_contact(
                    &command_tx,
                    derive_state::Contact {
                        label,
                        public_half: derive_state::PublicHalf {
                            public_encryption_key,
                            public_signing_key,
                        },
                    },
                )
                .await,
            ));
        }
        SetContactLabel { contact_id, label } => {
            set_contact_label(&command_tx, contact_id, label).await;
        }
        SetContactPublicHalf {
            contact_id,
            public_encryption_key,
            public_signing_key,
        } => {
            send(&ContactId(
                set_contact_public_half(
                    &command_tx,
                    contact_id,
                    derive_state::PublicHalf {
                        public_encryption_key,
                        public_signing_key,
                    },
                )
                .await,
            ));
        }
        DeleteContact(contact_id) => {
            delete_contact(&command_tx, contact_id).await;
        }
        LookupPublicHalf(first_ten_bytes) => {
            let (tx, rx) = channel(1);
            lookup_public_half(&command_tx, first_ten_bytes, tx).await;
            let mut public_halves = Vec::new();
            while let Some(public_half) = rx.recv().await {
                public_halves.push(PublicHalf {
                    public_encryption_key: public_half.public_encryption_key,
                    public_signing_key: public_half.public_signing_key,
                });
            }
            send(&PublicHalves(public_halves));
        }
        RequestStateDump => {
            let (inbox_tx, inbox_rx) = channel(1);
            let (stored_message_tx, stored_message_rx) = channel(1);
            let (contact_tx, contact_rx) = channel(1);

            request_state_dump(&command_tx, inbox_tx, stored_message_tx, contact_tx).await;

            let inboxes = {
                let mut inboxes = Vec::new();

                while let Some(inbox) = inbox_rx.recv().await {
                    inboxes.push(Inbox {
                        global_id: inbox.global_id,
                        label: inbox.label,
                        public_half: PublicHalf {
                            public_encryption_key: inbox.public_half.public_encryption_key,
                            public_signing_key: inbox.public_half.public_signing_key,
                        },
                        autosave_preference: match inbox.autosave_preference {
                            derive_state::AutosavePreference::Autosave => "autosave".to_string(),
                            derive_state::AutosavePreference::Manual => "manual".to_string(),
                        },
                    });
                }
                inboxes
            };

            let messages = {
                let mut messages = Vec::new();

                while let Some(stored_message) = stored_message_rx.recv().await {
                    messages.push(StoredMessage {
                        sender: PublicHalf {
                            public_encryption_key: stored_message
                                .message
                                .sender
                                .public_encryption_key,
                            public_signing_key: stored_message.message.sender.public_signing_key,
                        },
                        in_reply_to: stored_message.message.in_reply_to,
                        disclosed_recipients: {
                            let mut disclosed_recipients = Vec::new();
                            for recipient in stored_message.message.disclosed_recipients {
                                disclosed_recipients.push(PublicHalf {
                                    public_encryption_key: recipient.public_encryption_key,
                                    public_signing_key: recipient.public_signing_key,
                                });
                            }
                            disclosed_recipients
                        },
                        rich_text_format: match stored_message.message.rich_text_format {
                            derive_state::RichTextFormat::Markdown => "markdown".to_string(),
                            derive_state::RichTextFormat::Plaintext => "plaintext".to_string(),
                        },
                        content: stored_message.message.content,
                        attachments: {
                            let mut attachments = Vec::new();
                            for attachment in stored_message.message.attachments {
                                attachments.push(Attachment {
                                    mime_type: attachment.mime_type,
                                    blob: attachment.blob,
                                });
                            }
                            attachments
                        },
                        expiration_time: stored_message.expiration_time,
                        inbox_id: stored_message.inbox_id,
                        global_id: stored_message.global_id,
                        message_type: match stored_message.message_type {
                            derive_state::MessageType::Unsaved => "unsaved",
                            derive_state::MessageType::Saved => "saved",
                            derive_state::MessageType::Hidden => "hidden",
                        }
                        .to_string(),
                    });
                }
                messages
            };

            let contacts = {
                let mut contacts = Vec::new();

                while let Some(contact) = contact_rx.recv().await {
                    contacts.push(Contact {
                        global_id: contact.global_id,
                        label: contact.contact.label,
                        public_encryption_key: contact.contact.public_half.public_encryption_key,
                        public_signing_key: contact.contact.public_half.public_signing_key,
                    });
                }
                contacts
            };

            send(&StateDump {
                inboxes,
                messages,
                contacts,
            });
        }
    }
    return true;
}

pub async fn state_derive_ipc(event_rx: Receiver<Event>) {
    while let Some(event) = event_rx.recv().await {
        match event {
            Event::Message {
                message,
                message_type,
                global_id,
                inbox_id,
                expiration_time,
            } => {
                send(&IpcEvent::Message {
                    message: Message {
                        sender: PublicHalf {
                            public_encryption_key: message.sender.public_encryption_key,
                            public_signing_key: message.sender.public_signing_key,
                        },
                        in_reply_to: message.in_reply_to,
                        disclosed_recipients: {
                            let mut recipients = Vec::new();
                            for recipient in message.disclosed_recipients {
                                recipients.push(PublicHalf {
                                    public_encryption_key: recipient.public_encryption_key,
                                    public_signing_key: recipient.public_signing_key,
                                });
                            }
                            recipients
                        },
                        rich_text_format: match message.rich_text_format {
                            crate::derive_state::RichTextFormat::Markdown => "markdown",
                            crate::derive_state::RichTextFormat::Plaintext => "plaintext",
                        }
                        .to_string(),
                        content: message.content,
                        attachments: {
                            let mut attachments = Vec::new();
                            for attachment in message.attachments {
                                attachments.push(Attachment {
                                    mime_type: attachment.mime_type,
                                    blob: attachment.blob,
                                });
                            }
                            attachments
                        },
                    },
                    message_type: match message_type {
                        crate::derive_state::MessageType::Unsaved => "unsaved",
                        crate::derive_state::MessageType::Saved => "saved",
                        crate::derive_state::MessageType::Hidden => "hidden",
                    }
                    .to_string(),
                    global_id,
                    inbox_id,
                    expiration_time,
                });
            }
            Event::MessageExpirationTimeExtended {
                global_id,
                inbox_id,
                expiration_time,
            } => {
                send(&IpcEvent::MessageExpirationTimeExtended {
                    global_id,
                    inbox_id,
                    expiration_time,
                });
            }
            Event::MessageExpired {
                global_id,
                inbox_id,
            } => {
                send(&IpcEvent::MessageExpired {
                    global_id,
                    inbox_id,
                });
            }
            Event::Inbox {
                global_id,
                expiration_time,
            } => {
                send(&IpcEvent::Inbox {
                    global_id,
                    expiration_time,
                });
            }
        }
    }
}
