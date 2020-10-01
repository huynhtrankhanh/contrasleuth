import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory, useLocation } from "react-router-dom";
import { Localized } from "@fluent/react";
import { Link } from "react-router-dom";
import {
  contacts,
  mapEphemeralLocalIdToContact,
  renameContact,
  deleteContact,
  lookupPublicHalf,
  setContactPublicHalf,
} from "../store";
import base32 from "hi-base32";
import { observer } from "mobx-react";
import CopyInboxId from "../components/CopyInboxId";
import calculatePublicHalfId from "../calculatePublicHalfId";
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
      | {
          type: "inbox selected variant";
          ephemeralContactId: string;
          subvariant: Subvariant;
          subsectionTainted: boolean;
        };

    type Subvariant = "actions" | "rename" | "edit inbox id" | "delete";

    const location = useLocation();

    const variant = (() => {
      const state = location.state || ({} as any);

      if (state.contactsVariant === undefined) return { type: "root" };
      return state.contactsVariant;
    })() as Variant;

    const setVariant = (variant: Variant) => {
      const oldState = location.state || ({} as any);
      history.push(location.pathname, {
        ...oldState,
        contactsVariant: variant,
      });
    };

    const [pageTainted, setPageTainted] = useState(false);

    const setVariantAndTaint = (variant: Variant) => {
      setVariant(variant);
      setPageTainted(true);
    };

    const setSubvariantAndTaint = (subvariant: Subvariant) => {
      if (variant.type !== "inbox selected variant") {
        console.log(new Error("This should be unreachable."));
        return;
      }
      setVariant({ ...variant, subvariant, subsectionTainted: true });
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
          <Theme.Header layout />
        </Localized>
        {flag && (
          <>
            <Theme.Space layout />
            <motion.div
              layout
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              {variant.type === "root"
                ? (() => {
                    const contents = (
                      <>
                        <Theme.Sticky layout>
                          <Localized id="search-contacts">
                            <Input
                              value={searchQuery}
                              setValue={setSearchQuery}
                              controls={inputControls}
                            />
                          </Localized>
                          <Theme.Space layout />
                          <Link to="/add-contact">
                            <Theme.Button layout>
                              <Localized id="add-contact" />
                            </Theme.Button>
                          </Link>
                          <Theme.Space layout />
                          <Theme.Button onClick={() => history.goBack()} layout>
                            <Localized id="go-back" />
                          </Theme.Button>
                        </Theme.Sticky>
                        <Theme.Space layout />
                        {searchQuery === ""
                          ? [...contacts.values()].map((contact) => (
                              <React.Fragment key={contact.ephemeralLocalId}>
                                <Theme.Item
                                  layout
                                  onClick={() =>
                                    setVariantAndTaint({
                                      ephemeralContactId:
                                        contact.ephemeralLocalId,
                                      type: "inbox selected variant",
                                      subvariant: "actions",
                                      subsectionTainted: false,
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
                                <Theme.Space layout />
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
                                    layout
                                    onClick={() =>
                                      setVariantAndTaint({
                                        ephemeralContactId:
                                          contact.ephemeralLocalId,
                                        type: "inbox selected variant",
                                        subvariant: "actions",
                                        subsectionTainted: false,
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
                                  <Theme.Space layout />
                                </React.Fragment>
                              ))}
                      </>
                    );

                    if (!pageTainted) return contents;

                    return (
                      <motion.div
                        layout
                        key="root variant"
                        animate={{ transform: "scale(1)" }}
                      >
                        {contents}
                      </motion.div>
                    );
                  })()
                : (() => {
                    const contact = mapEphemeralLocalIdToContact.get(
                      variant.ephemeralContactId
                    );

                    console.log(contact);

                    if (contact === undefined) {
                      console.log(new Error("This should be unreachable."));
                      return;
                    }

                    const base32EncodedShortId = base32.encode(
                      contact.globalId.slice(0, 10)
                    );
                    return (
                      <motion.div
                        layout
                        key="inbox selected variant"
                        animate={{ transform: "scale(1)" }}
                      >
                        <React.Fragment key={contact.ephemeralLocalId}>
                          <Theme.Item layout>
                            <div>{contact.label}</div>
                            <Localized
                              id="interpolated-inbox-id"
                              vars={{
                                inboxId: base32EncodedShortId,
                              }}
                            >
                              <div />
                            </Localized>
                          </Theme.Item>
                          <Theme.Space layout />
                        </React.Fragment>
                        <Theme.Space layout />
                        {(() => {
                          const subvariant = variant.subvariant;

                          if (subvariant === "actions") {
                            const contents = (
                              <>
                                <Theme.Button
                                  layout
                                  onClick={() =>
                                    setSubvariantAndTaint("rename")
                                  }
                                >
                                  <Localized id="rename" />
                                </Theme.Button>
                                <Theme.Space layout />
                                <CopyInboxId
                                  base32EncodedShortId={base32EncodedShortId}
                                />
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() =>
                                    setSubvariantAndTaint("edit inbox id")
                                  }
                                >
                                  <Localized id="edit-inbox-id" />
                                </Theme.Button>
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() =>
                                    setSubvariantAndTaint("delete")
                                  }
                                >
                                  <Localized id="delete" />
                                </Theme.Button>
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() => history.goBack()}
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </>
                            );

                            const subsectionTainted = variant.subsectionTainted;

                            if (!subsectionTainted) return contents;

                            return (
                              <motion.div
                                key="actions variant"
                                layout
                                animate={{ transform: "scale(1)" }}
                              >
                                {contents}
                              </motion.div>
                            );
                          }

                          if (subvariant === "rename") {
                            return (
                              <motion.div
                                key="rename variant"
                                layout
                                animate={{ transform: "scale(1)" }}
                              >
                                <SingleFieldForm
                                  defaultValue={contact.label}
                                  validate={(input) => {
                                    renameContact(contact, input);
                                    history.goBack();

                                    return {
                                      type: "sync",
                                      value: undefined,
                                    };
                                  }}
                                  submitButtonText="rename"
                                  inputPlaceholder="contact-name"
                                />
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() => history.goBack()}
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </motion.div>
                            );
                          }

                          if (subvariant === "edit inbox id") {
                            const currentContactInboxId = base32.encode(
                              contact.globalId.slice(0, 10)
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
                                      history.goBack();
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
                                                // Back to Actions subvariant
                                                history.goBack();
                                                // Back to root variant
                                                history.goBack();
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
                                            contact,
                                            publicHalves[0].publicEncryptionKey,
                                            publicHalves[0].publicSigningKey
                                          );

                                          history.goBack();
                                        }
                                      ),
                                    };
                                  }}
                                  submitButtonText="edit-inbox-id"
                                  inputPlaceholder="inbox-id"
                                />
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() => history.goBack()}
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </>
                            );
                          }

                          if (subvariant === "delete") {
                            return (
                              <motion.div
                                key="delete variant"
                                layout
                                animate={{ transform: "scale(1)" }}
                              >
                                <Theme.Text>
                                  <Localized id="contact-delete-confirm" />
                                </Theme.Text>
                                <Theme.Space layout />
                                <Theme.Button
                                  onClick={() => {
                                    const currentContact = contact;
                                    // Back to Actions subvariant
                                    history.goBack();
                                    // Back to root variant
                                    history.goBack();
                                    deleteContact(contacts, currentContact);
                                  }}
                                >
                                  <Localized id="delete" />
                                </Theme.Button>
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() => history.goBack()}
                                >
                                  <Localized id="go-back" />
                                </Theme.Button>
                              </motion.div>
                            );
                          }
                        })()}
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
