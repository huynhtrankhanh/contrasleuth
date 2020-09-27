import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { Link } from "react-router-dom";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { Inbox, publishPublicHalfEntry, synthesizeId } from "../store";
import { observer } from "mobx-react";
import InboxCard from "../components/InboxCard";
import CopyInboxId from "../components/CopyInboxId";
import useTimestamp from "../useTimestamp";
import moment from "moment/min/moment-with-locales";
import * as base32 from "hi-base32";
import MessagePreview from "../components/MessagePreview";

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
    const controls = useAnimation();
    const history = useHistory();
    const now = useTimestamp();
    const [showHiddenMessages, setShowHiddenMessages] = useState(false);

    useEffect(() => {
      if (page === "inbox") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
          setShowHiddenMessages(false);
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
          <Theme.Header layout />
        </Localized>
        {flag && (
          <>
            <Theme.Space layout />
            <motion.div
              layout
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <InboxCard inbox={inbox} displayInboxNotifications={false} />
              <Theme.Space layout />
              <CopyInboxId base32EncodedShortId={base32EncodedShortId} />
              <Theme.Space layout />
              <Link to={"/settings/" + base32EncodedId}>
                <Localized id="inbox-settings">
                  <Theme.Button layout />
                </Localized>
              </Link>
              <Theme.Space layout />
              <Localized id="go-back">
                <Theme.Button onClick={() => history.goBack()} layout />
              </Localized>
              <Theme.Space layout />
              <Theme.ItemWithDetails
                onClick={() => {
                  const pendingOperations =
                    inbox.setupOperationCount > 0 ||
                    inbox.renewOperationCount > 0;
                  if (!pendingOperations) {
                    publishPublicHalfEntry(inbox, "renew inbox");
                  }
                }}
                layout
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
                  <Theme.Space layout />
                  <Theme.ItemWithDetails layout>
                    <Localized
                      id="processing-messages"
                      vars={{ messageCount: inbox.sendOperationCount }}
                    >
                      <div />
                    </Localized>
                  </Theme.ItemWithDetails>
                </>
              )}
              <Theme.Space layout />
              <Link to={"/compose/" + base32EncodedId}>
                <Theme.Button layout>
                  <Localized id="compose-message" />
                </Theme.Button>
              </Link>
              <Theme.Space layout />
              {[...inbox.messages.values()].reduce(
                (accumulated, current) => accumulated + Number(current.hidden),
                0
              ) > 0 && (
                <>
                  {showHiddenMessages ? (
                    <>
                      <Theme.Button
                        layout
                        onClick={() => setShowHiddenMessages(false)}
                      >
                        <Localized id="hide-hidden-messages" />
                      </Theme.Button>
                      {[...inbox.messages.values()]
                        .reverse()
                        .filter(({ hidden }) => hidden)
                        .map((message) => (
                          <>
                            <Theme.Space layout />
                            <Link
                              to={
                                "/message/" +
                                base32EncodedId +
                                "/" +
                                base32.encode(message.globalId)
                              }
                            >
                              <MessagePreview inbox={inbox} message={message} />
                            </Link>
                          </>
                        ))}
                    </>
                  ) : (
                    <Theme.Button
                      layout
                      onClick={() => setShowHiddenMessages(true)}
                    >
                      <Localized id="show-hidden-messages" />
                    </Theme.Button>
                  )}
                  {inbox.messages.size > 0 && (
                    <>
                      <Theme.Space layout />
                      <motion.hr layout />
                    </>
                  )}
                </>
              )}
              {[...inbox.messages.values()]
                .reverse()
                .filter(({ hidden }) => !hidden)
                .map((message) => (
                  <React.Fragment key={synthesizeId(message.globalId)}>
                    <Theme.Space layout />
                    <Link
                      to={
                        "/message/" +
                        base32EncodedId +
                        "/" +
                        base32.encode(message.globalId)
                      }
                    >
                      <MessagePreview inbox={inbox} message={message} />
                    </Link>
                  </React.Fragment>
                ))}
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default InboxDetails;
