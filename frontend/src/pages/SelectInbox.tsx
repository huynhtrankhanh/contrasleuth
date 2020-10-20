import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { Link } from "react-router-dom";
import { inboxes, synthesizeId } from "../store";
import { observer } from "mobx-react";
import { Localized } from "@fluent/react";
import InboxCard from "../components/InboxCard";
import base32 from "hi-base32";

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
    const [animating, setAnimating] = useState(false);
    const controls = useAnimation();

    useEffect(() => {
      if (page === "select inbox") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
        }
      } else if (visible) {
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
            setFlag(true);
            setAnimating(false);
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
        <Localized id="select-inbox">
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
              <Link to="/create-inbox">
                <Localized id="create-inbox">
                  <Theme.Button layout />
                </Localized>
              </Link>
              <Theme.Space layout />
              <Link to="/contacts">
                <Localized id="contacts">
                  <Theme.Button layout />
                </Localized>
              </Link>
              {[...inboxes.values()].map((inbox) => (
                <React.Fragment key={synthesizeId(inbox.globalId)}>
                  <Theme.Space layout />
                  <Link to={"/inbox/" + base32.encode(inbox.globalId)}>
                    <InboxCard inbox={inbox} displayInboxNotifications />
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

export default SelectInbox;
