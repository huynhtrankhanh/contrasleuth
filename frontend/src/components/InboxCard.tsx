import React from "react";
import * as Theme from "../theme";
import { observer } from "mobx-react";
import { Inbox } from "../store";
import { Localized } from "@fluent/react";
import underDampedSpring from "../underDampedSpring";
import base32 from "hi-base32";
import useTimestamp from "../useTimestamp";

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
    const pendingTasks = inbox.sendOperationCount > 0;
    const inboxRenewalInProgress = inbox.renewOperationCount > 0;
    const inboxSetupInProgress = inbox.setupOperationCount > 0;

    const displayTopRoundedCorners =
      !displayInboxNotifications ||
      (!unread &&
        !expired &&
        !newlyCreated &&
        !inboxRenewalInProgress &&
        !inboxSetupInProgress &&
        !pendingTasks);

    return (
      <>
        {displayInboxNotifications &&
          (newlyCreated ? (
            <Localized id="inbox-not-set-up">
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : inboxSetupInProgress ? (
            <Localized id="inbox-setup-in-progress">
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : inboxRenewalInProgress ? (
            <Localized id="inbox-renewal-in-progress">
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
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
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
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
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : expired ? (
            <Localized
              id={
                pendingTasks
                  ? "inbox-notification-pending-expired"
                  : "inbox-notification-expired"
              }
            >
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : pendingTasks ? (
            <Localized id="inbox-notification-pending">
              <Theme.ItemNotifications layoutTransition={underDampedSpring} />
            </Localized>
          ) : null)}
        <Theme.Item
          layoutTransition={underDampedSpring}
          className={displayTopRoundedCorners ? "" : "no-top-rounded-corners"}
        >
          <div style={{ textOverflow: "ellipsis", overflow: "hidden" }}>
            {inbox.label}
          </div>
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
