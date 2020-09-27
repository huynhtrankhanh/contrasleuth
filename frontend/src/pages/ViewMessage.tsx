import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Theme from "../theme";
import Page from "../pages";
import { useHistory } from "react-router-dom";
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
import MultivariantSection, {
  Variant,
} from "../components/MultivariantSection";
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
    const controls = useAnimation();
    const history = useHistory();

    const [selectedPublicHalf, setSelectedPublicHalf] = useState<
      PublicHalf | undefined
    >(undefined);

    useEffect(() => {
      if (page === "message") {
        if (!visible && shouldEnter) {
          setVisible(true);
          setShouldEnter(false);
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
              setSelectedPublicHalf(undefined);
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

    const now = useTimestamp();

    if (inbox === null) return null;
    if (!visible) return null;

    const message = (() => {
      if (messageId === null) return;
      const decoded = base32.decode.asBytes(messageId);
      const message = inbox.messages.get(synthesizeId(decoded));
      return message;
    })();

    if (message === undefined) {
      return (
        <Theme.NeatBackground
          initial={{ opacity: 0, transform: "scale(1.5)" }}
          animate={controls}
          className="compose-and-view-message"
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

    markMessageAsRead(inbox, message.globalId);

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
              <MultivariantSection
                variants={((): Variant[] => {
                  const publicHalfActionsStage1 = (
                    role: "recipient" | "sender"
                  ) => (setVariant: (value: string) => void) => {
                    if (selectedPublicHalf === undefined) {
                      console.log(new Error("This should be unreachable."));
                      return <></>;
                    }

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
                        <Theme.Button
                          layout
                          onClick={() =>
                            role === "recipient"
                              ? setVariant("recipients")
                              : setVariant("root")
                          }
                        >
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
                                  ? setVariant("add contact (recipient)")
                                  : setVariant("add contact (sender)")
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
                  ) => (setVariant: (value: string) => void) => {
                    if (selectedPublicHalf === undefined) {
                      console.log(new Error("This should be unreachable."));
                      return <></>;
                    }
                    return (
                      <>
                        <Theme.Space layout />
                        <Theme.Button
                          layout
                          onClick={() =>
                            role === "recipient"
                              ? setVariant("recipient")
                              : setVariant("sender")
                          }
                        >
                          <Localized id="go-back" />
                        </Theme.Button>
                        <Theme.Space layout />
                        <SingleFieldForm
                          validate={(name) => {
                            addContact(
                              contacts,
                              name,
                              selectedPublicHalf.publicEncryptionKey,
                              selectedPublicHalf.publicSigningKey
                            );
                            if (role === "recipient") {
                              setVariant("recipient");
                            } else {
                              setVariant("sender");
                            }
                            return { type: "sync", value: undefined };
                          }}
                          submitButtonText="add-contact"
                          inputPlaceholder="contact-name"
                        />
                        <Theme.Space layout />
                      </>
                    );
                  };

                  return [
                    {
                      key: "root",
                      render: (setVariant) => (
                        <>
                          <Theme.Space layout />
                          <motion.div
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
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                            }}
                          >
                            <Theme.Space layout />
                            <Theme.Item
                              onClick={() => {
                                setSelectedPublicHalf(message.sender);
                                setVariant("sender");
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
                              onClick={() => setVariant("recipients")}
                            >
                              <Localized id="view-recipients" />
                            </Theme.Button>
                            {(
                              inbox.children.get(
                                synthesizeId(message.globalId)
                              ) || new Set()
                            ).size > 0 && (
                              <>
                                <Theme.Space layout />
                                <Theme.Button
                                  layout
                                  onClick={() => setVariant("replies")}
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
                                                      message.expirationTime *
                                                        1000
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
                                onClick={() => setVariant("unsave or hide")}
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
                                onClick={() => setVariant("save or hide")}
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
                                                      message.expirationTime *
                                                        1000
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
                              to={
                                "/compose/" + base32EncodedId + "/" + messageId
                              }
                            >
                              <Theme.Button layout>
                                <Localized id="reply" />
                              </Theme.Button>
                            </Link>
                          </motion.div>
                        </>
                      ),
                    },
                    {
                      key: "unsave or hide",
                      render: (setVariant) => (
                        <>
                          <Theme.Space layout />
                          <Theme.ItemWithDetails
                            layout
                            onClick={() => {
                              setVariant("root");
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
                              )}
                            </div>
                          </Theme.ItemWithDetails>
                          <Theme.Space layout />
                          <Theme.ItemWithDetails
                            layout
                            onClick={() => {
                              setVariant("root");
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
                              )}
                            </div>
                          </Theme.ItemWithDetails>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => setVariant("root")}
                          >
                            <Localized id="go-back" />
                          </Theme.Button>
                        </>
                      ),
                    },
                    {
                      key: "save or hide",
                      render: (setVariant) => (
                        <>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => {
                              setVariant("root");
                              saveMessage(inbox, message.globalId);
                            }}
                          >
                            <Localized id="save-message" />
                          </Theme.Button>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => {
                              setVariant("root");
                              hideMessage(inbox, message.globalId);
                            }}
                          >
                            <Localized id="hide-message" />
                          </Theme.Button>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => setVariant("root")}
                          >
                            <Localized id="go-back" />
                          </Theme.Button>
                        </>
                      ),
                    },
                    {
                      key: "recipients",
                      render: (setVariant) => (
                        <>
                          <Theme.Space layout />
                          <Theme.Button onClick={() => setVariant("root")}>
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
                                      setSelectedPublicHalf(recipient);
                                      setVariant("recipient");
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
                                    setSelectedPublicHalf(recipient);
                                    setVariant("recipient");
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
                        </>
                      ),
                    },
                    {
                      key: "replies",
                      render: (setVariant) => (
                        <>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => setVariant("root")}
                          >
                            <Localized id="go-back" />
                          </Theme.Button>
                          {[
                            ...inbox.children.get(
                              synthesizeId(message.globalId)
                            ),
                          ].map((syntheticId) => {
                            const message = inbox.messages.get(syntheticId);
                            if (message === undefined) return null;
                            return (
                              <React.Fragment key={syntheticId}>
                                <Theme.Space layout />
                                <Link to={generateLink(message)}>
                                  <MessagePreview
                                    message={message}
                                    inbox={inbox}
                                  />
                                </Link>
                              </React.Fragment>
                            );
                          })}
                        </>
                      ),
                    },
                    {
                      key: "recipient",
                      render: publicHalfActionsStage1("recipient"),
                    },
                    {
                      key: "add contact (recipient)",
                      render: publicHalfActionsStage2("recipient"),
                    },
                    {
                      key: "sender",
                      render: publicHalfActionsStage1("sender"),
                    },
                    {
                      key: "add contact (sender)",
                      render: publicHalfActionsStage2("sender"),
                    },
                  ];
                })()}
                key={JSON.stringify([inbox.globalId, message.globalId])}
                defaultVariant="root"
              />
            </motion.div>
          </>
        )}
      </Theme.NeatBackground>
    );
  }
);

export default ViewMessage;
