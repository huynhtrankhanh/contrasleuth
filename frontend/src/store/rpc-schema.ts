import { types } from "mobx-state-tree";

export const PublicHalf = types.model("PublicHalf", {
  public_encryption_key: types.array(types.number),
  public_signing_key: types.array(types.number)
});

export const Attachment = types.model("Attachment", {
  mime_type: types.string,
  blob: types.array(types.number)
});

export const NewInbox = types.model("NewInbox", {
  NewInbox: types.string
});

export const SetAutosavePreference = types.model("SetAutosavePreference", {
  SetAutosavePreference: types.model({
    inbox_id: types.array(types.number),
    autosave_preference: types.enumeration(["autosave", "manual"])
  })
});

export const SetInboxLabel = types.model("SetInboxLabel", {
  SetInboxLabel: types.model({
    inbox_id: types.array(types.number),
    label: types.string
  })
});

export const DeleteInbox = types.model("DeleteInbox", {
  DeleteInbox: types.array(types.number)
});

export const GetPublicHalfEntry = types.model("GetPublicHalfEntry", {
  GetPublicHalfEntry: types.array(types.number)
});

export const EncodeMessage = types.model("EncodeMessage", {
  EncodeMessage: types.model({
    in_reply_to: types.maybe(types.array(types.number)),
    disclosed_recipients: types.array(PublicHalf),
    rich_text_format: types.string,
    content: types.string,
    attachments: types.array(Attachment),
    hidden_recipients: types.array(types.array(types.number)),
    inbox_id: types.array(types.number)
  })
});

export const SaveMessage = types.model("SaveMessage", {
  SaveMessage: types.model({
    message_id: types.array(types.number),
    inbox_id: types.array(types.number)
  })
});

export const UnsaveMessage = types.model("UnsaveMessage", {
  UnsaveMessage: types.model({
    message_id: types.array(types.number),
    inbox_id: types.array(types.number)
  })
});

export const HideMessage = types.model("HideMessage", {
  HideMessage: types.model({
    message_id: types.array(types.number),
    inbox_id: types.array(types.number)
  })
});

export const NewContact = types.model("NewContact", {
  NewContact: types.model({
    label: types.string,
    public_encryption_key: types.array(types.number),
    public_signing_key: types.array(types.number)
  })
});

export const SetContactLabel = types.model("SetContactLabel", {
  SetContactLabel: types.model({
    contact_id: types.array(types.number),
    label: types.string
  })
});

export const SetContactPublicHalf = types.model("SetContactPublicHalf", {
  SetContactPublicHalf: types.model({
    contact_id: types.array(types.number),
    public_encryption_key: types.array(types.number),
    public_signing_key: types.array(types.number)
  })
});

export const DeleteContact = types.model("DeleteContact", {
  DeleteContact: types.array(types.number)
});

export const LookupPublicHalf = types.model("LookupPublicHalf", {
  LookupPublicHalf: types.array(types.number)
});

export const RequestStateDump = types.literal("RequestStateDump");

export const IpcCommand = types.union(
  NewInbox,
  SetAutosavePreference,
  SetInboxLabel,
  DeleteInbox,
  GetPublicHalfEntry,
  EncodeMessage,
  SaveMessage,
  UnsaveMessage,
  HideMessage,
  NewContact,
  SetContactLabel,
  SetContactPublicHalf,
  DeleteContact,
  LookupPublicHalf,
  RequestStateDump
);

export const Inbox = types.model("Inbox", {
  global_id: types.array(types.number),
  label: types.string,
  public_half: PublicHalf,
  autosave_preference: types.enumeration(["autosave", "manual"])
});

export const StoredMessage = types.model("StoredMessage", {
  sender: PublicHalf,
  in_reply_to: types.maybe(types.array(types.number)),
  disclosed_recipients: types.array(PublicHalf),
  rich_text_format: types.enumeration(["markdown", "plaintext"]),
  content: types.string,
  attachments: types.array(Attachment),
  expiration_time: types.maybe(types.number),
  inbox_id: types.array(types.number),
  global_id: types.array(types.number),
  message_type: types.enumeration(["unsaved", "saved", "hidden"])
});

export const Message = types.model("Message", {
  sender: PublicHalf,
  in_reply_to: types.maybe(types.array(types.number)),
  disclosed_recipients: types.array(PublicHalf),
  rich_text_format: types.string,
  attachments: types.array(Attachment)
});

export const Contact = types.model("Contact", {
  global_id: types.array(types.number),
  label: types.string,
  public_encryption_key: types.array(types.number),
  public_signing_key: types.array(types.number)
});

export const InboxId = types.model("InboxId", {
  InboxId: types.array(types.number)
});

