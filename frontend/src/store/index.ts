import { observable, configure, action } from "mobx";
// https://github.com/ng-packagr/ng-packagr/issues/805#issuecomment-384932636
import * as localforage from "localforage";
import { StoredMessage } from "./rpc-schema";
import contract from "./contract";
import uuid from "uuid/v4";
import * as t from "./typecheck";
configure({ enforceActions: "always" });

const methods = (() => {
  let stateDumpFetched = false;

  const methods = contract((event) => {
    if (!stateDumpFetched) return;

    switch (event.type) {
      case "InboxEvent": {
        const syntheticId = synthesizeId(event.value.Inbox.global_id);
        const inbox = inboxes.get(syntheticId);
        if (inbox === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        commitInboxExpirationTime(inbox, event.value.Inbox.expiration_time);
        break;
      }
      case "MessageEvent": {
        const syntheticId = synthesizeId(event.value.Message.inbox_id);
        const inbox = inboxes.get(syntheticId);
        if (inbox === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        insertMessage(inbox, {
          sender: event.value.Message.message.sender,
          in_reply_to: event.value.Message.message.in_reply_to,
          disclosed_recipients:
            event.value.Message.message.disclosed_recipients,
          rich_text_format: event.value.Message.message.rich_text_format,
          content: event.value.Message.message.content,
          attachments: event.value.Message.message.attachments,
          expiration_time: event.value.Message.expiration_time,
          inbox_id: event.value.Message.inbox_id,
          global_id: event.value.Message.global_id,
          message_type: event.value.Message.message_type,
        });
        break;
      }
      case "MessageExpirationTimeExtended": {
        const syntheticId = synthesizeId(
          event.value.MessageExpirationTimeExtended.inbox_id
        );
        const inbox = inboxes.get(syntheticId);
        if (inbox === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }

        const syntheticMessageId = synthesizeId(
          event.value.MessageExpirationTimeExtended.global_id
        );
        const message = inbox.messages.get(syntheticMessageId);
        if (message === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }

        commitMessageExpirationTime(
          message,
          event.value.MessageExpirationTimeExtended.expiration_time
        );
        break;
      }
      case "MessageExpired": {
        const syntheticId = synthesizeId(event.value.MessageExpired.inbox_id);
        const inbox = inboxes.get(syntheticId);
        if (inbox === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }

        expireMessage(inbox, event.value.MessageExpired.global_id);
        break;
      }
    }
  });

  const operations = methods.dumpPendingOperations().then((operations) => {
    type AssociatedDataTaggedWithOperationId = {
      operationId: string;
      description: OperationDescription;
    };

    const operationMap = new Map<
      SyntheticId,
      AssociatedDataTaggedWithOperationId[]
    >();
    operations.PendingProofOfWorkOperations.forEach((operation) => {
      const { operation_id, associated_frontend_data } = operation;
      const validated = (() => {
        const parsed = JSON.parse(associated_frontend_data);
        if (!AssociatedFrontendData(parsed)) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        return parsed as AssociatedFrontendData;
      })();

      if (validated === undefined) {
        console.log(new Error("This should be unreachable."));
        return;
      }

      const { inboxId, description } = validated;
      const syntheticId = synthesizeId(inboxId);

      if (!operationMap.has(syntheticId)) {
        operationMap.set(syntheticId, []);
      }

      const taggedAssociatedDataArray = operationMap.get(syntheticId);
      if (taggedAssociatedDataArray === undefined) {
        console.log(new Error("This should be unreachable."));
        return;
      }

      taggedAssociatedDataArray.push({
        description,
        operationId: operation_id,
      });
    });

    return operationMap;
  });

  methods.dumpState().then((dump) => {
    stateDumpFetched = true;

    dump.StateDump.contacts.forEach((contact) =>
      insertContact(
        contacts,
        contact.global_id,
        contact.label,
        contact.public_encryption_key,
        contact.public_signing_key
      )
    );

    dump.StateDump.inboxes.forEach((inbox) =>
      insertInbox(
        inboxes,
        inbox.global_id,
        inbox.label,
        inbox.autosave_preference as "autosave" | "manual",
        {
          publicEncryptionKey: inbox.public_half.public_encryption_key,
          publicSigningKey: inbox.public_half.public_signing_key,
        }
      )
    );

    dump.StateDump.messages.forEach((message) => {
      const syntheticInboxId = synthesizeId(message.inbox_id);
      const inbox = inboxes.get(syntheticInboxId);
      if (inbox === undefined) {
        console.log(new Error("This should be unreachable."));
        return;
      }
      insertMessage(inbox, message);
    });

    dump.StateDump.inbox_expiration_times.forEach(
      ({ inbox_id, expiration_time }) => {
        const syntheticInboxId = synthesizeId(inbox_id);
        const inbox = inboxes.get(syntheticInboxId);
        if (inbox === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        commitInboxExpirationTime(inbox, expiration_time);
      }
    );
  });

  const insertContact = action(
    (
      contacts: Map<SyntheticContactId, Contact>,
      globalId: number[],
      name: string,
      publicEncryptionKey: number[],
      publicSigningKey: number[]
    ) => {
      const syntheticContactId = synthesizeContactId(
        publicEncryptionKey,
        publicSigningKey
      );
      contacts.set(syntheticContactId, {
        label: name,
        publicEncryptionKey,
        publicSigningKey,
        globalId,
        ephemeralLocalId: uuid(),
      });
    }
  );

  const insertInbox = action(
    (
      inboxes: Map<SyntheticId, Inbox>,
      globalId: number[],
      name: string,
      autosavePreference: "autosave" | "manual",
      publicHalf: PublicHalf
    ) => {
      const syntheticId = synthesizeId(globalId);

      inboxes.set(syntheticId, {
        globalId,
        label: name,
        autosavePreference,
        messages: new Map(),
        children: new Map(),
        expirationTime: undefined,
        publicHalf,
        pendingOperations: new Map(),
        unreadCount: 0,
        setUp: false,
        renewOperationCount: 0,
        setupOperationCount: 0,
        sendOperationCount: 0,
      });

      const inbox = inboxes.get(syntheticId);
      if (inbox === undefined) {
        console.log(new Error("This should be unreachable."));
        return;
      }

      testPredicate(synthesizeSetUpPredicate(globalId)).then(
        action((setUp) => {
          if (setUp === undefined) {
            console.log(new Error("This should be unreachable."));
            return;
          }
          inbox.setUp = setUp;
        })
      );

      operations.then(
        action((operations) => {
          const operationsForThisInbox = operations.get(syntheticId);
          if (operationsForThisInbox === undefined) {
            return;
          }

          operationsForThisInbox.forEach((operation) => {
            inbox.pendingOperations.set(operation.operationId, {
              description: operation.description,
              status: "pending",
              operationId: operation.operationId,
            });

            if (operation.description.type === "renew inbox") {
              inbox.renewOperationCount++;
            } else if (operation.description.type === "setup inbox") {
              inbox.setupOperationCount++;
            } else if (operation.description.type === "send message") {
              inbox.sendOperationCount++;
            }

            methods.waitOnOperation(operation.operationId).then(
              action((outcome) => {
                if (operation.description.type === "renew inbox") {
                  inbox.renewOperationCount--;
                } else if (operation.description.type === "setup inbox") {
                  inbox.setupOperationCount--;
                } else if (operation.description.type === "send message") {
                  inbox.sendOperationCount--;
                }

                if (outcome === "completed") {
                  const operationStatus = inbox.pendingOperations.get(
                    operation.operationId
                  );
                  if (operationStatus === undefined) {
                    console.log(new Error("This should be unreachable."));
                    return;
                  }

                  operationStatus.status = "completed";
                } else {
                  inbox.pendingOperations.delete(operation.operationId);
                }
              })
            );
          });
        })
      );
    }
  );

  const commitInboxExpirationTime = action(
    (inbox: Inbox, expirationTime: number) => {
      if (inbox.expirationTime === undefined) {
        inbox.expirationTime = expirationTime;
        return;
      }

      inbox.expirationTime = Math.max(inbox.expirationTime, expirationTime);
    }
  );

  const insertMessage = action((inbox: Inbox, storedMessage: StoredMessage) => {
    const syntheticId = synthesizeId(storedMessage.global_id);

    Promise.all([
      testPredicate(
        synthesizeReadPredicate(inbox.globalId, storedMessage.global_id)
      ),
      testPredicate(
        synthesizeHiddenPredicate(inbox.globalId, storedMessage.global_id)
      ),
    ]).then(
      action(([read, hidden]) => {
        if (read === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        if (hidden === undefined) {
          console.log(new Error("This should be unreachable."));
          return;
        }
        inbox.messages.set(syntheticId, {
          sender: {
            publicEncryptionKey: storedMessage.sender.public_encryption_key,
            publicSigningKey: storedMessage.sender.public_signing_key,
          },
          inReplyTo:
            storedMessage.in_reply_to === null
              ? undefined
              : storedMessage.in_reply_to,
          disclosedRecipients: storedMessage.disclosed_recipients.map(
            (recipient) => ({
              publicEncryptionKey: recipient.public_encryption_key,
              publicSigningKey: recipient.public_signing_key,
            })
          ),
          richTextFormat: storedMessage.rich_text_format as
            | "markdown"
            | "plaintext",
          content: storedMessage.content,
          attachments: storedMessage.attachments.map((attachment) => ({
            mimeType: attachment.mime_type,
            blob: attachment.blob,
          })),
          expirationTime:
            storedMessage.expiration_time === null
              ? undefined
              : storedMessage.expiration_time,
          globalId: storedMessage.global_id,
          messageType: storedMessage.message_type as "unsaved" | "saved",
          hidden,
          read,
        });

        if (!read) {
          inbox.unreadCount++;
        }
      })
    );

    if (storedMessage.in_reply_to !== null) {
      const syntheticParentId = synthesizeId(storedMessage.in_reply_to);
      if (inbox.children.get(syntheticParentId) === undefined) {
        inbox.children.set(
          syntheticParentId,
          observable(new Set<SyntheticId>())
        );
      }

      const childrenList = inbox.children.get(syntheticParentId);
      if (childrenList === undefined) {
        console.log(new Error("This should be unreachable."));
        return;
      }
      childrenList.add(syntheticId);
    }
  });

  const commitMessageExpirationTime = action(
    (message: Message, expirationTime: number) => {
      message.expirationTime = expirationTime;
    }
  );

  const expireMessage = action((inbox: Inbox, messageId: number[]) => {
    const syntheticId = synthesizeId(messageId);
    const message = inbox.messages.get(syntheticId);
    if (message === undefined) {
      console.log(new Error("This should be unreachable."));
      return;
    }

    if (!message.read) {
      inbox.unreadCount--;
    }

    if (message.inReplyTo !== undefined) {
      const syntheticParentId = synthesizeId(message.inReplyTo);
      const set = inbox.children.get(syntheticParentId);
      if (set !== undefined) {
        set.delete(syntheticId);
        if (set.size === 0) {
          inbox.children.delete(syntheticParentId);
        }
      }
    }

    inbox.messages.delete(syntheticId);
  });

  return methods;
})();

export type PublicHalf = {
  publicEncryptionKey: number[];
  publicSigningKey: number[];
};

export type Attachment = {
  mimeType: string;
  blob: number[];
};

export type Message = {
  sender: PublicHalf;
  inReplyTo: number[] | undefined;
  disclosedRecipients: PublicHalf[];
  richTextFormat: "markdown" | "plaintext";
  content: string;
  attachments: Attachment[];
  expirationTime: number | undefined;
  globalId: number[];
  messageType: "unsaved" | "saved";
  hidden: boolean;
  read: boolean;
};

export type Contact = {
  label: string;
  ephemeralLocalId: string;
  globalId: number[];
  publicEncryptionKey: number[];
  publicSigningKey: number[];
};

export type SyntheticId = string & { __syntheticId: boolean };
export type SyntheticContactId = string & { __syntheticContactId: boolean };

export const synthesizeId = (id: number[]) => JSON.stringify(id) as SyntheticId;
export const synthesizeContactId = (
  publicEncryptionKey: number[],
  publicSigningKey: number[]
) =>
  JSON.stringify([publicEncryptionKey, publicSigningKey]) as SyntheticContactId;

export const RecipientDescription = t.union([
  t.struct({
    type: t.refinement(t.String, (string) => string === "named"),
    name: t.String,
  }),
  t.struct({
    type: t.refinement(t.String, (string) => string === "unnamed"),
    firstTenBytesInBase32: t.String,
  }),
]);

export type RecipientDescription =
  | {
      type: "named";
      name: string;
    }
  | { type: "unnamed" }
  | { type: "hidden" };

export const OperationDescription = t.union([
  t.struct({
    type: t.refinement(t.String, (string) => string === "renew inbox"),
  }),
  t.struct({
    type: t.refinement(t.String, (string) => string === "setup inbox"),
  }),
  t.struct({
    type: t.refinement(t.String, (string) => string === "send message"),
    recipients: t.list(RecipientDescription),
  }),
]);

export type OperationDescription =
  | {
      type: "renew inbox";
    }
  | {
      type: "setup inbox";
    }
  | {
      type: "send message";
      recipients: RecipientDescription[];
    };

export const AssociatedFrontendData = t.struct({
  inboxId: t.list(t.Number),
  description: OperationDescription,
});

type OperationStatus = {
  operationId: string;
  description: OperationDescription;
  status: "pending" | "completed";
};

export type AssociatedFrontendData = {
  inboxId: number[];
  description: OperationDescription;
};

export type Inbox = {
  globalId: number[];
  label: string;
  autosavePreference: "autosave" | "manual";
  messages: Map<SyntheticId, Message>;
  children: Map<SyntheticId, Set<SyntheticId>>;
  expirationTime: number | undefined;
  publicHalf: PublicHalf;
  pendingOperations: Map<string, OperationStatus>;
  unreadCount: number;
  setUp: boolean;
  renewOperationCount: number;
  setupOperationCount: number;
  sendOperationCount: number;
};

type Predicate = string & { __predicate: boolean };

const synthesizeReadPredicate = (inboxId: number[], messageId: number[]) =>
  JSON.stringify([inboxId, messageId, "read"]) as Predicate;
const synthesizeHiddenPredicate = (inboxId: number[], messageId: number[]) =>
  JSON.stringify([inboxId, messageId, "hidden"]) as Predicate;
const synthesizeSetUpPredicate = (inboxId: number[]) =>
  JSON.stringify([inboxId, "setup"]) as Predicate;

const testPredicate = (predicate: Predicate) =>
  localforage
    .getItem(predicate)
    .then((value) => value !== null)
    .catch((error) => {
      console.log(error, new Error("This should be unreachable."));
    });
const setPredicate = (predicate: Predicate) =>
  void localforage.setItem(predicate, "").catch((error) => {
    console.log(error, new Error("This should be unreachable."));
  });
const clearPredicate = (predicate: Predicate) =>
  void localforage.removeItem(predicate).catch((error) => {
    console.log(error, new Error("This should be unreachable."));
  });

export const markMessageAsRead = action((inbox: Inbox, messageId: number[]) => {
  const syntheticId = synthesizeId(messageId);
  const message = inbox.messages.get(syntheticId);
  if (message === undefined) {
    console.log(new Error("This should be unreachable."));
    return;
  }

  if (!message.read) {
    inbox.unreadCount--;
  }

  message.read = true;
  setPredicate(synthesizeReadPredicate(inbox.globalId, messageId));
});

export const saveMessage = action((inbox: Inbox, messageId: number[]) => {
  const syntheticId = synthesizeId(messageId);
  const message = inbox.messages.get(syntheticId);
  if (message === undefined) {
    console.log(new Error("This should be unreachable."));
    return;
  }

  message.messageType = "saved";
  methods.saveMessage(messageId, inbox.globalId);
});

export const unsaveMessage = action((inbox: Inbox, messageId: number[]) => {
  const syntheticId = synthesizeId(messageId);
  const message = inbox.messages.get(syntheticId);
  if (message === undefined) {
    console.log(new Error("This should be unreachable."));
    return;
  }

  message.messageType = "unsaved";
  methods.unsaveMessage(messageId, inbox.globalId);
});

export const hideMessage = action((inbox: Inbox, messageId: number[]) => {
  const syntheticId = synthesizeId(messageId);
  const message = inbox.messages.get(syntheticId);
  if (message === undefined) {
    console.log(new Error("This should be unreachable."));
    return;
  }

  message.hidden = true;
  unsaveMessage(inbox, messageId);
  setPredicate(synthesizeHiddenPredicate(inbox.globalId, messageId));
});

export const unhideMessage = action((inbox: Inbox, messageId: number[]) => {
  const syntheticId = synthesizeId(messageId);
  const message = inbox.messages.get(syntheticId);
  if (message === undefined) {
    console.log(new Error("This should be unreachable."));
    return;
  }

  message.hidden = false;
  if (inbox.autosavePreference === "autosave") {
    saveMessage(inbox, messageId);
  }
  clearPredicate(synthesizeHiddenPredicate(inbox.globalId, messageId));
});

export const addInbox = action(
  (inboxes: Map<SyntheticId, Inbox>, name: string) => {
    methods.addInbox(name).then(
      action((createdInbox) => {
        const globalId = createdInbox.CreatedInbox.id;
        const syntheticId = synthesizeId(globalId);
        inboxes.set(syntheticId, {
          globalId,
          label: name,
          autosavePreference: "manual",
          messages: new Map(),
          children: new Map(),
          expirationTime: undefined,
          publicHalf: {
            publicEncryptionKey:
              createdInbox.CreatedInbox.public_half.public_encryption_key,
            publicSigningKey:
              createdInbox.CreatedInbox.public_half.public_signing_key,
          },
          pendingOperations: new Map(),
          unreadCount: 0,
          setUp: false,
          renewOperationCount: 0,
          setupOperationCount: 0,
          sendOperationCount: 0,
        });
      })
    );
  }
);

export const setAutosavePreference = action(
  (inbox: Inbox, autosavePreference: "autosave" | "manual") => {
    inbox.autosavePreference = autosavePreference;
    methods.setAutosavePreference(inbox.globalId, autosavePreference);
  }
);

export const markInboxAsSetUp = action((inbox: Inbox) => {
  inbox.setUp = true;
  setPredicate(synthesizeSetUpPredicate(inbox.globalId));
});

export const publishPublicHalfEntry = (
  inbox: Inbox,
  setupOrRenew: "renew inbox" | "setup inbox"
) => {
  const sevenDaysFromNow = Math.trunc(Date.now() / 1000 + 86400 * 7);

  const associatedFrontendData: AssociatedFrontendData = {
    inboxId: inbox.globalId,
    description: {
      type: setupOrRenew,
    },
  };

  methods.getPublicHalfEntry(inbox.globalId).then(
    action((entry) => {
      const [promise, operationId] = methods.insertMessage(
        entry.PublicHalfEntry,
        sevenDaysFromNow,
        JSON.stringify(associatedFrontendData)
      );

      inbox.pendingOperations.set(operationId, {
        description: { type: setupOrRenew },
        status: "pending",
        operationId,
      });

      if (setupOrRenew === "setup inbox") {
        inbox.setupOperationCount++;
      } else if (setupOrRenew === "renew inbox") {
        inbox.renewOperationCount++;
      }

      promise.then(
        action((outcome) => {
          if (setupOrRenew === "setup inbox") {
            inbox.setupOperationCount--;
          } else if (setupOrRenew === "renew inbox") {
            inbox.renewOperationCount--;
          }

          if (outcome === "completed") {
            const operationStatus = inbox.pendingOperations.get(operationId);
            if (operationStatus === undefined) {
              console.log(new Error("This should be unreachable."));
              return;
            }

            operationStatus.status = "completed";
          } else {
            inbox.pendingOperations.delete(operationId);
          }
        })
      );
    })
  );
};

export const renameInbox = action((inbox: Inbox, name: string) => {
  inbox.label = name;
  methods.renameInbox(inbox.globalId, name);
});

export const deleteInbox = action(
  (inboxes: Map<SyntheticId, Inbox>, inbox: Inbox) => {
    inbox.pendingOperations.forEach((operation) => {
      methods.cancelSubmitOperation(operation.operationId);
    });

    const syntheticId = synthesizeId(inbox.globalId);
    inboxes.delete(syntheticId);
    methods.deleteInbox(inbox.globalId);
    localforage.iterate((_, key) => {
      const syntheticPredicateInboxId = synthesizeId(
        JSON.parse(key)[0] as number[]
      );
      if (syntheticId === syntheticPredicateInboxId) {
        localforage.removeItem(key).catch((error) => {
          console.log(error, new Error("This should be unreachable."));
        });
      }
    });
  }
);

export const addContact = action(
  (
    contacts: Map<SyntheticContactId, Contact>,
    name: string,
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) => {
    methods.addContact(name, publicEncryptionKey, publicSigningKey).then(
      action(({ ContactId: globalId }) => {
        const syntheticContactId = synthesizeContactId(
          publicEncryptionKey,
          publicSigningKey
        );
        contacts.set(syntheticContactId, {
          label: name,
          publicEncryptionKey,
          publicSigningKey,
          globalId,
          ephemeralLocalId: uuid(),
        });
      })
    );
  }
);

export const setContactPublicHalf = action(
  (
    contacts: Map<SyntheticContactId, Contact>,
    contact: Contact,
    publicEncryptionKey: number[],
    publicSigningKey: number[]
  ) => {
    const syntheticId = synthesizeContactId(
      contact.publicEncryptionKey,
      contact.publicSigningKey
    );

    contacts.delete(syntheticId);

    methods
      .setPublicHalf(contact.globalId, publicEncryptionKey, publicSigningKey)
      .then(
        action(({ ContactId: globalId }) => {
          contact.globalId = globalId;
          contact.publicEncryptionKey = publicEncryptionKey;
          contact.publicSigningKey = publicSigningKey;

          const syntheticId = synthesizeContactId(
            contact.publicEncryptionKey,
            contact.publicSigningKey
          );

          contacts.set(syntheticId, contact);
        })
      );
  }
);

export const renameContact = action((contact: Contact, name: string) => {
  contact.label = name;
  methods.renameContact(contact.globalId, name);
});

export const lookupPublicHalf = (firstTenBytes: number[]) =>
  methods.lookupPublicHalf(firstTenBytes).then((publicHalves) =>
    publicHalves.PublicHalves.map((publicHalf) => ({
      publicEncryptionKey: publicHalf.public_encryption_key,
      publicSigningKey: publicHalf.public_signing_key,
    }))
  );

export const deleteContact = action(
  (contacts: Map<SyntheticContactId, Contact>, contact: Contact) => {
    methods.deleteContact(contact.globalId);
    contacts.delete(
      synthesizeContactId(contact.publicEncryptionKey, contact.publicSigningKey)
    );
  }
);

export const sendMessage = (
  inbox: Inbox,
  inReplyTo: number[] | undefined,
  disclosedRecipients: PublicHalf[],
  richTextFormat: "markdown" | "plaintext",
  content: string,
  attachments: Attachment[],
  hiddenRecipients: PublicHalf[],
  expirationTime: number
) => {
  methods
    .encodeMessage(
      inReplyTo,
      disclosedRecipients.map(
        ({
          publicEncryptionKey: public_encryption_key,
          publicSigningKey: public_signing_key,
        }) => ({
          public_encryption_key,
          public_signing_key,
        })
      ),
      richTextFormat,
      content,
      attachments.map(({ mimeType: mime_type, blob }) => ({
        mime_type,
        blob,
      })),
      hiddenRecipients.map(({ publicEncryptionKey }) => publicEncryptionKey),
      inbox.globalId
    )
    .then((encoded) => {
      const associatedFrontendData: AssociatedFrontendData = {
        inboxId: inbox.globalId,
        description: {
          type: "send message",
          recipients: [
            ...hiddenRecipients.map(
              () => ({ type: "hidden" } as { type: "hidden" })
            ),
            ...disclosedRecipients.map(
              ({ publicEncryptionKey, publicSigningKey }) => {
                const contact = contacts.get(
                  synthesizeContactId(publicEncryptionKey, publicSigningKey)
                );
                if (contact === undefined) {
                  return { type: "unnamed" } as { type: "unnamed" };
                }
                return { type: "named", name: contact.label } as {
                  type: "named";
                  name: string;
                };
              }
            ),
          ],
        },
      };
      const [promise, operationId] = methods.insertMessage(
        encoded.EncodedMessage,
        expirationTime,
        JSON.stringify(associatedFrontendData)
      );

      inbox.pendingOperations.set(operationId, {
        description: associatedFrontendData.description,
        status: "pending",
        operationId,
      });

      inbox.sendOperationCount++;

      promise.then(
        action((outcome) => {
          inbox.sendOperationCount--;

          if (outcome === "completed") {
            const operationStatus = inbox.pendingOperations.get(operationId);
            if (operationStatus === undefined) {
              console.log(new Error("This should be unreachable."));
              return;
            }

            operationStatus.status = "completed";
          } else {
            inbox.pendingOperations.delete(operationId);
          }
        })
      );
    });
};

export const inboxes = observable(new Map<SyntheticId, Inbox>());
export const contacts = observable(new Map<SyntheticContactId, Contact>());
