import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
import { Localized } from "@fluent/react";
import { Link } from "react-router-dom";
import {
  contacts,
  Contact,
  renameContact,
  deleteContact,
  lookupPublicHalf,
  setContactPublicHalf,
} from "../store";
import underDampedSpring from "../underDampedSpring";
import base32 from "hi-base32";
import { observer } from "mobx-react";
import CopyInboxId from "../components/CopyInboxId";
import calculatePublicHalfId from "../calculatePublicHalfId";

const BoldOccurrences = ({
  children,
  highlight,
}: {
  children: string | undefined;
  highlight: string;
}) => {
  if (children === undefined) return null;

  const flags = Array(children.length).fill(false);

  {
    const lowercasedChildren = children.toLowerCase();
    const lowercasedHighlight = highlight.toLowerCase();

    let startIndex = lowercasedChildren.indexOf(lowercasedHighlight);
    while (startIndex !== -1) {
      for (let i = startIndex; i < startIndex + highlight.length; i++) {
        flags[i] = true;
      }
      startIndex = lowercasedChildren.indexOf(
        lowercasedHighlight,
        startIndex + 1
      );
    }
  }

  const renderDescriptions: { highlighted: boolean; text: string }[] = [];

  for (let i = 0; i < flags.length; i++) {
    if (i === 0 || flags[i] !== flags[i - 1]) {
      renderDescriptions.push({ highlighted: flags[i], text: "" });
    }

    renderDescriptions[renderDescriptions.length - 1].text += children[i];
  }

  return (
    <>
      {renderDescriptions.map(({ highlighted, text }, index) => (
        <React.Fragment key={index}>
          {highlighted ? <Theme.Bold>{text}</Theme.Bold> : text}
        </React.Fragment>
      ))}
    </>
  );
};

