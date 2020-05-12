import React, { useState, useEffect } from "react";
import * as Theme from "../theme";
import { observer } from "mobx-react";
import { Inbox } from "../store";
import { Localized } from "@fluent/react";
import underDampedSpring from "../underDampedSpring";
import base32 from "hi-base32";

const useTimestamp = () => {
  const [timestamp, setTimestamp] = useState(Math.trunc(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(
      () => setTimestamp(Math.trunc(Date.now() / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, []);
  return timestamp;
};

const InboxCard = observer(
  ({
    inbox,
    displayInboxNotifications,
  }: {
    inbox: Inbox;
    displayInboxNotifications: boolean;
  }) => {
    const base32EncodedShortId = base32.encode(inbox.globalId.slice(0, 10));

    const now = useTimestamp();

    const unread = inbox.unreadCount > 0;
    const expired =
      inbox.expirationTime === undefined || inbox.expirationTime <= now;
    const newlyCreated = !inbox.setUp;
    const pendingTasks =
      [...inbox.pendingOperations.values()].filter(
        (operation) => operation.status === "pending"
      ).length > 0;
    const inboxRenewalInProgress = [...inbox.pendingOperations.values()]
      .filter((operation) => operation.status === "pending")
      .some((operation) => operation.description.type === "announce inbox");

    const displayTopRoundedCorners =
      !displayInboxNotifications || (!unread && !expired && !newlyCreated);

    return (
      <>
        {displayInboxNotifications &&
          (newlyCreated ? (
            <Localized id="inbox-not-set-up">
              <Theme.InboxNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : inboxRenewalInProgress ? (
            <Localized id="inbox-renewal-in-progress">
              <Theme.InboxNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : unread && expired ? (
            <Localized
              id={
                pendingTasks
                  ? "inbox-notification-pending-unread-expired"
                  : "inbox-notification-unread-expired"
              }
              vars={{ unreadCount: inbox.unreadCount }}
            >
              <Theme.InboxNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : unread ? (
            <Localized
              id={
                pendingTasks
                  ? "inbox-notification-pending-unread"
                  : "inbox-notification-unread"
              }
              vars={{ unreadCount: inbox.unreadCount }}
            >
              <Theme.InboxNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : expired ? (
            <Localized
              id={
                pendingTasks
                  ? "inbox-notification-pending-expired"
                  : "inbox-notification-expired"
              }
            >
              <Theme.InboxNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : null)}
        <Theme.Item
          layoutTransition={underDampedSpring}
          className={displayTopRoundedCorners ? "" : "no-top-rounded-corners"}
        >
          <div>{inbox.label}</div>
          <Localized
            id="interpolated-inbox-id"
            vars={{ inboxId: base32EncodedShortId }}
          >
            <div />
          </Localized>
        </Theme.Item>
      </>
    );
  }
);

export default InboxCard;
