import * as t from "./typecheck";

export const PublicHalf = t.struct({
  public_encryption_key: t.list(t.Number),
  public_signing_key: t.list(t.Number),
});

export type PublicHalf = {
  public_encryption_key: number[];
  public_signing_key: number[];
};

export const Attachment = t.struct({
  mime_type: t.String,
  blob: t.list(t.Number),
});

export type Attachment = {
  mime_type: string;
  blob: number[];
};

export const NewInbox = t.struct({
  NewInbox: t.String,
});

export type NewInbox = {
  NewInbox: string;
};

export const SetAutosavePreference = t.struct({
  SetAutosavePreference: t.struct({
    inbox_id: t.list(t.Number),
    autosave_preference: t.refinement(t.String, (string) =>
      ["autosave", "manual"].includes(string)
    ),
  }),
});

export type SetAutosavePreference = {
  SetAutosavePreference: {
    inbox_id: number[];
    autosave_preference: "autosave" | "manual";
  };
};

export const SetInboxLabel = t.struct({
  SetInboxLabel: t.struct({
    inbox_id: t.list(t.Number),
    label: t.String,
  }),
});

export type SetInboxLabel = {
  SetInboxLabel: {
    inbox_id: number[];
    label: string;
  };
};

export const DeleteInbox = t.struct({
  DeleteInbox: t.list(t.Number),
});

export type DeleteInbox = {
  DeleteInbox: number[];
};

export const GetPublicHalfEntry = t.struct({
  GetPublicHalfEntry: t.list(t.Number),
});

export type GetPublicHalfEntry = {
  GetPublicHalfEntry: number[];
};

export const EncodeMessage = t.struct({
  EncodeMessage: t.struct({
    in_reply_to: t.maybe(t.list(t.Number)),
    disclosed_recipients: t.list(PublicHalf),
    rich_text_format: t.String,
    content: t.String,
    attachments: t.list(Attachment),
    hidden_recipients: t.list(t.list(t.Number)),
    inbox_id: t.list(t.Number),
  }),
});

export type EncodeMessage = {
  EncodeMessage: {
    in_reply_to: number[] | null;
    disclosed_recipients: PublicHalf[];
    rich_text_format: string;
    content: string;
    attachments: Attachment[];
    hidden_recipients: number[][];
    inbox_id: number[];
  };
};

export const SaveMessage = t.struct({
  SaveMessage: t.struct({
    message_id: t.list(t.Number),
    inbox_id: t.list(t.Number),
  }),
});

export type SaveMessage = {
  SaveMessage: {
    message_id: number[];
    inbox_id: number[];
  };
};

export const UnsaveMessage = t.struct({
  UnsaveMessage: t.struct({
    message_id: t.list(t.Number),
    inbox_id: t.list(t.Number),
  }),
});

export type UnsaveMessage = {
  UnsaveMessage: {
    message_id: number[];
    inbox_id: number[];
  };
};

export const NewContact = t.struct({
  NewContact: t.struct({
    label: t.String,
    public_encryption_key: t.list(t.Number),
    public_signing_key: t.list(t.Number),
  }),
});

export type NewContact = {
  NewContact: {
    label: string;
    public_encryption_key: number[];
    public_signing_key: number[];
  };
};

export const SetContactLabel = t.struct({
  SetContactLabel: t.struct({
    contact_id: t.list(t.Number),
    label: t.String,
  }),
});

export type SetContactLabel = {
  SetContactLabel: {
    contact_id: number[];
    label: string;
  };
};

export const SetContactPublicHalf = t.struct({
  SetContactPublicHalf: t.struct({
    contact_id: t.list(t.Number),
    public_encryption_key: t.list(t.Number),
    public_signing_key: t.list(t.Number),
  }),
});

export type SetContactPublicHalf = {
  SetContactPublicHalf: {
    contact_id: number[];
    public_encryption_key: number[];
    public_signing_key: number[];
  };
};

export const DeleteContact = t.struct({
  DeleteContact: t.list(t.Number),
});

export type DeleteContact = {
  DeleteContact: number[];
};

export const LookupPublicHalf = t.struct({
  LookupPublicHalf: t.list(t.Number),
});

export type LookupPublicHalf = {
  LookupPublicHalf: number[];
};

