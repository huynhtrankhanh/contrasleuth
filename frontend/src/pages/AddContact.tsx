import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { addContact, contacts, lookupPublicHalf, PublicHalf } from "../store";
import * as base32 from "hi-base32";
import calculatePublicHalfId from "../calculatePublicHalfId";

const TextInput = ({
  children,
  inputRef,
  value,
  setValue,
  controls,
}: {
  children?: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  value: string;
  setValue: (value: string) => void;
  controls: AnimationControls;
}) => (
  <Theme.Input
    placeholder={children}
    ref={inputRef}
    value={value}
    onChange={(event) => setValue(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const Submit = ({ children }: { children?: string }) => (
  <Theme.Button layout as={motion.input} type="submit" value={children} />
);

const AddContact = ({
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
  const inboxIdInputControls = useAnimation();
  const contactNameInputControls = useAnimation();
  const inboxIdInputRef = useRef<HTMLInputElement | null>(null);
  const contactNameInputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory();

  const [inboxId, setInboxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [showContactNameInput, setShowContactNameInput] = useState(false);
  const [publicHalf, setPublicHalf] = useState<PublicHalf | null>(null);

  type ValidationError =
    | "inbox doesn't exist"
    | "invalid inbox id"
    | "already added"
    | "no error";

  const [validationError, setValidationError] = useState<ValidationError>(
    "no error"
  );

  useEffect(() => {
    if (page === "add contact") {
      if (!visible && shouldEnter) {
        setVisible(true);
        setShouldEnter(false);
        setInboxId("");
        setContactName("");
        setShowContactNameInput(false);
        setPublicHalf(null);
        setValidationError("no error");
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
          setFlag(true);
          if (inboxIdInputRef.current !== null) inboxIdInputRef.current.focus();
          setAnimating(false);
        });
    }
    // eslint-disable-next-line
  }, [visible]);

  useEffect(() => {
    if (showContactNameInput && contactNameInputRef.current !== null) {
      contactNameInputRef.current.focus();
    }
  }, [showContactNameInput]);

  if (!visible) return null;

  return (
    <Theme.NeatBackground
      initial={{ opacity: 0, transform: "scale(1.5)" }}
      animate={controls}
      className={animating ? "disable-interactions" : ""}
    >
      <Localized id="add-contact">
        <Theme.Header layout />
      </Localized>

      {validationError === "inbox doesn't exist" ? (
        <>
          <Theme.Space layout />
          <Theme.ItemWithDetails>
            <Localized id="inbox-not-found">
              <div />
            </Localized>
            <Localized id="inbox-not-found-explanation">
              <div />
            </Localized>
          </Theme.ItemWithDetails>
        </>
      ) : validationError === "invalid inbox id" ? (
        <>
          <Theme.Space layout />
          <Theme.ItemWithDetails>
            <Localized id="invalid-inbox-id">
              <div />
            </Localized>
            <Localized id="invalid-inbox-id-explanation">
              <div />
            </Localized>
          </Theme.ItemWithDetails>
        </>
      ) : validationError === "already added" ? (
        <>
          <Theme.Space layout />
          <Theme.ItemWithDetails>
            <Localized id="already-added-to-contacts">
              <div />
            </Localized>
            <Localized id="already-added-to-contacts-explanation">
              <div />
            </Localized>
          </Theme.ItemWithDetails>
        </>
      ) : null}

      {flag && (
        <>
          <Theme.Space layout />
          <motion.div
            layout
            style={{ transform: "scale(0.5)" }}
            animate={{ transform: "scale(1)" }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (animating) return;

                if (!showContactNameInput) {
                  const normalizedInboxId = inboxId.trim().toUpperCase();
                  if (normalizedInboxId === "") {
                    inboxIdInputControls
                      .start({ transform: "scale(1.5)" })
                      .then(() =>
                        inboxIdInputControls.start({ transform: "scale(1)" })
                      );

                    if (inboxIdInputRef.current !== null)
                      inboxIdInputRef.current.focus();

                    return;
                  }

                  const valid =
                    normalizedInboxId.length === 16 &&
                    [...normalizedInboxId].every((character) =>
                      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".includes(character)
                    );

                  if (!valid) {
                    setValidationError("invalid inbox id");
                    if (inboxIdInputRef.current !== null)
                      inboxIdInputRef.current.focus();

                    return;
                  }

                  const decoded = base32.decode.asBytes(normalizedInboxId);

                  const jsonStringified = JSON.stringify(decoded);

                  for (const contact of contacts.values()) {
                    const id = [
                      ...calculatePublicHalfId(
                        contact.publicEncryptionKey,
                        contact.publicSigningKey
                      ).slice(0, 10),
                    ];

                    if (jsonStringified === JSON.stringify(id)) {
                      setValidationError("already added");
                      if (inboxIdInputRef.current !== null)
                        inboxIdInputRef.current.focus();

                      return;
                    }
                  }

                  lookupPublicHalf(decoded).then((publicHalves) => {
                    if (publicHalves.length === 0) {
                      setValidationError("inbox doesn't exist");

                      if (inboxIdInputRef.current !== null)
                        inboxIdInputRef.current.focus();
                      return;
                    }

                    setShowContactNameInput(true);
                    setValidationError("no error");

                    setPublicHalf(publicHalves[0]);
                  });

                  return;
                }

                if (contactName.trim() === "") {
                  contactNameInputControls
                    .start({ transform: "scale(1.5)" })
                    .then(() =>
                      contactNameInputControls.start({ transform: "scale(1)" })
                    );

                  if (contactNameInputRef.current !== null)
                    contactNameInputRef.current.focus();

                  return;
                }

                if (publicHalf === null) {
                  console.log(new Error("This should be unreachable."));
                  return;
                }

                addContact(
                  contacts,
                  contactName,
                  publicHalf.publicEncryptionKey,
                  publicHalf.publicSigningKey
                );

                history.goBack();
              }}
            >
              <Localized id="inbox-id">
                <TextInput
                  inputRef={inboxIdInputRef}
                  value={inboxId}
                  setValue={(value) => {
                    setInboxId(value);
                    if (showContactNameInput) setShowContactNameInput(false);
                  }}
                  controls={inboxIdInputControls}
                />
              </Localized>
              <Theme.Space layout />
              {showContactNameInput && (
                <Localized id="contact-name">
                  <TextInput
                    inputRef={contactNameInputRef}
                    value={contactName}
                    setValue={setContactName}
                    controls={contactNameInputControls}
                  />
                </Localized>
              )}
              <Theme.Space layout />
              {showContactNameInput ? (
                <Localized id="add-contact">
                  <Submit />
                </Localized>
              ) : (
                <Localized id="next">
                  <Submit />
                </Localized>
              )}
            </form>
            <Theme.Space layout />
            <Localized id="cancel">
              <Theme.Button
                layout
                onClick={() => history.goBack()}
              ></Theme.Button>
            </Localized>
          </motion.div>
        </>
      )}
    </Theme.NeatBackground>
  );
};

export default AddContact;