const Input = ({
  children,
  value,
  setValue,
  controls,
  inputRef,
}: {
  children?: string;
  value: string;
  setValue: (value: string) => void;
  controls: AnimationControls;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}) => (
  <Theme.Input
    ref={inputRef}
    placeholder={children}
    value={value}
    onChange={(event) => setValue(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

const Submit = ({ children }: { children?: string }) => (
  <Theme.Button
    layoutTransition={underDampedSpring}
    as={motion.input}
    type="submit"
    value={children}
  />
);

type ValidationError = {
  title: string;
  description: string;
  action?: {
    title: string;
    callback: () => void;
  };
};

type SyncOrAsync<T> =
  | {
      type: "sync";
      value: T;
    }
  | { type: "async"; value: Promise<T> };

const SingleFieldForm = ({
  validate,
  submitButtonText,
  inputPlaceholder,
  defaultValue,
}: {
  validate: (input: string) => SyncOrAsync<ValidationError | undefined>;
  submitButtonText: string;
  inputPlaceholder: string;
  defaultValue?: string;
}) => {
  const [input, setInput] = useState(
    defaultValue === undefined ? "" : defaultValue
  );
  const controls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [validateResult, setValidateResult] = useState<
    ValidationError | undefined
  >(undefined);

  useEffect(() => {
    if (inputRef.current !== null) {
      inputRef.current.select();
    }
  }, [inputRef]);

  return (
    <motion.form
      layoutTransition={underDampedSpring}
      onSubmit={(event) => {
        event.preventDefault();
        if (input.trim() === "") {
          controls
            .start({ transform: "scale(1.5)" })
            .then(() => controls.start({ transform: "scale(1)" }));
          if (inputRef.current !== null) {
            inputRef.current.focus();
          }
          return;
        }

        const validateResult = validate(input);

        if (validateResult.type === "sync") {
          setValidateResult(validateResult.value);
        } else {
          validateResult.value.then((value) => setValidateResult(value));
        }
      }}
    >
      {validateResult !== undefined && (
        <>
          <Theme.ItemWithDetails layoutTransition={underDampedSpring}>
            <Localized id={validateResult.title}>
              <div />
            </Localized>
            <Localized id={validateResult.description}>
              <div />
            </Localized>
          </Theme.ItemWithDetails>
          {validateResult.action !== undefined && (
            <>
              <Theme.Space layoutTransition={underDampedSpring} />
              <Theme.Button
                layoutTransition={underDampedSpring}
                onClick={validateResult.action.callback}
              >
                <Localized id={validateResult.action.title} />
              </Theme.Button>
            </>
          )}
          <Theme.Space layoutTransition={underDampedSpring} />
        </>
      )}
      <Localized id={inputPlaceholder}>
        <Input
          inputRef={inputRef}
          value={input}
          setValue={setInput}
          controls={controls}
        />
      </Localized>
      <Theme.Space layoutTransition={underDampedSpring} />
      <Localized id={submitButtonText}>
        <Submit />
      </Localized>
    </motion.form>
  );
};

const Contacts = observer(
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
    const [searchQuery, setSearchQuery] = useState("");
    const controls = useAnimation();
    const inputControls = useAnimation();
    const history = useHistory();

    type Variant =
      | { type: "root" }
      | { type: "actions"; contact: Contact }
      | { type: "rename"; contact: Contact }
      | { type: "edit inbox id"; contact: Contact }
      | { type: "delete"; contact: Contact };

    const [variant, setVariant] = useState<Variant>({ type: "root" });
    const [pageTainted, setPageTainted] = useState(false);
    const [
      inboxSelectedVariantTainted,
      setInboxSelectedVariantTainted,
    ] = useState(false);

    const setVariantAndTaint = (variant: Variant) => {
      setVariant(variant);
      setPageTainted(true);
      if (variant.type === "root") {
        setInboxSelectedVariantTainted(false);
      } else if (variant.type !== "actions") {
        setInboxSelectedVariantTainted(true);
      }
    };

    useEffect(() => {
      if (page === "contacts") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
        }
      } else {
        if (shouldEnter) {
          setSearchQuery("");
          setVariant({ type: "root" });
          setPageTainted(false);
          setInboxSelectedVariantTainted(false);
        }
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
            <Theme.Space layoutTransition={underDampedSpring} />
            <motion.div
              layoutTransition={underDampedSpring}
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              {variant.type === "root"
                ? (() => {
                    const contents = (
                      <>
                        <Theme.Sticky layoutTransition={underDampedSpring}>
                          <Localized id="search-contacts">
                            <Input
                              value={searchQuery}
                              setValue={setSearchQuery}
                              controls={inputControls}
                            />
                          </Localized>
                          <Theme.Space layoutTransition={underDampedSpring} />
                          <Link to="/add-contact">
                            <Theme.Button layoutTransition={underDampedSpring}>
                              <Localized id="add-contact" />
                            </Theme.Button>
                          </Link>
                          <Theme.Space layoutTransition={underDampedSpring} />
                          <Theme.Button
                            onClick={() => history.goBack()}
                            layoutTransition={underDampedSpring}
                          >
                            <Localized id="go-back" />
                          </Theme.Button>
                        </Theme.Sticky>
                        <Theme.Space layoutTransition={underDampedSpring} />
                        {searchQuery === ""
                          ? [...contacts.values()].map((contact) => (
                              <React.Fragment key={contact.ephemeralLocalId}>
                                <Theme.Item
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({
                                      contact,
                                      type: "actions",
                                    })
                                  }
                                >
                                  <div>{contact.label}</div>
                                  <Localized
                                    id="interpolated-inbox-id"
                                    vars={{
                                      inboxId: base32.encode(
                                        contact.globalId.slice(0, 10)
                                      ),
                                    }}
                                  >
                                    <div />
                                  </Localized>
                                </Theme.Item>
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                              </React.Fragment>
                            ))
                          : [...contacts.values()]
                              .map((contact) => ({
                                contact,
                                shortInboxId: base32.encode(
                                  contact.globalId.slice(0, 10)
                                ),
                              }))
                              .filter(
                                ({ contact, shortInboxId }) =>
                                  contact.label
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase()) ||
                                  shortInboxId
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase())
                              )
                              .map(({ contact, shortInboxId }) => (
                                <React.Fragment key={contact.ephemeralLocalId}>
                                  <Theme.Item
                                    layoutTransition={underDampedSpring}
                                    onClick={() =>
                                      setVariantAndTaint({
                                        contact,
                                        type: "actions",
                                      })
                                    }
                                  >
                                    <div>
                                      <BoldOccurrences highlight={searchQuery}>
                                        {contact.label}
                                      </BoldOccurrences>
                                    </div>
                                    <div>
                                      <BoldOccurrences highlight={searchQuery}>
                                        {shortInboxId}
                                      </BoldOccurrences>
                                    </div>
                                  </Theme.Item>
                                  <Theme.Space
                                    layoutTransition={underDampedSpring}
                                  />
                                </React.Fragment>
                              ))}
                      </>
                    );

                    if (!pageTainted) return contents;

                    return (
                      <motion.div
                        key="root variant"
                        animate={{ transform: "scale(1)" }}
                      >
                        {contents}
                      </motion.div>
                    );
                  })()
                : (() => {
                    const base32EncodedShortId = base32.encode(
                      variant.contact.globalId.slice(0, 10)
                    );
                    return (
                      <motion.div
                        key="inbox selected variant"
                        animate={{ transform: "scale(1)" }}
                      >
                        <React.Fragment key={variant.contact.ephemeralLocalId}>
                          <Theme.Item layoutTransition={underDampedSpring}>
                            <div>{variant.contact.label}</div>
                            <Localized
                              id="interpolated-inbox-id"
                              vars={{
                                inboxId: base32EncodedShortId,
                              }}
                            >
                              <div />
                            </Localized>
                          </Theme.Item>
                          <Theme.Space layoutTransition={underDampedSpring} />
                        </React.Fragment>
                        <Theme.Space layoutTransition={underDampedSpring} />
                        {variant.type === "actions" ? (
                          (() => {
                            const contents = (
                              <>
                                <Theme.Button
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({
                                      type: "rename",
                                      contact: variant.contact,
                                    })
                                  }
                                >
                                  <Localized id="rename" />
                                </Theme.Button>
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                                <CopyInboxId
                                  base32EncodedShortId={base32EncodedShortId}
                                />
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                                <Theme.Button
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({
                                      type: "edit inbox id",
                                      contact: variant.contact,
                                    })
                                  }
                                >
                                  <Localized id="edit-inbox-id" />
                                </Theme.Button>
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                                <Theme.Button
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({
                                      type: "delete",
                                      contact: variant.contact,
                                    })
                                  }
                                >
                                  <Localized id="delete" />
                                </Theme.Button>
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                                <Theme.Button
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({ type: "root" })
                                  }
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </>
                            );

                            if (!inboxSelectedVariantTainted) return contents;

                            return (
                              <motion.div
                                key="actions variant"
                                animate={{ transform: "scale(1)" }}
                              >
                                {contents}
                              </motion.div>
                            );
                          })()
                        ) : variant.type === "rename" ? (
                          <motion.div
                            key="rename variant"
                            animate={{ transform: "scale(1)" }}
                          >
                            <SingleFieldForm
                              defaultValue={variant.contact.label}
                              validate={(input) => {
                                renameContact(variant.contact, input);
                                setVariantAndTaint({
                                  type: "actions",
                                  contact: variant.contact,
                                });

                                return {
                                  type: "sync",
                                  value: undefined,
                                };
                              }}
                              submitButtonText="rename"
                              inputPlaceholder="contact-name"
                            />
                            <Theme.Space layoutTransition={underDampedSpring} />
                            <Theme.Button
                              layoutTransition={underDampedSpring}
                              onClick={() =>
                                setVariantAndTaint({
                                  type: "actions",
                                  contact: variant.contact,
                                })
                              }
                            >
                              <Localized id="go-back" />
                            </Theme.Button>
                          </motion.div>
                        ) : variant.type === "edit inbox id" ? (
                          (() => {
                            const currentContactInboxId = base32.encode(
                              variant.contact.globalId.slice(0, 10)
                            );
                            return (
                              <motion.div
                                key="edit variant"
                                animate={{ transform: "scale(1)" }}
                              >
                                <SingleFieldForm
                                  defaultValue={currentContactInboxId}
                                  validate={(input) => {
                                    const normalizedInboxId = input
                                      .trim()
                                      .toUpperCase();

                                    if (
                                      currentContactInboxId ===
                                      normalizedInboxId
                                    ) {
                                      setVariantAndTaint({
                                        type: "actions",
                                        contact: variant.contact,
                                      });
                                      return { type: "sync", value: undefined };
                                    }

                                    const valid =
                                      normalizedInboxId.length === 16 &&
                                      [
                                        ...normalizedInboxId,
                                      ].every((character) =>
                                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".includes(
                                          character
                                        )
                                      );

                                    if (!valid) {
                                      return {
                                        type: "sync",
                                        value: {
                                          title: "invalid-inbox-id",
                                          description:
                                            "invalid-inbox-id-explanation",
                                        },
                                      };
                                    }

                                    const decoded = base32.decode.asBytes(
                                      normalizedInboxId
                                    );

                                    const jsonStringified = JSON.stringify(
                                      decoded
                                    );

                                    for (const contact of contacts.values()) {
                                      const id = [
                                        ...calculatePublicHalfId(
                                          contact.publicEncryptionKey,
                                          contact.publicSigningKey
                                        ).slice(0, 10),
                                      ];

                                      if (
                                        jsonStringified === JSON.stringify(id)
                                      ) {
                                        return {
                                          type: "sync",
                                          value: {
                                            title:
                                              "another-contact-with-same-id",
                                            description:
                                              "another-contact-with-same-id-explanation",
                                            action: {
                                              title:
                                                "search-for-the-other-contact",
                                              callback: () => {
                                                setVariantAndTaint({
                                                  type: "root",
                                                });
                                                setSearchQuery(
                                                  normalizedInboxId
                                                );
                                              },
                                            },
                                          },
                                        };
                                      }
                                    }

                                    return {
                                      type: "async",
                                      value: lookupPublicHalf(decoded).then(
                                        (publicHalves) => {
                                          if (publicHalves.length === 0) {
                                            return {
                                              title: "inbox-not-found",
                                              description:
                                                "inbox-not-found-explanation",
                                            };
                                          }

                                          setContactPublicHalf(
                                            contacts,
                                            variant.contact,
                                            publicHalves[0].publicEncryptionKey,
                                            publicHalves[0].publicSigningKey
                                          );

                                          setVariantAndTaint({
                                            type: "actions",
                                            contact: variant.contact,
                                          });
                                        }
                                      ),
                                    };
                                  }}
                                  submitButtonText="edit-inbox-id"
                                  inputPlaceholder="inbox-id"
                                />
                                <Theme.Space
                                  layoutTransition={underDampedSpring}
                                />
                                <Theme.Button
                                  layoutTransition={underDampedSpring}
                                  onClick={() =>
                                    setVariantAndTaint({
                                      type: "actions",
                                      contact: variant.contact,
                                    })
                                  }
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </motion.div>
                            );
                          })()
                        ) : variant.type === "delete" ? (
                          <motion.div
                            key="delete variant"
                            animate={{ transform: "scale(1)" }}
                          >
                            <Theme.Text>
                              <Localized id="contact-delete-confirm" />
                            </Theme.Text>
                            <Theme.Space layoutTransition={underDampedSpring} />
                            <Theme.Button
                              onClick={() => {
                                const currentContact = variant.contact;
                                setVariant({ type: "root" });
                                deleteContact(contacts, currentContact);
                              }}
                            >
                              <Localized id="delete" />
                            </Theme.Button>
                            <Theme.Space layoutTransition={underDampedSpring} />
                            <Theme.Button
                              layoutTransition={underDampedSpring}
                              onClick={() =>
                                setVariantAndTaint({
                                  type: "actions",
                                  contact: variant.contact,
                                })
                              }
                            >
                              <Localized id="go-back" />
                            </Theme.Button>
                          </motion.div>
                        ) : null}
                      </motion.div>
                    );
                  })()}
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default Contacts;