export const RequestStateDump = t.refinement(
  t.String,
  (string) => string === "RequestStateDump"
);

export type RequestStateDump = "RequestStateDump";

export const IpcCommand = t.union([
  NewInbox,
  SetAutosavePreference,
  SetInboxLabel,
  DeleteInbox,
  GetPublicHalfEntry,
  EncodeMessage,
  SaveMessage,
  UnsaveMessage,
  NewContact,
  SetContactLabel,
  SetContactPublicHalf,
  DeleteContact,
  LookupPublicHalf,
  RequestStateDump,
]);

export type IpcCommand =
  | NewInbox
  | SetAutosavePreference
  | SetInboxLabel
  | DeleteInbox
  | GetPublicHalfEntry
  | EncodeMessage
  | SaveMessage
  | UnsaveMessage
  | NewContact
  | SetContactLabel
  | SetContactPublicHalf
  | DeleteContact
  | LookupPublicHalf
  | RequestStateDump;

export const Inbox = t.struct({
  global_id: t.list(t.Number),
  label: t.String,
  public_half: PublicHalf,
  autosave_preference: t.refinement(t.String, (string) =>
    ["autosave", "manual"].includes(string)
  ),
});

export type Inbox = {
  global_id: number[];
  label: string;
  public_half: PublicHalf;
  autosave_preference: "autosave" | "manual";
};

export const StoredMessage = t.struct({
  sender: PublicHalf,
  in_reply_to: t.maybe(t.list(t.Number)),
  disclosed_recipients: t.list(PublicHalf),
  rich_text_format: t.refinement(t.String, (string) =>
    ["markdown", "plaintext"].includes(string)
  ),
  content: t.String,
  attachments: t.list(Attachment),
  expiration_time: t.maybe(t.Number),
  inbox_id: t.list(t.Number),
  global_id: t.list(t.Number),
  message_type: t.refinement(t.String, (string) =>
    ["unsaved", "saved"].includes(string)
  ),
});

export type StoredMessage = {
  sender: PublicHalf;
  in_reply_to: number[] | null;
  disclosed_recipients: PublicHalf[];
  rich_text_format: "markdown" | "plaintext";
  content: string;
  attachments: Attachment[];
  expiration_time: number | null;
  inbox_id: number[];
  global_id: number[];
  message_type: "unsaved" | "saved";
};

export const Message = t.struct({
  sender: PublicHalf,
  in_reply_to: t.maybe(t.list(t.Number)),
  disclosed_recipients: t.list(PublicHalf),
  rich_text_format: t.refinement(t.String, (string) =>
    ["markdown", "plaintext"].includes(string)
  ),
  content: t.String,
  attachments: t.list(Attachment),
});

export type Message = {
  sender: PublicHalf;
  in_reply_to: number[] | null;
  disclosed_recipients: PublicHalf[];
  rich_text_format: "markdown" | "plaintext";
  content: string;
  attachments: Attachment[];
};

export const Contact = t.struct({
  global_id: t.list(t.Number),
  label: t.String,
  public_encryption_key: t.list(t.Number),
  public_signing_key: t.list(t.Number),
});

export type Contact = {
  global_id: number[];
  label: string;
  public_encryption_key: number[];
  public_signing_key: number[];
};

export const CreatedInbox = t.struct({
  CreatedInbox: t.struct({
    id: t.list(t.Number),
    public_half: PublicHalf,
  }),
});

export type CreatedInbox = {
  CreatedInbox: {
    id: number[];
    public_half: PublicHalf;
  };
};

export const PublicHalfEntry = t.struct({
  PublicHalfEntry: t.list(t.Number),
});

export type PublicHalfEntry = {
  PublicHalfEntry: number[];
};

export const EncodedMessage = t.struct({
  EncodedMessage: t.list(t.Number),
});

export type EncodedMessage = {
  EncodedMessage: number[];
};

export const ContactId = t.struct({
  ContactId: t.list(t.Number),
});

export type ContactId = {
  ContactId: number[];
};

export const PublicHalves = t.struct({
  PublicHalves: t.list(PublicHalf),
});

export type PublicHalves = {
  PublicHalves: PublicHalf[];
};

