import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory, useLocation } from "react-router-dom";
import { Localized } from "@fluent/react";
import {
  Inbox,
  synthesizeId,
  contacts,
  PublicHalf,
  synthesizeContactId,
  Message,
  Attachment,
  markMessageAsRead,
  unhideMessage,
  hideMessage,
  saveMessage,
  unsaveMessage,
  addContact,
} from "../store";
import { observer } from "mobx-react";
import InboxCard from "../components/InboxCard";
import MessagePreview from "../components/MessagePreview";
import * as base32 from "hi-base32";
import calculatePublicHalfId from "../calculatePublicHalfId";
import { Link } from "react-router-dom";
import moment from "moment/min/moment-with-locales";
import useTimestamp from "../useTimestamp";
import CopyInboxId from "../components/CopyInboxId";
import { SingleFieldForm } from "../components/SingleFieldForm";

const DisplayImageFromAttachment = ({
  attachment,
}: {
  attachment: Attachment;
}) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (url !== undefined) {
      URL.revokeObjectURL(url);
    }

    const blob = new Blob([new Uint8Array(attachment.blob)], {
      type: attachment.mimeType,
    });
    setUrl(URL.createObjectURL(blob));

    return () => {
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
    // eslint-disable-next-line
  }, [attachment]);

  if (url === undefined) return null;
  return (
    <motion.div style={{ display: "flex", justifyContent: "center" }} layout>
      <motion.img
        layout
        style={{ maxWidth: "100vw" }}
        src={url}
        alt=""
        onLoad={() => url !== undefined && URL.revokeObjectURL(url)}
      />
    </motion.div>
  );
};

