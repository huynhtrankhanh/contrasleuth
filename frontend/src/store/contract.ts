import io from "socket.io-client";
import uuid from "uuid/v4";
import {
  PublicHalf,
  Attachment,
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
  RequestStateDump,
  IpcCommand,
  Inbox,
  StoredMessage,
  Message,
  Contact,
  InboxId,
  PublicHalfEntry,
  EncodedMessage,
  ContactId,
  PublicHalves,
  StateDump,
  IpcAnswer,
  MessageEvent,
  MessageExpirationTimeExtended,
  MessageExpired,
  InboxEvent,
  IpcEvent,
  Submit,
  Query,
  CancelSubmitOperation,
  EstablishConnection,
  EstablishReverseConnection,
  Operation,
  Inventory,
  InventoryMessage,
  BackendMessage,
  ProofOfWorkCancelled,
  ProofOfWorkCompleted,
  ConnectionEstablishmentFailure,
  ReconcileFailure,
  ConnectionSevered,
  ServerListenAddress,
  ClientListenAddress,
  Backend
} from "./rpc-schema";
import { types, getType, getSnapshot } from "mobx-state-tree";
type Instance<T> = T extends { Type: any } ? T["Type"] : T;

type Event =
  | {
      type: "MessageEvent";
      value: Instance<typeof MessageEvent>;
    }
  | {
      type: "MessageExpirationTimeExtended";
      value: Instance<typeof MessageExpirationTimeExtended>;
    }
  | {
      type: "MessageExpired";
      value: Instance<typeof MessageExpired>;
    }
  | { type: "InboxEvent"; value: Instance<typeof InboxEvent> };

