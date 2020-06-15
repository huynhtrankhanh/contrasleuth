import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
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
import MultivariantSection from "../components/MultivariantSection";
import BoldOccurrences from "../components/BoldOccurrences";
import { Input, SingleFieldForm } from "../components/SingleFieldForm";

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
      | { type: "inbox selected variant"; contact: Contact };

    const [variant, setVariant] = useState<Variant>({ type: "root" });
    const [pageTainted, setPageTainted] = useState(false);

    const setVariantAndTaint = (variant: Variant) => {
      setVariant(variant);
      setPageTainted(true);
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
                                      type: "inbox selected variant",
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
                                        type: "inbox selected variant",
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
                        <MultivariantSection
                          variants={[
                            {
                              key: "actions",
                              render: (setVariant) => (
                                <>
                                  <Theme.Button
                                    layoutTransition={underDampedSpring}
                                    onClick={() => setVariant("rename")}
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
                                    onClick={() => setVariant("edit inbox id")}
                                  >
                                    <Localized id="edit-inbox-id" />
                                  </Theme.Button>
                                  <Theme.Space
                                    layoutTransition={underDampedSpring}
                                  />
                                  <Theme.Button
                                    layoutTransition={underDampedSpring}
                                    onClick={() => setVariant("delete")}
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
                              ),
                            },
                            {
                              key: "rename",
                              render: (setVariant) => (
                                <>
                                  <SingleFieldForm
                                    defaultValue={variant.contact.label}
                                    validate={(input) => {
                                      renameContact(variant.contact, input);
                                      setVariant("actions");

                                      return {
                                        type: "sync",
                                        value: undefined,
                                      };
                                    }}
                                    submitButtonText="rename"
                                    inputPlaceholder="contact-name"
                                  />
                                  <Theme.Space
                                    layoutTransition={underDampedSpring}
                                  />
                                  <Theme.Button
                                    layoutTransition={underDampedSpring}
                                    onClick={() => setVariant("actions")}
                                  >
                                    <Localized id="go-back" />
                                  </Theme.Button>
                                </>
                              ),
                            },
                            {
                              key: "edit inbox id",
                              render: (setVariant) => {
                                const currentContactInboxId = base32.encode(
                                  variant.contact.globalId.slice(0, 10)
                                );
                                return (
                                  <>
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
                                          setVariant("actions");
                                          return {
                                            type: "sync",
                                            value: undefined,
                                          };
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
                                            jsonStringified ===
                                            JSON.stringify(id)
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
                                                publicHalves[0]
                                                  .publicEncryptionKey,
                                                publicHalves[0].publicSigningKey
                                              );

                                              setVariant("actions");
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
                                      onClick={() => setVariant("actions")}
                                    >
                                      <Localized id="go-back" />
                                    </Theme.Button>
                                  </>
                                );
                              },
                            },
                            {
                              key: "delete",
                              render: (setVariant) => (
                                <>
                                  <Theme.Text>
                                    <Localized id="contact-delete-confirm" />
                                  </Theme.Text>
                                  <Theme.Space
                                    layoutTransition={underDampedSpring}
                                  />
                                  <Theme.Button
                                    onClick={() => {
                                      const currentContact = variant.contact;
                                      setVariantAndTaint({ type: "root" });
                                      deleteContact(contacts, currentContact);
                                    }}
                                  >
                                    <Localized id="delete" />
                                  </Theme.Button>
                                  <Theme.Space
                                    layoutTransition={underDampedSpring}
                                  />
                                  <Theme.Button
                                    layoutTransition={underDampedSpring}
                                    onClick={() => setVariant("actions")}
                                  >
                                    <Localized id="go-back" />
                                  </Theme.Button>
                                </>
                              ),
                            },
                          ]}
                          defaultVariant="actions"
                        />
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
