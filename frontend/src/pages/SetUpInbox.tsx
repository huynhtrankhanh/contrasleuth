import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import {
  Inbox,
  setAutosavePreference,
  publishPublicHalfEntry,
  markInboxAsSetUp,
} from "../store";
import InboxCard from "../components/InboxCard";
import ToggleAutosave from "../components/ToggleAutosave";
import { observer } from "mobx-react";
import base32 from "hi-base32";

const SetUpInbox = observer(
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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const history = useHistory();

    useEffect(() => {
      if (page === "setup") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
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
            if (inputRef.current !== null) inputRef.current.focus();
          });
      // eslint-disable-next-line
    }, [visible]);

    if (!visible) return null;

    if (inbox === null) {
      console.log(new Error("This should be unreachable."));
      return null;
    }

    return (
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
      >
        <Localized id="set-up-inbox">
          <Theme.Header layout />
        </Localized>
        {flag && (
          <>
            <Theme.Space />
            <motion.div
              layout
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <InboxCard inbox={inbox} displayInboxNotifications={false} />
              <Theme.Space layout />
              <Localized id="go-back">
                <Theme.Button onClick={() => history.goBack()} />
              </Localized>
              <Theme.Space layout />
              <Localized id="expires-after-7-days">
                <Theme.Text layout />
              </Localized>
              <Theme.Space layout />
              <Localized id="message-retention">
                <Theme.Text layout />
              </Localized>
              <Theme.Space layout />
              <Theme.ItemWithDetails
                layout
                onClick={() =>
                  setAutosavePreference(
                    inbox,
                    inbox.autosavePreference === "autosave"
                      ? "manual"
                      : "autosave"
                  )
                }
              >
                <ToggleAutosave
                  autosave={inbox.autosavePreference === "autosave"}
                />
              </Theme.ItemWithDetails>
              <Theme.Space />
              <Localized id="done">
                <Theme.Button
                  onClick={() => {
                    publishPublicHalfEntry(inbox, "setup inbox");
                    markInboxAsSetUp(inbox);
                    history.replace("/inbox/" + base32.encode(inbox.globalId));
                  }}
                />
              </Localized>
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default SetUpInbox;
