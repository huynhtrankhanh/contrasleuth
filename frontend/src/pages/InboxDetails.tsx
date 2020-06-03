import React, { useState, useEffect } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { Link } from "react-router-dom";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { Inbox, publishPublicHalfEntry } from "../store";
import underDampedSpring from "../underDampedSpring";
import { observer } from "mobx-react";
import InboxCard from "../components/InboxCard";
import CopyInboxId from "../components/CopyInboxId";
import useTimestamp from "../useTimestamp";
import moment from "moment";
import * as base32 from "hi-base32";
import MessagePreview from "../components/MessagePreview";

const InboxSearchInput = ({
  children,
  inboxLabel,
  setSearchQuery,
  controls,
}: {
  children?: string;
  inboxLabel: string;
  setSearchQuery: (value: string) => void;
  controls: AnimationControls;
}) => (
  <Theme.Input
    placeholder={children}
    value={inboxLabel}
    onChange={(event) => setSearchQuery(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const InboxDetails = observer(
  ({
    page,
    shouldEnter,
    setShouldEnter,
    inbox,
  }: {
    page: Page;
    shouldEnter: boolean;
    setShouldEnter: (value: boolean) => void;
    inbox: Inbox | null;
  }) => {
    const [visible, setVisible] = useState(false);
    const [flag, setFlag] = useState(false);
    const [inboxLabel, setSearchQuery] = useState("");
    const controls = useAnimation();
    const inputControls = useAnimation();
    const history = useHistory();
    const now = useTimestamp();

    useEffect(() => {
      if (page === "inbox") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
          setSearchQuery("");
        }
      } else {
        if (visible) {
          controls
            .start({
              opacity: 0,
              transform: "scale(1.5)",
            })
            .then(() => {
              setVisible(false);
              setFlag(false);
              setShouldEnter(true);
            });
        }
      }
      // eslint-disable-next-line
    }, [page, shouldEnter]);

    useEffect(() => {
      if (visible)
        controls
          .start({
            opacity: 1,
            transform: "scale(1)",
          })
          .then(() => {
            setFlag(true);
          });
      // eslint-disable-next-line
    }, [visible]);

    if (inbox === null) return null;
    if (!visible) return null;

    const base32EncodedId = base32.encode(inbox.globalId);
    const base32EncodedShortId = base32.encode(inbox.globalId.slice(0, 10));

    return (
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
      >
        <Localized id="inbox">
          <Theme.Header layoutTransition={underDampedSpring} />
        </Localized>
        {flag && (
          <>
            <Theme.Space layoutTransition={underDampedSpring} />
            <motion.div
              layoutTransition={underDampedSpring}
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <InboxCard inbox={inbox} displayInboxNotifications={false} />
              <Theme.Space layoutTransition={underDampedSpring} />
              <CopyInboxId base32EncodedShortId={base32EncodedShortId} />
              <Theme.Space layoutTransition={underDampedSpring} />
              <Link to={"/settings/" + base32EncodedId}>
                <Localized id="inbox-settings">
                  <Theme.Button layoutTransition={underDampedSpring} />
                </Localized>
              </Link>
              <Theme.Space layoutTransition={underDampedSpring} />
              <Localized id="go-back">
                <Theme.Button
                  onClick={() => history.goBack()}
                  layoutTransition={underDampedSpring}
                />
              </Localized>
              <Theme.Space layoutTransition={underDampedSpring} />
              <Theme.ItemWithDetails
                onClick={() => {
                  const pendingOperations =
                    inbox.setupOperationCount > 0 ||
                    inbox.renewOperationCount > 0;
                  if (!pendingOperations) {
                    publishPublicHalfEntry(inbox, "renew inbox");
                  }
                }}
                layoutTransition={underDampedSpring}
              >
                {inbox.setupOperationCount > 0 ? (
                  <>
                    <Localized id="inbox-setup-in-progress">
                      <div />
                    </Localized>
                    <Localized id="inbox-expired-explanation">
                      <div />
                    </Localized>
                  </>
                ) : inbox.renewOperationCount > 0 ? (
                  <>
                    <Localized id="inbox-renewal-in-progress">
                      <div />
                    </Localized>
                    <Localized id="inbox-renewal-in-progress-explanation">
                      <div />
                    </Localized>
                  </>
                ) : inbox.expirationTime === undefined ||
                  inbox.expirationTime <= now ? (
                  <>
                    <Localized id="inbox-expired">
                      <div />
                    </Localized>
                    <Localized id="inbox-expired-explanation-call-to-action">
                      <div />
                    </Localized>
                  </>
                ) : (
                  <>
                    <Localized
                      id="inbox-expires-in"
                      vars={{
                        formattedRelativeTime: moment
                          .duration(
                            moment(inbox.expirationTime * 1000).diff(
                              moment(now * 1000)
                            )
                          )
                          .humanize(),
                      }}
                    >
                      <div />
                    </Localized>
                    <Localized id="tap-to-renew">
                      <div />
                    </Localized>
                  </>
                )}
              </Theme.ItemWithDetails>
              {inbox.sendOperationCount > 0 && (
                <>
                  <Theme.Space layoutTransition={underDampedSpring} />
                  <Theme.ItemWithDetails layoutTransition={underDampedSpring}>
                    <Localized
                      id="processing-messages"
                      vars={{ messageCount: inbox.sendOperationCount }}
                    >
                      <div />
                    </Localized>
                    <Localized id="tap-to-view">
                      <div />
                    </Localized>
                  </Theme.ItemWithDetails>
                </>
              )}
              <Theme.Space layoutTransition={underDampedSpring} />
              <Theme.Button layoutTransition={underDampedSpring}>
                <Localized id="compose-message" />
              </Theme.Button>
              <Theme.Space layoutTransition={underDampedSpring} />
              <Localized id="search-inbox">
                <InboxSearchInput
                  inboxLabel={inboxLabel}
                  setSearchQuery={setSearchQuery}
                  controls={inputControls}
                />
              </Localized>
              {[...inbox.messages.values()].reverse().map((message) => (
                <>
                  <Theme.Space layoutTransition={underDampedSpring} />
                  <MessagePreview inbox={inbox} message={message} />
                </>
              ))}
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default InboxDetails;
