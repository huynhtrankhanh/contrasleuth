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
            <Theme.Space />
            <motion.div
              layoutTransition={underDampedSpring}
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <InboxCard inbox={inbox} displayInboxNotifications={false} />
              <Theme.Space />
              <CopyInboxId base32EncodedShortId={base32EncodedShortId} />
              <Theme.Space />
              <Link to={"/settings/" + base32EncodedId}>
                <Localized id="inbox-settings">
                  <Theme.Button />
                </Localized>
              </Link>
              <Theme.Space />
              <Localized id="go-back">
                <Theme.Button onClick={() => history.goBack()} />
              </Localized>
              <Theme.Space />
              <Theme.ItemWithDetails
                onClick={() => {
                  const pendingOperations =
                    inbox.setupOperationCount > 0 ||
                    inbox.renewOperationCount > 0;
                  if (!pendingOperations) {
                    publishPublicHalfEntry(inbox, "renew inbox");
                  }
                }}
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
                  <Theme.Space />
                  <Theme.ItemWithDetails>
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
              <Theme.Space />
              <Localized id="search-inbox">
                <InboxSearchInput
                  inboxLabel={inboxLabel}
                  setSearchQuery={setSearchQuery}
                  controls={inputControls}
                />
              </Localized>
              <Theme.Space />

              <Theme.ItemNotifications>
                Unread replies, unsaved
              </Theme.ItemNotifications>
              <Theme.ItemWithDetails className="no-top-rounded-corners">
                <div>
                  <Theme.Deemphasize>(unknown)</Theme.Deemphasize> Sender Name{" "}
                  <Theme.Deemphasize>
                    (a reply to another message, expires in 6 hours)
                  </Theme.Deemphasize>
                </div>
                <div className="no-italic height-cap">Hello, World!</div>
              </Theme.ItemWithDetails>
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default InboxDetails;
