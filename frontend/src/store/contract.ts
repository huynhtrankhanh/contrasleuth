import io from "socket.io-client";
import uuid from "uuid/v4";
import {
  PublicHalf,
  Attachment,
  CreatedInbox,
  PublicHalfEntry,
  EncodedMessage,
  ContactId,
  PublicHalves,
  StateDump,
  IpcCommand,
  IpcAnswer,
  MessageEvent,
  MessageExpirationTimeExtended,
  MessageExpired,
  InboxEvent,
  IpcEvent,
  Inventory,
  BackendMessage,
  ProofOfWorkCancelled,
  ProofOfWorkCompleted,
  ConnectionEstablishmentFailure,
  ReconcileFailure,
  ConnectionSevered,
  ServerListenAddress,
  ClientListenAddress,
  Backend,
  Operation,
  PendingProofOfWorkOperations,
} from "./rpc-schema";
import * as t from "./typecheck";

export type Event =
  | {
      type: "MessageEvent";
      value: MessageEvent;
    }
  | {
      type: "MessageExpirationTimeExtended";
      value: MessageExpirationTimeExtended;
    }
  | {
      type: "MessageExpired";
      value: MessageExpired;
    }
  | { type: "InboxEvent"; value: InboxEvent };

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
        soughtForType: "CreatedInbox";
        fulfill: (value: CreatedInbox) => void;
      }
    | {
        soughtForType: "PublicHalfEntry";
        fulfill: (value: PublicHalfEntry) => void;
      }
    | {
        soughtForType: "EncodedMessage";
        fulfill: (value: EncodedMessage) => void;
      }
    | {
        soughtForType: "ContactId";
        fulfill: (value: ContactId) => void;
      }
    | {
        soughtForType: "PublicHalves";
        fulfill: (value: PublicHalves) => void;
      }
    | {
        soughtForType: "StateDump";
        fulfill: (value: StateDump) => void;
      };

  const queue: AnswerRequest[] = [];
  const proofOfWorkResultRequests: Map<
    string,
    (result: "cancelled" | "completed") => void
  > = new Map();

  const parseFrontend = (object: any) => {
    console.log(object);

    const marshal = (object: any) => {
      const Frontend = t.union([IpcAnswer, IpcEvent]);
      const result = Frontend(object);
      if (!result) {
        console.log(new Error("This should be unreachable."));
        return;
      }

      if (CreatedInbox(object)) {
        return {
          type: "CreatedInbox" as "CreatedInbox",
          value: object as CreatedInbox,
        };
      }

      if (PublicHalfEntry(object)) {
        return {
          type: "PublicHalfEntry" as "PublicHalfEntry",
          value: object as PublicHalfEntry,
        };
      }

      if (EncodedMessage(object)) {
        return {
          type: "EncodedMessage" as "EncodedMessage",
          value: object as EncodedMessage,
        };
      }

      if (ContactId(object)) {
        return { type: "ContactId" as "ContactId", value: object as ContactId };
      }

      if (PublicHalves(object)) {
        return {
          type: "PublicHalves" as "PublicHalves",
          value: object as PublicHalves,
        };
      }

      if (StateDump(object)) {
        return { type: "StateDump" as "StateDump", value: object as StateDump };
      }

      if (MessageEvent(object)) {
        return {
          type: "MessageEvent" as "MessageEvent",
          value: object as MessageEvent,
        };
      }

      if (MessageExpirationTimeExtended(object)) {
        return {
          type: "MessageExpirationTimeExtended" as "MessageExpirationTimeExtended",
          value: object as MessageExpirationTimeExtended,
        };
      }

      if (MessageExpired(object)) {
        return {
          type: "MessageExpired" as "MessageExpired",
          value: object as MessageExpired,
        };
      }

      if (InboxEvent(object)) {
        return {
          type: "InboxEvent" as "InboxEvent",
          value: object as InboxEvent,
        };
      }
    };

    const marshalled = marshal(object);

    if (marshalled === undefined) {
      console.log(new Error("This should be unreachable."));
      return;
    }

    if (marshalled.type === "CreatedInbox") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "CreatedInbox"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "PublicHalfEntry") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "PublicHalfEntry"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "EncodedMessage") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "EncodedMessage"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "ContactId") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "ContactId"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "PublicHalves") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "PublicHalves"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "StateDump") {
      const message = marshalled.value;
      const answerRequest = queue.shift();
      if (
        answerRequest !== undefined &&
        answerRequest.soughtForType === "StateDump"
      ) {
        answerRequest.fulfill(message);
      } else console.log(new Error("This should be unreachable."));
    }

    if (marshalled.type === "MessageEvent") {
      const message = marshalled.value;
      callback({ type: "MessageEvent", value: message });
    }

    if (marshalled.type === "MessageExpirationTimeExtended") {
      const message = marshalled.value;
      callback({ type: "MessageExpirationTimeExtended", value: message });
    }

    if (marshalled.type === "MessageExpired") {
      const message = marshalled.value;
      callback({ type: "MessageExpired", value: message });
    }

    if (marshalled.type === "InboxEvent") {
      const message = marshalled.value;
      callback({ type: "InboxEvent", value: message });
    }
  };

  const pendingOperationsRequestQueue: ((
    pendingOperation: PendingProofOfWorkOperations
  ) => void)[] = [];

  const parseBackend = (object: any) => {
    console.log(object);

    const marshal = (object: any) => {
      const result = Backend(object);
      if (!result) {
        console.log(new Error("This should be unreachable."));
        return;
      }

      if (Inventory(object)) {
        return { type: "Inventory" as "Inventory", value: object as Inventory };
      }

      if (BackendMessage(object)) {
        return {
          type: "BackendMessage" as "BackendMessage",
          value: object as BackendMessage,
        };
      }

      if (ProofOfWorkCancelled(object)) {
        return {
          type: "ProofOfWorkCancelled" as "ProofOfWorkCancelled",
          value: object as ProofOfWorkCancelled,
        };
      }

      if (ProofOfWorkCompleted(object)) {
        return {
          type: "ProofOfWorkCompleted" as "ProofOfWorkCompleted",
          value: object as ProofOfWorkCompleted,
        };
      }

      if (ConnectionEstablishmentFailure(object)) {
        return {
          type: "ConnectionEstablishmentFailure" as "ConnectionEstablishmentFailure",
          value: object as ConnectionEstablishmentFailure,
        };
      }

      if (ReconcileFailure(object)) {
        return {
          type: "ReconcileFailure" as "ReconcileFailure",
          value: object as ReconcileFailure,
        };
      }

      if (ConnectionSevered(object)) {
        return {
          type: "ConnectionSevered" as "ConnectionSevered",
          value: object as ConnectionSevered,
        };
      }

      if (ServerListenAddress(object)) {
        return {
          type: "ServerListenAddress" as "ServerListenAddress",
          value: object as ServerListenAddress,
        };
      }

      if (ClientListenAddress(object)) {
        return {
          type: "ClientListenAddress" as "ClientListenAddress",
          value: object as ClientListenAddress,
        };
      }

      if (PendingProofOfWorkOperations(object)) {
        return {
          type: "PendingProofOfWorkOperations" as "PendingProofOfWorkOperations",
          value: object as PendingProofOfWorkOperations,
        };
      }
    };

    const marshalled = marshal(object);

    if (marshalled === undefined) {
      console.log(new Error("This should be unreachable."));
      return;
    }

    if (marshalled.type === "ProofOfWorkCancelled") {
      const message = marshalled.value;
      const request = proofOfWorkResultRequests.get(
        message.ProofOfWorkCancelled.in_reply_to
      );
      if (request === undefined) {
        console.log(new Error("This should be unreachable."));
      } else {
        request("cancelled");
      }
    }

    if (marshalled.type === "ProofOfWorkCompleted") {
      const message = marshalled.value;
      const request = proofOfWorkResultRequests.get(
        message.ProofOfWorkCompleted.in_reply_to
      );
      if (request === undefined) {
        console.log(new Error("This should be unreachable."));
      } else {
        request("completed");
      }
    }

    if (marshalled.type === "PendingProofOfWorkOperations") {
      const message = marshalled.value;
      const request = pendingOperationsRequestQueue.shift();
      if (request !== undefined) {
        request(message);
      } else {
        console.log(new Error("This should be unreachable."));
      }
    }
  };

  const formatFrontend = (object: IpcCommand) => JSON.stringify(object) + "\n";

  const formatBackend = (object: Operation) =>
    btoa(JSON.stringify(object)) + "\n";

  const dumpState = () =>
    new Promise<StateDump>((resolve) => {
      send(formatFrontend("RequestStateDump"));
      queue.push({
        soughtForType: "StateDump",
        fulfill: resolve,
      });
    });

  const dumpPendingOperations = () =>
    new Promise<PendingProofOfWorkOperations>((resolve) => {
      send(formatBackend("DumpPendingProofOfWorkOperations"));
      pendingOperationsRequestQueue.push(resolve);
    });

  const addInbox = (label: string) =>
    new Promise<CreatedInbox>((resolve) => {
      send(formatFrontend({ NewInbox: label }));
      queue.push({
        soughtForType: "CreatedInbox",
        fulfill: resolve,
      });
    });
  const renameInbox = (inboxId: number[], label: string) =>
    send(
      formatFrontend({
        SetInboxLabel: {
          inbox_id: inboxId,
          label,
        },
      })
    );
  const deleteInbox = (inboxId: number[]) =>
    send(formatFrontend({ DeleteInbox: inboxId }));
  const setAutosavePreference = (
    inboxId: number[],
    preference: "autosave" | "manual"
  ) =>
    send(
      formatFrontend({
        SetAutosavePreference: {
          inbox_id: inboxId,
          autosave_preference: preference,
        },
      })
    );
  const getPublicHalfEntry = (inboxId: number[]) =>
    new Promise<PublicHalfEntry>((resolve) => {
      send(formatFrontend({ GetPublicHalfEntry: inboxId }));
      queue.push({
        soughtForType: "PublicHalfEntry",
        fulfill: resolve,
      });
    });

  const saveMessage = (messageId: number[], inboxId: number[]) =>
    send(
      formatFrontend({
        SaveMessage: {
          message_id: messageId,
          inbox_id: inboxId,
        },
      })
    );
  const unsaveMessage = (messageId: number[], inboxId: number[]) =>
    send(
      formatFrontend({
        UnsaveMessage: {
          message_id: messageId,
          inbox_id: inboxId,
        },
      })
    );
  const encodeMessage = (
    inReplyTo: number[] | undefined,
    disclosedRecipients: PublicHalf[],
    richTextFormat: string,
    content: string,
    attachments: Attachment[],
    hiddenRecipients: number[][],
    inboxId: number[]
  ) =>
    new Promise<EncodedMessage>((resolve) => {
      send(
        formatFrontend({
          EncodeMessage: {
            in_reply_to: inReplyTo === undefined ? null : inReplyTo,
            disclosed_recipients: disclosedRecipients,
            rich_text_format: richTextFormat,
            content,
            attachments,
            hidden_recipients: hiddenRecipients,
            inbox_id: inboxId,
          },
        })
      );
      queue.push({
        soughtForType: "EncodedMessage",
        fulfill: resolve,
      });
    });

  const waitOnOperation = (operationId: string) =>
    new Promise<"completed" | "cancelled">((resolve) => {
      proofOfWorkResultRequests.set(operationId, resolve);
    });

  const insertMessage = (
    payload: number[],
    expirationTime: number,
    associatedData: string
  ) => {
    const operationId = uuid();
    send(
      formatBackend({
        Submit: {
          payload,
          expiration_time: expirationTime,
          operation_id: operationId,
          associated_frontend_data: associatedData,
        },
      })
    );
    const promise = new Promise<"completed" | "cancelled">((resolve) =>
      proofOfWorkResultRequests.set(operationId, resolve)
    );

    return [promise, operationId] as [typeof promise, string];
  };

  const cancelSubmitOperation = (operationId: string) =>
    send(
      formatBackend({
        CancelSubmitOperation: {
          to_be_cancelled: operationId,
        },
      })
    );

  const addContact = (
    label: string,
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) =>
    new Promise<ContactId>((resolve) => {
      send(
        formatFrontend({
          NewContact: {
            label,
            public_encryption_key: publicEncryptionKey,
            public_signing_key: publicSigningKey,
          },
        })
      );
      queue.push({ soughtForType: "ContactId", fulfill: resolve });
    });

  const renameContact = (contactId: number[], label: string) =>
    send(
      formatFrontend({
        SetContactLabel: {
          contact_id: contactId,
          label,
        },
      })
    );

  const setPublicHalf = (
    contactId: number[],
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) =>
    new Promise<ContactId>((resolve) => {
      send(
        formatFrontend({
          SetContactPublicHalf: {
            contact_id: contactId,
            public_encryption_key: publicEncryptionKey,
            public_signing_key: publicSigningKey,
          },
        })
      );
      queue.push({ soughtForType: "ContactId", fulfill: resolve });
    });

  const deleteContact = (contactId: number[]) =>
    send(
      formatFrontend({
        DeleteContact: contactId,
      })
    );

  const lookupPublicHalf = (firstTenBytes: number[]) =>
    new Promise<PublicHalves>((resolve) => {
      send(formatFrontend({ LookupPublicHalf: firstTenBytes }));
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
    encodeMessage,
    insertMessage,
    addContact,
    renameContact,
    setPublicHalf,
    deleteContact,
    lookupPublicHalf,
    dumpPendingOperations,
    waitOnOperation,
    cancelSubmitOperation,
  };
};

export default contract;
