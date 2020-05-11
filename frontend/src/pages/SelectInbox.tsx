import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { Link } from "react-router-dom";
import { inboxes, synthesizeId } from "../store";
import { observer } from "mobx-react";
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

const SelectInbox = observer(
  ({
    page,
    shouldEnter,
    setShouldEnter,
  }: {
    page: Page;
    shouldEnter: boolean;
    setShouldEnter: (value: boolean) => void;
  }) => {
    const [visible, setVisible] = useState(false);
    const [flag, setFlag] = useState(false);
    const controls = useAnimation();

    useEffect(() => {
      if (page === "select inbox") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
        }
      } else if (visible) {
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
      // eslint-disable-next-line
    }, [page, shouldEnter]);

    useEffect(() => {
      if (visible)
        controls
          .start({
            opacity: 1,
            transform: "scale(1)",
          })
          .then(() => setFlag(true));
      // eslint-disable-next-line
    }, [visible]);

    const now = useTimestamp();

    if (!visible) return null;
    return (
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
      >
        <Localized id="select-inbox">
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
              <Link to="/create-inbox">
                <Localized id="create-inbox">
                  <Theme.Button layoutTransition={underDampedSpring} />
                </Localized>
              </Link>
              <Theme.Space layoutTransition={underDampedSpring} />
              <Link to="/contacts">
                <Localized id="contacts">
                  <Theme.Button layoutTransition={underDampedSpring} />
                </Localized>
              </Link>
              {[...inboxes.values()].map((inbox) => {
                const unread = inbox.unreadCount > 0;
                const expired =
                  inbox.expirationTime === undefined ||
                  inbox.expirationTime <= now;
                const newlyCreated = !inbox.setUp;

                if (newlyCreated) {
                  return (
                    <React.Fragment key={synthesizeId(inbox.globalId)}>
                      <Theme.Space layoutTransition={underDampedSpring} />
                      <Localized id="inbox-not-set-up">
                        <Theme.InboxNotifications
                          layoutTransition={underDampedSpring}
                        />
                      </Localized>
                      <Theme.Item
                        layoutTransition={underDampedSpring}
                        className="no-top-rounded-corners"
                      >
                        <div>{inbox.label}</div>
                        <Localized
                          id="interpolated-inbox-id"
                          vars={{
                            inboxId: base32.encode(inbox.globalId.slice(0, 10)),
                          }}
                        >
                          <div />
                        </Localized>
                      </Theme.Item>
                    </React.Fragment>
                  );
                }

                if (unread && expired) {
                  return (
                    <React.Fragment key={synthesizeId(inbox.globalId)}>
                      <Theme.Space layoutTransition={underDampedSpring} />
                      <Localized
                        id="inbox-notification-unread"
                        vars={{ unreadCount: inbox.unreadCount }}
                      >
                        <Theme.InboxNotifications
                          layoutTransition={underDampedSpring}
                        />
                      </Localized>
                      <Theme.Item
                        layoutTransition={underDampedSpring}
                        className="no-top-rounded-corners"
                      >
                        <div>{inbox.label}</div>
                        <Localized
                          id="interpolated-inbox-id"
                          vars={{
                            inboxId: base32.encode(inbox.globalId.slice(0, 10)),
                          }}
                        >
                          <div />
                        </Localized>
                      </Theme.Item>
                    </React.Fragment>
                  );
                }

                if (unread) {
                  return (
                    <React.Fragment key={synthesizeId(inbox.globalId)}>
                      <Theme.Space layoutTransition={underDampedSpring} />
                      <Localized
                        id="inbox-notification-unread"
                        vars={{ unreadCount: inbox.unreadCount }}
                      >
                        <Theme.InboxNotifications
                          layoutTransition={underDampedSpring}
                        />
                      </Localized>
                      <Theme.Item
                        layoutTransition={underDampedSpring}
                        className="no-top-rounded-corners"
                      >
                        <div>{inbox.label}</div>
                        <Localized
                          id="interpolated-inbox-id"
                          vars={{
                            inboxId: base32.encode(inbox.globalId.slice(0, 10)),
                          }}
                        >
                          <div />
                        </Localized>
                      </Theme.Item>
                    </React.Fragment>
                  );
                }

                if (expired) {
                  return (
                    <React.Fragment key={synthesizeId(inbox.globalId)}>
                      <Theme.Space layoutTransition={underDampedSpring} />
                      <Localized id="inbox-notification-expired">
                        <Theme.InboxNotifications
                          layoutTransition={underDampedSpring}
                        />
                      </Localized>
                      <Theme.Item
                        layoutTransition={underDampedSpring}
                        className="no-top-rounded-corners"
                      >
                        <div>{inbox.label}</div>
                        <Localized
                          id="interpolated-inbox-id"
                          vars={{
                            inboxId: base32.encode(inbox.globalId.slice(0, 10)),
                          }}
                        >
                          <div />
                        </Localized>
                      </Theme.Item>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={synthesizeId(inbox.globalId)}>
                    <Theme.Space layoutTransition={underDampedSpring} />
                    <Theme.Item layoutTransition={underDampedSpring}>
                      <div>{inbox.label}</div>
                      <Localized
                        id="interpolated-inbox-id"
                        vars={{
                          inboxId: base32.encode(inbox.globalId.slice(0, 10)),
                        }}
                      >
                        <div />
                      </Localized>
                    </Theme.Item>
                  </React.Fragment>
                );
              })}
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default SelectInbox;