const contract = (callback: (event: Event) => void) => {
  const socket = io();

  const frontendPattern = /^[A-Z][a-z]{2}\s+\d+\s+\d+:\d+:\d+\s+\d+\s\[FRONTEND\]/;
  const backendPattern = /^[A-Z][a-z]{2}\s+\d+\s+\d+:\d+:\d+\s+\d+\s\[IPC\]/;

  socket.on("stdout", (data: string) => {
    console.log(data);
    if (frontendPattern.test(data)) {
      parseFrontend(JSON.parse(data.replace(frontendPattern, "")));
      return;
    }
    if (backendPattern.test(data)) {
      parseBackend(JSON.parse(atob(data.replace(backendPattern, ""))));
      return;
    }
    console.log("This is an informational log message and can't be parsed.");
  });

  const send = (line: string) => {
    socket.emit("stdin", line);
  };

  type AnswerRequest =
    | {
        soughtForType: "InboxId";
        fulfill: (value: Instance<typeof InboxId>) => void;
      }
    | {
        soughtForType: "PublicHalfEntry";
        fulfill: (value: Instance<typeof PublicHalfEntry>) => void;
      }
    | {
        soughtForType: "EncodedMessage";
        fulfill: (value: Instance<typeof EncodedMessage>) => void;
      }
    | {
        soughtForType: "ContactId";
        fulfill: (value: Instance<typeof ContactId>) => void;
      }
    | {
        soughtForType: "PublicHalves";
        fulfill: (value: Instance<typeof PublicHalves>) => void;
      }
    | {
        soughtForType: "StateDump";
        fulfill: (value: Instance<typeof StateDump>) => void;
      };

  const queue: AnswerRequest[] = [];
  const proofOfWorkResultRequests: Map<
    string,
    (result: "cancelled" | "completed") => void
  > = new Map();

  const Frontend = types.union(IpcAnswer, IpcEvent);
  const parseFrontend = (object: any) => {
    console.log(object);
    const hydrated = Frontend.create(object);

    switch (getType(hydrated)) {
      case InboxId: {
        const message = hydrated as Instance<typeof InboxId>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "InboxId"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case PublicHalfEntry: {
        const message = hydrated as Instance<typeof PublicHalfEntry>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "PublicHalfEntry"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case EncodedMessage: {
        const message = hydrated as Instance<typeof EncodedMessage>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "EncodedMessage"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case ContactId: {
        const message = hydrated as Instance<typeof ContactId>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "ContactId"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case PublicHalves: {
        const message = hydrated as Instance<typeof PublicHalves>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "PublicHalves"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case StateDump: {
        const message = hydrated as Instance<typeof StateDump>;
        const answerRequest = queue.shift();
        if (
          answerRequest !== undefined &&
          answerRequest.soughtForType === "StateDump"
        ) {
          answerRequest.fulfill(message);
        } else console.log(new Error("This should be unreachable."));
        break;
      }
      case MessageEvent: {
        const message = hydrated as Instance<typeof MessageEvent>;
        callback({ type: "MessageEvent", value: message });
        break;
      }
      case MessageExpirationTimeExtended: {
        const message = hydrated as Instance<
          typeof MessageExpirationTimeExtended
        >;
        callback({ type: "MessageExpirationTimeExtended", value: message });
        break;
      }
      case MessageExpired: {
        const message = hydrated as Instance<typeof MessageExpired>;
        callback({ type: "MessageExpired", value: message });
        break;
      }
      case InboxEvent: {
        const message = hydrated as Instance<typeof InboxEvent>;
        callback({ type: "InboxEvent", value: message });
        break;
      }
      default: {
        console.log(new Error("This should be unreachable."));
      }
    }
  };

  const parseBackend = (object: any) => {
    console.log(object);
    const hydrated = Backend.create(object);
    switch (getType(hydrated)) {
      case Inventory: {
        break;
      }
      case BackendMessage: {
        break;
      }
      case ProofOfWorkCancelled: {
        const message = hydrated as Instance<typeof ProofOfWorkCancelled>;
        const request = proofOfWorkResultRequests.get(
          message.ProofOfWorkCancelled.in_reply_to
        );
        if (request === undefined) {
          console.log(new Error("This should be unreachable."));
        } else {
          request("cancelled");
        }
        break;
      }
      case ProofOfWorkCompleted: {
        const message = hydrated as Instance<typeof ProofOfWorkCompleted>;
        const request = proofOfWorkResultRequests.get(
          message.ProofOfWorkCompleted.in_reply_to
        );
        if (request === undefined) {
          console.log(new Error("This should be unreachable."));
        } else {
          request("completed");
        }
        break;
      }
      case ConnectionEstablishmentFailure: {
        break;
      }
      case ReconcileFailure: {
        break;
      }
      case ConnectionSevered: {
        break;
      }
      case ServerListenAddress: {
        break;
      }
      case ClientListenAddress: {
        break;
      }
      default: {
        console.log(new Error("This should be unreachable."));
      }
    }
  };

  const formatFrontend = (object: Instance<typeof IpcCommand>) =>
    JSON.stringify(object) + "\n";

  const formatBackend = (object: Instance<typeof Operation>) =>
    btoa(JSON.stringify(object)) + "\n";

  const dumpState = () =>
    new Promise<Instance<typeof StateDump>>(resolve => {
      send(formatFrontend(RequestStateDump.create("RequestStateDump")));
      queue.push({
        soughtForType: "StateDump",
        fulfill: resolve
      });
    });

  const addInbox = (label: string) =>
    new Promise<Instance<typeof InboxId>>(resolve => {
      send(formatFrontend(NewInbox.create({ NewInbox: label })));
      queue.push({
        soughtForType: "InboxId",
        fulfill: resolve
      });
    });
  const renameInbox = (inboxId: number[], label: string) =>
    send(
      formatFrontend(
        SetInboxLabel.create({
          SetInboxLabel: {
            inbox_id: inboxId,
            label
          }
        })
      )
    );
  const deleteInbox = (inboxId: number[]) =>
    send(formatFrontend(DeleteInbox.create({ DeleteInbox: inboxId })));
  const setAutosavePreference = (
    inboxId: number[],
    preference: "autosave" | "manual"
  ) =>
    send(
      formatFrontend(
        SetAutosavePreference.create({
          SetAutosavePreference: {
            inbox_id: inboxId,
            autosave_preference: preference
          }
        })
      )
    );
  const getPublicHalfEntry = (inboxId: number[]) =>
    new Promise<Instance<typeof PublicHalfEntry>>(resolve => {
      send(
        formatFrontend(
          GetPublicHalfEntry.create({ GetPublicHalfEntry: inboxId })
        )
      );
      queue.push({
        soughtForType: "PublicHalfEntry",
        fulfill: resolve
      });
    });

  const saveMessage = (messageId: number[], inboxId: number[]) =>
    send(
      formatFrontend(
        SaveMessage.create({
          SaveMessage: {
            message_id: messageId,
            inbox_id: inboxId
          }
        })
      )
    );
  const unsaveMessage = (messageId: number[], inboxId: number[]) =>
    send(
      formatFrontend(
        UnsaveMessage.create({
          UnsaveMessage: {
            message_id: messageId,
            inbox_id: inboxId
          }
        })
      )
    );
  const hideMessage = (messageId: number[], inboxId: number[]) =>
    send(
      formatFrontend(
        HideMessage.create({
          HideMessage: {
            message_id: messageId,
            inbox_id: inboxId
          }
        })
      )
    );
  const encodeMessage = (
    inReplyTo: number[] | undefined,
    disclosedRecipients: Instance<typeof PublicHalf>[],
    richTextFormat: string,
    content: string,
    attachments: Instance<typeof Attachment>[],
    hiddenRecipients: number[][],
    inboxId: number[]
  ) =>
    new Promise<Instance<typeof EncodedMessage>>(resolve => {
      send(
        formatFrontend(
          EncodeMessage.create({
            EncodeMessage: {
              in_reply_to: inReplyTo,
              disclosed_recipients: disclosedRecipients,
              rich_text_format: richTextFormat,
              content,
              attachments,
              hidden_recipients: hiddenRecipients,
              inbox_id: inboxId
            }
          })
        )
      );
      queue.push({
        soughtForType: "EncodedMessage",
        fulfill: resolve
      });
    });

  const insertMessage = (payload: number[], expirationTime: number) => {
    const operationId = uuid();
    send(
      formatBackend(
        Submit.create({
          Submit: {
            payload,
            expiration_time: expirationTime,
            operation_id: operationId
          }
        })
      )
    );
    const promise = new Promise<"completed" | "cancelled">(resolve =>
      proofOfWorkResultRequests.set(operationId, resolve)
    );
    const cancel = () =>
      send(
        formatBackend(
          CancelSubmitOperation.create({
            CancelSubmitOperation: {
              to_be_cancelled: operationId
            }
          })
        )
      );

    return [promise, cancel] as [typeof promise, typeof cancel];
  };

  const addContact = (
    label: string,
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) =>
    new Promise<Instance<typeof ContactId>>(resolve => {
      send(
        formatFrontend(
          NewContact.create({
            NewContact: {
              label,
              public_encryption_key: publicEncryptionKey,
              public_signing_key: publicSigningKey
            }
          })
        )
      );
      queue.push({ soughtForType: "ContactId", fulfill: resolve });
    });

  const renameContact = (contactId: number[], label: string) =>
    send(
      formatFrontend(
        SetContactLabel.create({
          SetContactLabel: {
            contact_id: contactId,
            label
          }
        })
      )
    );

  const setPublicHalf = (
    contactId: number[],
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) =>
    new Promise<Instance<typeof ContactId>>(resolve => {
      send(
        formatFrontend(
          SetContactPublicHalf.create({
            SetContactPublicHalf: {
              contact_id: contactId,
              public_encryption_key: publicEncryptionKey,
              public_signing_key: publicSigningKey
            }
          })
        )
      );
      queue.push({ soughtForType: "ContactId", fulfill: resolve });
    });

  const deleteContact = (contactId: number[]) =>
    send(
      formatFrontend(
        DeleteContact.create({
          DeleteContact: contactId
        })
      )
    );

  const lookupPublicHalf = (firstTenBytes: number[]) =>
    new Promise<Instance<typeof PublicHalves>>(resolve => {
      send(
        formatFrontend(
          LookupPublicHalf.create({ LookupPublicHalf: firstTenBytes })
        )
      );
      queue.push({ soughtForType: "PublicHalves", fulfill: resolve });
    });

  return {
    dumpState,
    addInbox,
    renameInbox,
    deleteInbox,
    setAutosavePreference,
    getPublicHalfEntry,
    saveMessage,
    unsaveMessage,
    hideMessage,
    encodeMessage,
    insertMessage,
    addContact,
    renameContact,
    setPublicHalf,
    deleteContact,
    lookupPublicHalf
  };
};

export default contract;
