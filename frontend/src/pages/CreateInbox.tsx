import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { inboxes, addInbox } from "../store";

const InboxNameInput = ({
  children,
  inputRef,
  inboxLabel,
  setInboxLabel,
  controls,
}: {
  children?: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  inboxLabel: string;
  setInboxLabel: (value: string) => void;
  controls: AnimationControls;
}) => (
  <Theme.Input
    placeholder={children}
    ref={inputRef}
    value={inboxLabel}
    onChange={(event) => setInboxLabel(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const SubmitInboxName = ({ children }: { children?: string }) => (
  <Theme.Button as={motion.input} type="submit" value={children} />
);

const CreateInbox = ({
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
  const [animating, setAnimating] = useState(false);
  const [inboxLabel, setInboxLabel] = useState("");
  const controls = useAnimation();
  const inputControls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory();

  useEffect(() => {
    if (page === "create inbox") {
      if (!visible && shouldEnter) {
        setVisible(true);
        setShouldEnter(false);
        setInboxLabel("");
      }
    } else {
      if (visible) {
        setAnimating(true);
        controls
          .start({
            opacity: 0,
            transform: "scale(1.5)",
          })
          .then(() => {
            setVisible(false);
            setFlag(false);
            setShouldEnter(true);
            setAnimating(false);
          });
      }
    }
    // eslint-disable-next-line
  }, [page, shouldEnter]);

  useEffect(() => {
    if (visible) {
      setAnimating(true);
      controls
        .start({
          opacity: 1,
          transform: "scale(1)",
        })
        .then(() => {
          setAnimating(false);
          setFlag(true);
          if (inputRef.current !== null) inputRef.current.focus();
        });
    }
    // eslint-disable-next-line
  }, [visible]);

  if (!visible) return null;

  return (
    <Theme.NeatBackground
      initial={{ opacity: 0, transform: "scale(1.5)" }}
      animate={controls}
      className={animating ? "disable-interactions" : ""}
    >
      <Localized id="create-inbox">
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
            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (animating) return;

                if (inboxLabel.trim() === "") {
                  inputControls
                    .start({ transform: "scale(1.5)" })
                    .then(() => inputControls.start({ transform: "scale(1)" }));
                  if (inputRef.current !== null) {
                    inputRef.current.focus();
                  }
                  return;
                }

                addInbox(inboxes, inboxLabel);

                history.goBack();
              }}
            >
              <Localized id="inbox-name">
                <InboxNameInput
                  inputRef={inputRef}
                  inboxLabel={inboxLabel}
                  setInboxLabel={setInboxLabel}
                  controls={inputControls}
                />
              </Localized>
              <Theme.Space />
              <Localized id="create-inbox">
                <SubmitInboxName />
              </Localized>
            </form>
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

export default CreateInbox;