export const InboxExpirationTime = t.struct({
  inbox_id: t.list(t.Number),
  expiration_time: t.Number,
});

export type InboxExpirationTime = {
  inbox_id: number[];
  expiration_time: number;
};

export const StateDump = t.struct({
  StateDump: t.struct({
    inboxes: t.list(Inbox),
    messages: t.list(StoredMessage),
    contacts: t.list(Contact),
    inbox_expiration_times: t.list(InboxExpirationTime),
  }),
});

export type StateDump = {
  StateDump: {
    inboxes: Inbox[];
    messages: StoredMessage[];
    contacts: Contact[];
    inbox_expiration_times: InboxExpirationTime[];
  };
};

export const IpcAnswer = t.union([
  CreatedInbox,
  PublicHalfEntry,
  EncodedMessage,
  ContactId,
  PublicHalves,
  StateDump,
]);

export type IpcAnswer =
  | CreatedInbox
  | PublicHalfEntry
  | EncodedMessage
  | ContactId
  | PublicHalves
  | StateDump;

export const MessageEvent = t.struct({
  Message: t.struct({
    message: Message,
    message_type: t.refinement(t.String, (string) =>
      ["saved", "unsaved"].includes(string)
    ),
    global_id: t.list(t.Number),
    inbox_id: t.list(t.Number),
    expiration_time: t.Number,
  }),
});

export type MessageEvent = {
  Message: {
    message: Message;
    message_type: "saved" | "unsaved";
    global_id: number[];
    inbox_id: number[];
    expiration_time: number;
  };
};

export const MessageExpirationTimeExtended = t.struct({
  MessageExpirationTimeExtended: t.struct({
    global_id: t.list(t.Number),
    inbox_id: t.list(t.Number),
    expiration_time: t.Number,
  }),
});

export type MessageExpirationTimeExtended = {
  MessageExpirationTimeExtended: {
    global_id: number[];
    inbox_id: number[];
    expiration_time: number;
  };
};

export const MessageExpired = t.struct({
  MessageExpired: t.struct({
    global_id: t.list(t.Number),
    inbox_id: t.list(t.Number),
  }),
});

export type MessageExpired = {
  MessageExpired: {
    global_id: number[];
    inbox_id: number[];
  };
};

export const InboxEvent = t.struct({
  Inbox: t.struct({
    global_id: t.list(t.Number),
    expiration_time: t.Number,
  }),
});

export type InboxEvent = {
  Inbox: {
    global_id: number[];
    expiration_time: number;
  };
};

export const IpcEvent = t.union([
  MessageEvent,
  MessageExpirationTimeExtended,
  MessageExpired,
  InboxEvent,
]);

export type IpcEvent =
  | MessageEvent
  | MessageExpirationTimeExtended
  | MessageExpired
  | InboxEvent;

export const Submit = t.struct({
  Submit: t.struct({
    payload: t.list(t.Number),
    expiration_time: t.Number,
    operation_id: t.String,
    associated_frontend_data: t.String,
  }),
});

export type Submit = {
  Submit: {
    payload: number[];
    expiration_time: number;
    operation_id: string;
    associated_frontend_data: string;
  };
};

export const Query = t.struct({
  Query: t.struct({
    hash: t.list(t.Number),
    operation_id: t.String,
  }),
});

export type Query = {
  Query: {
    hash: number[];
    operation_id: string;
  };
};

export const CancelSubmitOperation = t.struct({
  CancelSubmitOperation: t.struct({
    to_be_cancelled: t.String,
  }),
});

export type CancelSubmitOperation = {
  CancelSubmitOperation: {
    to_be_cancelled: string;
  };
};

export const EstablishConnection = t.struct({
  EstablishConnection: t.struct({
    address: t.String,
    operation_id: t.String,
  }),
});

export type EstablishConnection = {
  EstablishConnection: {
    address: string;
    operation_id: string;
  };
};

export const EstablishReverseConnection = t.struct({
  EstablishReverseConnection: t.struct({
    address: t.String,
    operation_id: t.String,
  }),
});

export type EstablishReverseConnection = {
  EstablishReverseConnection: {
    address: string;
    operation_id: string;
  };
};

