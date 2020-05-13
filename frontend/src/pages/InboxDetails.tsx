import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { inboxes, addInbox } from "../store";
import underDampedSpring from "../underDampedSpring";

const MessageSearchInput = ({
  children,
  inputRef,
  inboxLabel,
  setSearchQuery,
  controls,
}: {
  children?: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  inboxLabel: string;
  setSearchQuery: (value: string) => void;
  controls: AnimationControls;
}) => (
  <Theme.Input
    placeholder={children}
    ref={inputRef}
    value={inboxLabel}
    onChange={(event) => setSearchQuery(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const InboxDetails = ({
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
  const [inboxLabel, setSearchQuery] = useState("");
  const controls = useAnimation();
  const inputControls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory();

  useEffect(() => {
    if (page === "create inbox") {
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
          if (inputRef.current !== null) inputRef.current.focus();
        });
    // eslint-disable-next-line
  }, [visible]);

  if (!visible) return null;

  return (
    <Theme.NeatBackground
      initial={{ opacity: 0, transform: "scale(1.5)" }}
      animate={controls}
    >
      <Localized id="create-inbox">
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
            <Localized id="inbox-name">
              <MessageSearchInput
                inputRef={inputRef}
                inboxLabel={inboxLabel}
                setSearchQuery={setSearchQuery}
                controls={inputControls}
              />
            </Localized>
            <Theme.Space />
            <Localized id="cancel">
              <Theme.Button onClick={() => history.goBack()}></Theme.Button>
            </Localized>
          </motion.div>
        </>
      )}
    </Theme.NeatBackground>
  );
};

export default InboxDetails;
