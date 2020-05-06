import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { Link } from "react-router-dom";

const SelectInbox = ({
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

  if (!visible) return null;
  return (
    <Theme.NeatBackground
      initial={{ opacity: 0, transform: "scale(1.5)" }}
      animate={controls}
    >
      <Theme.Header positionTransition>Select inbox</Theme.Header>
      {flag && (
        <>
          <Theme.Space />
          <motion.div
            positionTransition
            style={{ transform: "scale(0.5)" }}
            animate={{ transform: "scale(1)" }}
          >
            <Link to="/create-inbox">
              <Theme.Button>Create new inbox</Theme.Button>
            </Link>
            <Theme.Space />
            <Theme.InboxNotifications>
              5 unread messages
            </Theme.InboxNotifications>
            <Theme.Inbox className="no-top-rounded-corners">
              Helloajsdhlajshdjkahslkdjasldjkasjdklasjdklsjdkljsdklajsdalsjdlkjadskl{" "}
            </Theme.Inbox>
            <Theme.Space />
            <Theme.Inbox>Hello</Theme.Inbox>
            <Theme.Space />
            <Theme.Inbox>Hello</Theme.Inbox>
          </motion.div>
        </>
      )}
    </Theme.NeatBackground>
  );
};

export default SelectInbox;