export const DumpPendingProofOfWorkOperations = t.refinement(
  t.String,
  (string) => string === "DumpPendingProofOfWorkOperations"
);

export type DumpPendingProofOfWorkOperations = "DumpPendingProofOfWorkOperations";

export const Operation = t.union([
  Submit,
  Query,
  CancelSubmitOperation,
  EstablishConnection,
  EstablishReverseConnection,
  DumpPendingProofOfWorkOperations,
]);

export type Operation =
  | Submit
  | Query
  | CancelSubmitOperation
  | EstablishConnection
  | EstablishReverseConnection
  | DumpPendingProofOfWorkOperations;

export const Inventory = t.struct({
  Inventory: t.list(t.list(t.Number)),
});

export type Inventory = {
  Inventory: number[][];
};

export const InventoryMessage = t.struct({
  payload: t.list(t.Number),
  // Warning: precision is lost! This value can't be relied upon!
  nonce: t.Number,
  expiration_time: t.Number,
});

export type InventoryMessage = {
  payload: number[];
  // Warning: precision is lost! This value can't be relied upon!
  nonce: number;
  expiration_time: number;
};

export const BackendMessage = t.struct({
  Message: t.struct({
    in_reply_to: t.String,
    message: t.maybe(InventoryMessage),
  }),
});

export type BackendMessage = {
  Message: {
    in_reply_to: string;
    message: InventoryMessage | null;
  };
};

export const ProofOfWorkCancelled = t.struct({
  ProofOfWorkCancelled: t.struct({
    in_reply_to: t.String,
  }),
});

export type ProofOfWorkCancelled = {
  ProofOfWorkCancelled: {
    in_reply_to: string;
  };
};

export const ProofOfWorkCompleted = t.struct({
  ProofOfWorkCompleted: t.struct({
    in_reply_to: t.String,
  }),
});

export type ProofOfWorkCompleted = {
  ProofOfWorkCompleted: {
    in_reply_to: string;
  };
};

export const ConnectionEstablishmentFailure = t.struct({
  ConnectionEstablishmentFailure: t.struct({
    in_reply_to: t.String,
  }),
});

export type ConnectionEstablishmentFailure = {
  ConnectionEstablishmentFailure: {
    in_reply_to: string;
  };
};

export const ReconcileFailure = t.struct({
  ReconcileFailure: t.struct({
    in_reply_to: t.String,
  }),
});

export type ReconcileFailure = {
  ReconcileFailure: {
    in_reply_to: string;
  };
};

export const ConnectionSevered = t.struct({
  ConnectionSevered: t.struct({
    in_reply_to: t.String,
  }),
});

export type ConnectionSevered = {
  ConnectionSevered: {
    in_reply_to: string;
  };
};

export const ServerListenAddress = t.struct({
  ServerListenAddress: t.struct({
    address: t.String,
  }),
});

export type ServerListenAddress = {
  ServerListenAddress: {
    address: string;
  };
};

export const ClientListenAddress = t.struct({
  ClientListenAddress: t.struct({
    address: t.String,
  }),
});

export type ClientListenAddress = {
  ClientListenAddress: { address: string };
};

export const ProofOfWorkOperation = t.struct({
  operation_id: t.String,
  associated_frontend_data: t.String,
});

export type ProofOfWorkOperation = {
  operation_id: string;
  associated_frontend_data: string;
};

export const PendingProofOfWorkOperations = t.struct({
  PendingProofOfWorkOperations: t.list(ProofOfWorkOperation),
});

export type PendingProofOfWorkOperations = {
  PendingProofOfWorkOperations: ProofOfWorkOperation[];
};

export const Backend = t.union([
  Inventory,
  BackendMessage,
  ProofOfWorkCancelled,
  ProofOfWorkCompleted,
  ConnectionEstablishmentFailure,
  ReconcileFailure,
  ConnectionSevered,
  ServerListenAddress,
  ClientListenAddress,
  PendingProofOfWorkOperations,
]);

export type Backend =
  | Inventory
  | BackendMessage
  | ProofOfWorkCancelled
  | ProofOfWorkCompleted
  | ConnectionEstablishmentFailure
  | ReconcileFailure
  | ConnectionSevered
  | ServerListenAddress
  | ClientListenAddress
  | PendingProofOfWorkOperations;