export const PublicHalfEntry = types.model("PublicHalfEntry", {
  PublicHalfEntry: types.array(types.number)
});

export const EncodedMessage = types.model("EncodedMessage", {
  EncodedMessage: types.array(types.number)
});

export const ContactId = types.model("ContactId", {
  ContactId: types.array(types.number)
});

export const PublicHalves = types.model("PublicHalves", {
  PublicHalves: types.array(PublicHalf)
});

export const StateDump = types.model("StateDump", {
  StateDump: types.model({
    inboxes: types.array(Inbox),
    messages: types.array(StoredMessage),
    contacts: types.array(Contact)
  })
});

export const IpcAnswer = types.union(
  InboxId,
  PublicHalfEntry,
  EncodedMessage,
  ContactId,
  PublicHalves,
  StateDump
);

export const MessageEvent = types.model("MessageEvent", {
  Message: types.model({
    message: Message,
    message_type: types.string,
    global_id: types.array(types.number),
    inbox_id: types.array(types.number),
    expiration_time: types.number
  })
});

export const MessageExpirationTimeExtended = types.model(
  "MessageExpirationTimeExtended",
  {
    MessageExpirationTimeExtended: types.model({
      global_id: types.array(types.number),
      inbox_id: types.array(types.number),
      expiration_time: types.number
    })
  }
);

export const MessageExpired = types.model("MessageExpired", {
  MessageExpired: types.model({
    global_id: types.array(types.number),
    inbox_id: types.array(types.number)
  })
});

export const InboxEvent = types.model("InboxEvent", {
  Inbox: types.model({
    global_id: types.array(types.number),
    expiration_time: types.number
  })
});

export const IpcEvent = types.union(
  MessageEvent,
  MessageExpirationTimeExtended,
  MessageExpired,
  InboxEvent
);

export const Submit = types.model("Submit", {
  Submit: types.model({
    payload: types.array(types.number),
    expiration_time: types.number,
    operation_id: types.string
  })
});

export const Query = types.model("Query", {
  Query: types.model({
    hash: types.array(types.number),
    operation_id: types.string
  })
});

export const CancelSubmitOperation = types.model("CancelSubmitOperation", {
  CancelSubmitOperation: types.model({
    to_be_cancelled: types.string
  })
});

export const EstablishConnection = types.model("EstablishConnection", {
  EstablishConnection: types.model({
    address: types.string,
    operation_id: types.string
  })
});

export const EstablishReverseConnection = types.model(
  "EstablishReverseConnection",
  {
    EstablishReverseConnection: types.model({
      address: types.string,
      operation_id: types.string
    })
  }
);

export const Operation = types.union(
  Submit,
  Query,
  CancelSubmitOperation,
  EstablishConnection,
  EstablishReverseConnection
);

export const Inventory = types.model("Inventory", {
  Inventory: types.array(types.array(types.number))
});

export const InventoryMessage = types.model("InventoryMessage", {
  payload: types.array(types.number),
  // Warning: precision is lost! This value can't be relied upon!
  nonce: types.number,
  expiration_time: types.number
});

export const BackendMessage = types.model("BackendMessage", {
  Message: types.model({
    in_reply_to: types.string,
    message: types.maybe(InventoryMessage)
  })
});

export const ProofOfWorkCancelled = types.model("ProofOfWorkCancelled", {
  ProofOfWorkCancelled: types.model({
    in_reply_to: types.string
  })
});

export const ProofOfWorkCompleted = types.model("ProofOfWorkCompleted", {
  ProofOfWorkCompleted: types.model({
    in_reply_to: types.string
  })
});

export const ConnectionEstablishmentFailure = types.model(
  "ConnectionEstablishmentFailure",
  {
    ConnectionEstablishmentFailure: types.model({
      in_reply_to: types.string
    })
  }
);

export const ReconcileFailure = types.model("ReconcileFailure", {
  ReconcileFailure: types.model({
    in_reply_to: types.string
  })
});

export const ConnectionSevered = types.model("ConnectionSevered", {
  ConnectionSevered: types.model({
    in_reply_to: types.string
  })
});

export const ServerListenAddress = types.model("ServerListenAddress", {
  ServerListenAddress: types.model({
    address: types.string
  })
});

export const ClientListenAddress = types.model("ClientListenAddress", {
  ClientListenAddress: types.model({
    address: types.string
  })
});

export const Backend = types.union(
  Inventory,
  BackendMessage,
  ProofOfWorkCancelled,
  ProofOfWorkCompleted,
  ConnectionEstablishmentFailure,
  ReconcileFailure,
  ConnectionSevered,
  ServerListenAddress,
  ClientListenAddress
);
