import React from "react";
import { observer } from "mobx-react";
import {
  Inbox,
  Message,
  synthesizeId,
  synthesizeContactId,
  contacts,
  Contact,
} from "../store";
import * as Theme from "../theme";
import { Localized } from "@fluent/react";
import base32 from "hi-base32";
import calculatePublicHalfId from "../calculatePublicHalfId";
import moment from "moment/min/moment-with-locales";
import useTimestamp from "../useTimestamp";

const MessagePreview = observer(
  ({
    inbox,
    message,
    parent = false,
  }: {
    inbox: Inbox;
    message: Message;
    parent?: boolean;
  }) => {
    const unread = !message.read;
    const unreadReplies = (() => {
      const syntheticId = synthesizeId(message.globalId);
      const children = inbox.children.get(syntheticId);
      if (children === undefined) {
        return false;
      }

      return [...children].some((syntheticId) => {
        const reply = inbox.messages.get(syntheticId);
        if (reply === undefined) return false;
        return !reply.read;
      });
    })();
    const unsaved = message.messageType === "unsaved";
    const displayTopRoundedCorners =
      !unread && !unreadReplies && !unsaved && !parent;

    type Sender =
      | { type: "unknown"; base32EncodedShortId: string }
      | { type: "contact"; contact: Contact };

    const sender = ((): Sender => {
      const syntheticId = synthesizeContactId(
        message.sender.publicEncryptionKey,
        message.sender.publicSigningKey
      );
      const contact = contacts.get(syntheticId);

      if (contact === undefined) {
        return {
          type: "unknown",
          base32EncodedShortId: base32.encode(
            calculatePublicHalfId(
              message.sender.publicEncryptionKey,
              message.sender.publicSigningKey
            ).slice(0, 10)
          ),
        };
      }

      return { type: "contact", contact };
    })();

    const now = useTimestamp();

    return (
      <>
        {parent ? (
          <Theme.ItemNotifications layout>
            <Localized id="parent-message" />
          </Theme.ItemNotifications>
        ) : unread && unsaved ? (
          <Theme.ItemNotifications layout>
            <Localized id="message-unread-unsaved" />
          </Theme.ItemNotifications>
        ) : unreadReplies && unsaved ? (
          <Theme.ItemNotifications layout>
            <Localized id="replies-unread-unsaved" />
          </Theme.ItemNotifications>
        ) : unsaved ? (
          <Theme.ItemNotifications layout>
            <Localized id="message-unsaved" />
          </Theme.ItemNotifications>
        ) : unread ? (
          <Theme.ItemNotifications layout>
            <Localized id="message-unread" />
          </Theme.ItemNotifications>
        ) : unreadReplies ? (
          <Theme.ItemNotifications layout>
            <Localized id="replies-unread" />
          </Theme.ItemNotifications>
        ) : null}
        <Theme.ItemWithDetails
          layout
          className={displayTopRoundedCorners ? "" : "no-top-rounded-corners"}
        >
          <div>
            {sender.type === "unknown" ? (
              <>
                <Theme.Deemphasize>
                  <Localized id="unknown" />
                </Theme.Deemphasize>{" "}
                {sender.base32EncodedShortId}
              </>
            ) : sender.type === "contact" ? (
              <>{sender.contact.label}</>
            ) : null}
            {(() => {
              return message.expirationTime !== undefined &&
                message.messageType === "unsaved" &&
                message.inReplyTo !== undefined ? (
                <>
                  {" "}
                  <Theme.Deemphasize>
                    <Localized
                      id="message-is-a-reply-expires-in"
                      vars={{
                        formattedRelativeTime: moment
                          .duration(
                            moment(message.expirationTime * 1000).diff(
                              moment(
                                Math.min(
                                  now * 1000,
                                  message.expirationTime * 1000
                                )
                              )
                            )
                          )
                          .humanize(),
                      }}
                    />
                  </Theme.Deemphasize>
                </>
              ) : message.expirationTime !== undefined &&
                message.messageType === "unsaved" ? (
                <>
                  {" "}
                  <Theme.Deemphasize>
                    <Localized
                      id="message-expires-in"
                      vars={{
                        formattedRelativeTime: moment
                          .duration(
                            moment(message.expirationTime * 1000).diff(
                              moment(
                                Math.min(
                                  now * 1000,
                                  message.expirationTime * 1000
                                )
                              )
                            )
                          )
                          .humanize(),
                      }}
                    />
                  </Theme.Deemphasize>
                </>
              ) : message.inReplyTo !== undefined ? (
                <>
                  {" "}
                  <Theme.Deemphasize>
                    <Localized id="message-is-a-reply" />
                  </Theme.Deemphasize>
                </>
              ) : null;
            })()}
          </div>
          <div className="no-italic height-cap">
            {message.attachments.length > 0 && (
              <>
                <Theme.Deemphasize>
                  <Localized id="attachment-included" />
                </Theme.Deemphasize>{" "}
              </>
            )}
            {message.content}
          </div>
        </Theme.ItemWithDetails>
      </>
    );
  }
);
export default MessagePreview;