const ViewMessage = observer(
  ({
    page,
    shouldEnter,
    setShouldEnter,
    inbox,
    messageId,
  }: {
    page: Page;
    shouldEnter: boolean;
    setShouldEnter: (value: boolean) => void;
    inbox: Inbox | null;
    messageId: string | null;
  }) => {
    const [visible, setVisible] = useState(false);
    const [flag, setFlag] = useState(false);
    const [animating, setAnimating] = useState(false);
    const controls = useAnimation();
    const history = useHistory();
    const location = useLocation();
    const [pageTainted, setPageTainted] = useState(false);

    useEffect(() => {
      if (page === "message") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
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
            setAnimating(false);
          });
      }
      // eslint-disable-next-line
    }, [visible]);

    const now = useTimestamp();

    const decodedMessageId = (() => {
      if (messageId === null) return undefined;
      return base32.decode.asBytes(messageId);
    })();

    useEffect(() => {
      if (inbox !== null && decodedMessageId !== undefined)
        markMessageAsRead(inbox, decodedMessageId);
    }, [inbox, decodedMessageId]);

    if (inbox === null) return null;
    if (!visible) return null;

    const message = (() => {
      if (decodedMessageId === undefined) return;
      const message = inbox.messages.get(synthesizeId(decodedMessageId));
      return message;
    })();

    if (message === undefined) {
      return (
        <Theme.NeatBackground
          initial={{ opacity: 0, transform: "scale(1.5)" }}
          animate={controls}
          className={
            animating
              ? "compose-and-view-message disable-interactions"
              : "compose-and-view-message"
          }
        >
          <Localized id="message-not-found">
            <Theme.Header layout />
          </Localized>
          <Theme.Space layout />
          <Theme.Text layout>
            <Localized id="message-not-found-explanation" />
          </Theme.Text>
        </Theme.NeatBackground>
      );
    }

    const repliedTo = (() => {
      if (message.inReplyTo === undefined) return;
      const syntheticId = synthesizeId(message.inReplyTo);
      const parent = inbox.messages.get(syntheticId);
      return parent;
    })();

    const base32EncodedId = base32.encode(inbox.globalId);
    const generateLink = (message: Message) =>
      "/message/" + base32EncodedId + "/" + base32.encode(message.globalId);

    type Variant =
      | { type: "root" }
      | { type: "unsave or hide" }
      | { type: "save or hide" }
      | { type: "recipients" }
      | { type: "replies" }
      | { type: "recipient"; publicHalf: PublicHalf }
      | { type: "add contact (recipient)"; publicHalf: PublicHalf }
      // There is only one sender for each message, so the sender can be fetched
      // directly from the message. It doesn't need to be included in the variant
      // data.
      | { type: "sender" }
      | { type: "add contact (sender)" };

    const variant = (() => {
      const state = location.state || ({} as any);

      if (state.viewMessageVariant === undefined) return { type: "root" };
      return state.viewMessageVariant;
    })() as Variant;

    const setVariant = (variant: Variant) => {
      const oldState = location.state || ({} as any);

      history.push(location.pathname, {
        ...oldState,
        viewMessageVariant: variant,
      });
    };

    const setVariantAndTaint = (variant: Variant) => {
      setVariant(variant);
      setPageTainted(true);
    };

    return (
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
        className="compose-and-view-message"
      >
        <Localized id="view-message">
          <Theme.Header layout />
        </Localized>
        {flag && (
          <>
            <motion.div
              layout
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              {(() => {
                const publicHalfActionsStage1 = (
                  role: "recipient" | "sender"
                ) => {
                  if (
                    variant.type !== "recipient" &&
                    variant.type !== "sender"
                  ) {
                    console.log(new Error("This should be unreachable."));
                    return null;
                  }

                  const selectedPublicHalf =
                    variant.type === "recipient"
                      ? variant.publicHalf
                      : message.sender;

                  const id = calculatePublicHalfId(
                    selectedPublicHalf.publicEncryptionKey,
                    selectedPublicHalf.publicSigningKey
                  );

                  const syntheticId = synthesizeContactId(
                    selectedPublicHalf.publicEncryptionKey,
                    selectedPublicHalf.publicSigningKey
                  );

                  return (
                    <>
                      <Theme.Space layout />
                      <Theme.Item layout>
                        <div>
                          <Theme.Deemphasize>
                            <Localized id={role} />
                          </Theme.Deemphasize>{" "}
                          {(() => {
                            const contact = contacts.get(syntheticId);

                            if (contact === undefined) {
                              return (
                                <Theme.Deemphasize>
                                  <Localized id="unknown" />
                                </Theme.Deemphasize>
                              );
                            }

                            return contact.label;
                          })()}
                        </div>
                        <div>
                          <Localized
                            id="interpolated-inbox-id"
                            vars={{ inboxId: base32.encode(id.slice(0, 10)) }}
                          />
                        </div>
                      </Theme.Item>
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <CopyInboxId
                        alternateColorScheme
                        base32EncodedShortId={base32.encode(id.slice(0, 10))}
                      />
                      {contacts.has(syntheticId) || (
                        <>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() =>
                              role === "recipient"
                                ? setVariant({
                                    type: "add contact (recipient)",
                                    publicHalf: selectedPublicHalf,
                                  })
                                : setVariant({ type: "add contact (sender)" })
                            }
                          >
                            <Localized id="add-contact" />
                          </Theme.Button>
                        </>
                      )}
                    </>
                  );
                };

                const publicHalfActionsStage2 = (
                  role: "recipient" | "sender"
                ) => {
                  if (
                    variant.type !== "add contact (recipient)" &&
                    variant.type !== "add contact (sender)"
                  ) {
                    console.log(new Error("This should be unreachable."));
                    return null;
                  }

                  const selectedPublicHalf =
                    variant.type === "add contact (recipient)"
                      ? variant.publicHalf
                      : message.sender;

                  return (
                    <>
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <SingleFieldForm
                        disableInteractions={animating}
                        validate={(name) => {
                          addContact(
                            contacts,
                            name,
                            selectedPublicHalf.publicEncryptionKey,
                            selectedPublicHalf.publicSigningKey
                          );

                          history.goBack();

                          return { type: "sync", value: undefined };
                        }}
                        submitButtonText="add-contact"
                        inputPlaceholder="contact-name"
                      />
                      <Theme.Space layout />
                    </>
                  );
                };

                if (variant.type === "root") {
                  const contents = (
                    <>
                      <Theme.Space layout />
                      <motion.div
                        layout
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        <InboxCard
                          inbox={inbox}
                          displayInboxNotifications={false}
                        />
                        <Theme.Space layout />
                        <Theme.Button onClick={() => history.goBack()}>
                          <Localized id="go-back" />
                        </Theme.Button>
                        {message.content.trim() !== "" && (
                          <>
                            <Theme.Space layout />
                            <Theme.Text
                              style={{ whiteSpace: "pre-wrap" }}
                              layout
                            >
                              {message.content}
                            </Theme.Text>
                          </>
                        )}
                      </motion.div>
                      {message.attachments.length > 0 && (
                        <>
                          <Theme.Space layout />
                          <DisplayImageFromAttachment
                            attachment={message.attachments[0]}
                          />
                        </>
                      )}
                      <motion.div
                        layout
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        <Theme.Space layout />
                        <Theme.Item
                          onClick={() => {
                            setVariantAndTaint({ type: "sender" });
                          }}
                          layout
                        >
                          <div>
                            <Theme.Deemphasize>
                              <Localized id="sender" />
                            </Theme.Deemphasize>{" "}
                            {(() => {
                              const syntheticId = synthesizeContactId(
                                message.sender.publicEncryptionKey,
                                message.sender.publicSigningKey
                              );
                              const contact = contacts.get(syntheticId);

                              if (contact === undefined) {
                                return (
                                  <Theme.Deemphasize>
                                    <Localized id="unknown" />
                                  </Theme.Deemphasize>
                                );
                              }

                              return contact.label;
                            })()}
                          </div>
                          <div>
                            <Localized
                              id="interpolated-inbox-id"
                              vars={{
                                inboxId: base32.encode(
                                  calculatePublicHalfId(
                                    message.sender.publicEncryptionKey,
                                    message.sender.publicSigningKey
                                  ).slice(0, 10)
                                ),
                              }}
                            />
                          </div>
                        </Theme.Item>
                        {message.inReplyTo !== undefined &&
                          repliedTo === undefined && (
                            <>
                              <Theme.Space layout />
                              <Theme.ItemWithDetails>
                                <div>
                                  <Localized id="parent-message-not-available" />
                                </div>
                                <div>
                                  <Localized id="parent-message-not-available-explanation" />
                                </div>
                              </Theme.ItemWithDetails>
                            </>
                          )}
                        {repliedTo !== undefined && (
                          <>
                            <Theme.Space layout />
                            <Link to={generateLink(repliedTo)}>
                              <MessagePreview
                                message={repliedTo}
                                inbox={inbox}
                                parent
                              />
                            </Link>
                          </>
                        )}
                        <Theme.Space layout />
                        <Theme.Button
                          layout
                          onClick={() => setVariant({ type: "recipients" })}
                        >
                          <Localized id="view-recipients" />
                        </Theme.Button>
                        {(
                          inbox.children.get(synthesizeId(message.globalId)) ||
                          new Set()
                        ).size > 0 && (
                          <>
                            <Theme.Space layout />
                            <Theme.Button
                              layout
                              onClick={() => setVariant({ type: "replies" })}
                            >
                              <Localized id="view-replies" />
                            </Theme.Button>
                          </>
                        )}
                        <Theme.Space layout />
                        {message.hidden ? (
                          <Theme.ItemWithDetails
                            layout
                            onClick={() =>
                              unhideMessage(inbox, message.globalId)
                            }
                          >
                            <div>
                              <Localized id="message-hidden" />
                              {message.expirationTime !== undefined && (
                                <>
                                  {" "}
                                  <Theme.Deemphasize>
                                    <Localized
                                      id="message-expires-in"
                                      vars={{
                                        formattedRelativeTime: moment
                                          .duration(
                                            moment(
                                              message.expirationTime * 1000
                                            ).diff(
                                              moment(
                                                Math.min(
                                                  now * 1000,
                                                  message.expirationTime * 1000
                                                )
                                              )
                                            )
                                          )
                                          .humanize(),
                                      }}
                                    />
                                  </Theme.Deemphasize>
                                </>
                              )}
                            </div>
                            <div>
                              <Localized id="message-hidden-explanation" />
                            </div>
                          </Theme.ItemWithDetails>
                        ) : message.messageType === "saved" ? (
                          <Theme.ItemWithDetails
                            layout
                            onClick={() =>
                              setVariant({ type: "unsave or hide" })
                            }
                          >
                            <div>
                              <Localized id="message-saved" />
                            </div>
                            <div>
                              <Localized id="message-saved-explanation" />
                            </div>
                          </Theme.ItemWithDetails>
                        ) : (
                          <Theme.ItemWithDetails
                            layout
                            onClick={() => setVariant({ type: "save or hide" })}
                          >
                            <div>
                              <Localized id="message-not-saved" />
                              {message.expirationTime !== undefined && (
                                <>
                                  {" "}
                                  <Theme.Deemphasize>
                                    <Localized
                                      id="message-expires-in"
                                      vars={{
                                        formattedRelativeTime: moment
                                          .duration(
                                            moment(
                                              message.expirationTime * 1000
                                            ).diff(
                                              moment(
                                                Math.min(
                                                  now * 1000,
                                                  message.expirationTime * 1000
                                                )
                                              )
                                            )
                                          )
                                          .humanize(),
                                      }}
                                    />
                                  </Theme.Deemphasize>
                                </>
                              )}
                            </div>
                            <div>
                              <Localized id="message-not-saved-explanation" />
                            </div>
                          </Theme.ItemWithDetails>
                        )}
                        <Theme.Space layout />
                        <Link
                          to={"/compose/" + base32EncodedId + "/" + messageId}
                        >
                          <Theme.Button layout>
                            <Localized id="reply" />
                          </Theme.Button>
                        </Link>
                      </motion.div>
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
                }

                if (variant.type === "unsave or hide") {
                  return (
                    <motion.div
                      layout
                      key="unsave or hide variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      <Theme.Space layout />
                      <Theme.ItemWithDetails
                        layout
                        onClick={() => {
                          history.goBack();
                          unsaveMessage(inbox, message.globalId);
                        }}
                      >
                        <div>
                          <Localized id="unsave-message" />
                        </div>
                        <div>
                          {message.expirationTime === undefined ? (
                            <Localized id="unsave-hide-expire-now" />
                          ) : message.expirationTime <= now ? (
                            <Localized id="unsave-hide-expire-now" />
                          ) : (
                            <Localized
                              id="unsave-expire-in-future"
                              vars={{
                                formattedRelativeTime: moment
                                  .duration(
                                    moment(message.expirationTime * 1000).diff(
                                      moment(
                                        Math.min(
                                          now * 1000,
                                          message.expirationTime * 1000
                                        )
                                      )
                                    )
                                  )
                                  .humanize(),
                              }}
                            />
                          )}
                        </div>
                      </Theme.ItemWithDetails>
                      <Theme.Space layout />
                      <Theme.ItemWithDetails
                        layout
                        onClick={() => {
                          history.goBack();
                          hideMessage(inbox, message.globalId);
                        }}
                      >
                        <div>
                          <Localized id="hide-message" />
                        </div>
                        <div>
                          {message.expirationTime === undefined ? (
                            <Localized id="unsave-hide-expire-now" />
                          ) : message.expirationTime <= now ? (
                            <Localized id="unsave-hide-expire-now" />
                          ) : (
                            <Localized
                              id="hide-expire-in-future"
                              vars={{
                                formattedRelativeTime: moment
                                  .duration(
                                    moment(message.expirationTime * 1000).diff(
                                      moment(
                                        Math.min(
                                          now * 1000,
                                          message.expirationTime * 1000
                                        )
                                      )
                                    )
                                  )
                                  .humanize(),
                              }}
                            />
                          )}
                        </div>
                      </Theme.ItemWithDetails>
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                    </motion.div>
                  );
                }

                if (variant.type === "save or hide") {
                  return (
                    <motion.div
                      layout
                      key="save or hide variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      <Theme.Space layout />
                      <Theme.Button
                        layout
                        onClick={() => {
                          history.goBack();
                          saveMessage(inbox, message.globalId);
                        }}
                      >
                        <Localized id="save-message" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <Theme.Button
                        layout
                        onClick={() => {
                          history.goBack();
                          hideMessage(inbox, message.globalId);
                        }}
                      >
                        <Localized id="hide-message" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                    </motion.div>
                  );
                }

                if (variant.type === "recipients") {
                  return (
                    <motion.div
                      key="recipients variant"
                      animate={{ transform: "scale(1)" }}
                      layout
                    >
                      <Theme.Space layout />
                      <Theme.Button onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                      {message.disclosedRecipients.map((recipient) => {
                        const syntheticId = synthesizeContactId(
                          recipient.publicEncryptionKey,
                          recipient.publicSigningKey
                        );
                        const id = calculatePublicHalfId(
                          recipient.publicEncryptionKey,
                          recipient.publicSigningKey
                        );
                        const shortInboxId = base32.encode(id.slice(0, 10));
                        const contact = contacts.get(syntheticId);

                        if (contact === undefined) {
                          return (
                            <React.Fragment key={syntheticId}>
                              <Theme.Space layout />
                              <Theme.Item
                                layout
                                onClick={() => {
                                  setVariant({
                                    type: "recipient",
                                    publicHalf: JSON.parse(
                                      JSON.stringify(recipient)
                                    ),
                                  });
                                }}
                              >
                                <div>
                                  <Theme.Deemphasize>
                                    <Localized id="recipient" />
                                  </Theme.Deemphasize>{" "}
                                  <Theme.Deemphasize>
                                    <Localized id="unknown" />
                                  </Theme.Deemphasize>
                                </div>
                                <div>{shortInboxId}</div>
                              </Theme.Item>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={syntheticId}>
                            <Theme.Space layout />
                            <Theme.Item
                              layout
                              onClick={() => {
                                setVariant({
                                  type: "recipient",
                                  publicHalf: JSON.parse(
                                    JSON.stringify(recipient)
                                  ),
                                });
                              }}
                            >
                              <div>
                                <Theme.Deemphasize>
                                  <Localized id="recipient" />
                                </Theme.Deemphasize>{" "}
                                {contact.label}
                              </div>
                              <div>{shortInboxId}</div>
                            </Theme.Item>
                          </React.Fragment>
                        );
                      })}
                    </motion.div>
                  );
                }

                if (variant.type === "replies") {
                  return (
                    <motion.div
                      key="replies variant"
                      animate={{ transform: "scale(1)" }}
                      layout
                    >
                      {" "}
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                      {[
                        ...inbox.children.get(synthesizeId(message.globalId)),
                      ].map((syntheticId) => {
                        const message = inbox.messages.get(syntheticId);
                        if (message === undefined) return null;
                        return (
                          <React.Fragment key={syntheticId}>
                            <Theme.Space layout />
                            <Link to={generateLink(message)}>
                              <MessagePreview message={message} inbox={inbox} />
                            </Link>
                          </React.Fragment>
                        );
                      })}
                    </motion.div>
                  );
                }

                if (variant.type === "recipient") {
                  return (
                    <motion.div
                      layout
                      key="recipient variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {publicHalfActionsStage1("recipient")}
                    </motion.div>
                  );
                }

                if (variant.type === "add contact (recipient)") {
                  return (
                    <motion.div
                      layout
                      key="add contact (recipient) variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {publicHalfActionsStage2("recipient")}
                    </motion.div>
                  );
                }

                if (variant.type === "sender") {
                  return (
                    <motion.div
                      layout
                      key="sender variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {publicHalfActionsStage1("sender")}
                    </motion.div>
                  );
                }

                if (variant.type === "add contact (sender)") {
                  return (
                    <motion.div
                      layout
                      key="add contact (sender) variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {publicHalfActionsStage2("sender")}
                    </motion.div>
                  );
                }
              })()}
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default ViewMessage;
