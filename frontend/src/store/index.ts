import { combineReducers } from "redux";

export type PublicHalfIdentifier = string & {
  __publicHalfIdentifierBrand?: string;
};
export type MessageIdentifier = string & { __messageIdentifierBrand?: string };

type AddInbox = { type: "add inbox"; label: string };
type RenameInbox = { type: "rename inbox"; id: PublicHalfIdentifier };
type DeleteInbox = { type: "delete inbox"; id: PublicHalfIdentifier };
type PublishInbox = { type: "publish inbox"; id: PublicHalfIdentifier };

type AutosavePreference = "autosave" | "manual";
type SetAutosavePreference = {
  type: "set autosave preference";
  autosavePreference: AutosavePreference;
};

type InboxAction =
  | AddInbox
  | RenameInbox
  | DeleteInbox
  | PublishInbox
  | SetAutosavePreference;

export type Inbox = {
  label: string;
  publicHalf: PublicHalf;
  autosavePreference: AutosavePreference;
  expirationTime: number | undefined;
};

type InboxState = Record<PublicHalfIdentifier, Inbox>;
const inboxReducer = (state: InboxState, action: InboxAction) => {};

export type PublicHalf = {
  publicEncryptionKey: number[];
  publicSigningKey: number[];
};

type RichTextFormat = "plaintext" | "markdown";

export type Attachment = {
  mimeType: string;
  blob: number[];
};

export type Message = {
  sender: PublicHalf;
  inReplyTo: number[] | undefined;
  disclosedRecipients: PublicHalf[];
  richTextFormat: RichTextFormat;
  content: string;
  attachments: Attachment[];
};

type SendMessage = {
  type: "send message";
  message: Message;
  expirationTime: number;
};

type SaveMessage = {
  type: "save message";
  messageId: MessageIdentifier;
  inboxId: PublicHalfIdentifier;
};

type UnsaveMessage = {
  type: "unsave message";
  messageId: MessageIdentifier;
  inboxId: PublicHalfIdentifier;
};

type HideMessage = {
  type: "hide message";
  messageId: MessageIdentifier;
  inboxId: PublicHalfIdentifier;
};

type ExpireMessage = {
  type: "expire message";
  messageId: MessageIdentifier;
  inboxId: PublicHalfIdentifier;
};

type ExtendMessageExpireTime = {
  type: "extend message expire time";
  messageId: MessageIdentifier;
  inboxId: PublicHalfIdentifier;
};

export type SyntheticMessageIdentifier = string & {
  __syntheticMessageIdentifierBrand?: string;
};

export const getSyntheticIdentifier = (
  inboxId: PublicHalfIdentifier,
  messageId: MessageIdentifier
): SyntheticMessageIdentifier =>
  ((inboxId as string) + (messageId as string)) as SyntheticMessageIdentifier;

type MessageAction =
  | SendMessage
  | SaveMessage
  | UnsaveMessage
  | HideMessage
  | ExpireMessage
  | ExtendMessageExpireTime;
type MessageState = {
  arena: Record<SyntheticMessageIdentifier, Message>;
  inboxToMessages: Record<PublicHalfIdentifier, Message[]>;
  messageToInboxes: Record<MessageIdentifier, PublicHalfIdentifier[]>;
};

const messageReducer = (
  state: MessageState,
  action: MessageAction
): MessageState => {
  switch (action.type) {
    case "hide message":
      break;
    case "save message":
      break;
    case "send message":
      // not handled here
      break;
    case "unsave message":
      break;
  }
};

export type Contact = {
  label: string;
  publicHalf: PublicHalf;
};

type NewContact = {
  type: "new contact";
  contact: Contact;
};

type RenameContact = {
  type: "rename contact";
  contactId: PublicHalfIdentifier;
  label: string;
};

type SetContactPublicHalf = {
  type: "set contact public half";
  contactId: PublicHalfIdentifier;
  publicHalf: PublicHalf;
};

type DeleteContact = {
  type: "delete contact";
  contactId: PublicHalfIdentifier;
};

type ContactAction =
  | NewContact
  | RenameContact
  | SetContactPublicHalf
  | DeleteContact;

type ContactState = Record<PublicHalfIdentifier, Contact>;

const contactReducer = (
  state: ContactState,
  action: ContactAction
): ContactState => {};

export const reducer = () => {};

function* watchIpc() {}

function* watchMutate() {}

export const saga = () => {};
