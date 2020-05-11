import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { Link } from "react-router-dom";
import { contacts } from "../store";
import underDampedSpring from "../underDampedSpring";

const ContactSearchInput = ({
  children,
  inputRef,
  searchQuery,
  setSearchQuery,
  controls,
}: {
  children?: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  controls: AnimationControls;
}) => (
  <Theme.Input
    placeholder={children}
    ref={inputRef}
    value={searchQuery}
    onChange={(event) => setSearchQuery(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const Contacts = ({
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
  const [searchQuery, setSearchQuery] = useState("");
  const controls = useAnimation();
  const inputControls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory();

  useEffect(() => {
    if (page === "contacts") {
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
      <Localized id="contacts">
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
            <Theme.Sticky>
              <Localized id="search-contacts">
                <ContactSearchInput
                  inputRef={inputRef}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  controls={inputControls}
                />
              </Localized>
              <Theme.Space />
              <Link to="/add-contact">
                <Localized id="add-contact">
                  <Theme.Button />
                </Localized>
              </Link>
              <Theme.Space />
              <Localized id="go-back">
                <Theme.Button onClick={() => history.goBack()} />
              </Localized>
            </Theme.Sticky>
            <Theme.Space />
            {[...contacts.values()].map((contact) => (
              <React.Fragment key={contact.ephemeralLocalId}>
                <Theme.Item>{contact.label}</Theme.Item>
                <Theme.Space />
              </React.Fragment>
            ))}
          </motion.div>
        </>
      )}
    </Theme.NeatBackground>
  );
};

export default Contacts;
