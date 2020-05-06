import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";

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
  const controls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory();

  useEffect(() => {
    if (page === "create inbox") {
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
        .then(() => {
          setFlag(true);
          if (inputRef.current !== null) inputRef.current.focus();
        });
    // eslint-disable-next-line
  }, [visible]);

  if (!visible) return null;
  return (
    <>
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
      >
        <Theme.Header positionTransition>Create inbox</Theme.Header>
        {flag && (
          <>
            <Theme.Space />
            <motion.div
              positionTransition
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <Theme.Input placeholder="Inbox name" ref={inputRef} />
              <Theme.Space />
              <Theme.Button>Create inbox</Theme.Button>
              <Theme.Space />
              <Theme.Button onClick={() => history.goBack()}>
                Cancel
              </Theme.Button>
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    </>
  );
};

export default CreateInbox;
