import React, { useState, useEffect, useRef, useReducer } from "react";
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
  lookupPublicHalf,
  sendMessage,
} from "../store";
import { observer } from "mobx-react";
import InboxCard from "../components/InboxCard";
import MessagePreview from "../components/MessagePreview";
import * as base32 from "hi-base32";
import BoldOccurrences from "../components/BoldOccurrences";
import calculatePublicHalfId from "../calculatePublicHalfId";

const TextInput = ({
  children,
  value,
  setValue,
}: {
  children?: string;
  value: string;
  setValue: (value: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current !== null) inputRef.current.select();
  }, []);

  return (
    <Theme.Input
      placeholder={children}
      ref={inputRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      layout
    />
  );
};

const RenderOnPromiseResolution = function <T>({
  promise,
  render,
}: {
  promise: Promise<T>;
  render: (value: T) => any;
}) {
  const [resolved, setResolved] = useState<T | undefined>(undefined);
  const counterRef = useRef(0);

  useEffect(() => {
    const currentCounter = ++counterRef.current;
    promise.then((resolved) => {
      if (currentCounter === counterRef.current) {
        setResolved(resolved);
      }
    });
  }, [promise]);

  return <>{resolved !== undefined && render(resolved)}</>;
};

const makeSet = (recipients: PublicHalf[]) =>
  new Set(
    recipients.map(({ publicEncryptionKey, publicSigningKey }) =>
      synthesizeContactId(publicEncryptionKey, publicSigningKey)
    )
  );

const DisplayImageFromFileObject = ({ file }: { file: File }) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (url !== undefined) {
      URL.revokeObjectURL(url);
    }

    setUrl(URL.createObjectURL(file));

    return () => {
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
    // eslint-disable-next-line
  }, [file]);

  if (url === undefined) return null;
  return (
    <motion.img
      layout
      style={{
        maxHeight: "500px",
        maxWidth: "calc(min(100vw - 2 * 20px, 500px))",
      }}
      src={url}
      alt=""
      onLoad={() => url !== undefined && URL.revokeObjectURL(url)}
    />
  );
};

const ComposeMessage = observer(
  ({
    page,
    shouldEnter,
    setShouldEnter,
    inbox,
    inReplyTo,
  }: {
    page: Page;
    shouldEnter: boolean;
    setShouldEnter: (value: boolean) => void;
    inbox: Inbox | null;
    inReplyTo: string | null;
  }) => {
    const [visible, setVisible] = useState(false);
    const [flag, setFlag] = useState(false);
    const controls = useAnimation();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const history = useHistory();
    const [searchQuery, setSearchQuery] = useState("");

    const location = useLocation();

    type Variant =
      | "compose"
      | "recipients"
      | "add disclosed recipients"
      | "add hidden recipients"
      | "time to live";

    const variant = (() => {
      const state = location.state || ({} as any);

      if (state.composeMessageVaraint === undefined) return "compose";
      return state.composeMessageVaraint;
    })() as Variant;

    const setVariant = (variant: Variant) => {
      const oldState = location.state || ({} as any);

      history.push(location.pathname, {
        ...oldState,
        composeMessageVaraint: variant,
      });
    };

    const [pageTainted, setPageTainted] = useState(false);

    const setVariantAndTaint = (variant: Variant) => {
      setVariant(variant);
      setPageTainted(true);
    };

    useEffect(() => {
      if (page === "compose") {
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
            });
        } else {
          setSearchQuery("");
          dispatch({ type: "reset" });
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
            dispatch({ type: "reset" });
            if (inputRef.current !== null) inputRef.current.focus();
          });
      // eslint-disable-next-line
    }, [visible]);

    const equal = (publicHalf1: PublicHalf, publicHalf2: PublicHalf) =>
      synthesizeContactId(
        publicHalf1.publicEncryptionKey,
        publicHalf1.publicSigningKey
      ) ===
      synthesizeContactId(
        publicHalf2.publicEncryptionKey,
        publicHalf2.publicSigningKey
      );

    const selectImage = () => {
      const inputElement = document.getElementById(
        "file-input-for-image-selection"
      ) as HTMLInputElement;
      inputElement.addEventListener("change", function handler() {
        const files = inputElement.files;
        if (files !== null && files.length >= 1) {
          const file = files[0];
          dispatch({ type: "set image", image: file });

          inputElement.removeEventListener("change", handler);

          inputElement.value = "";

          return;
        }

        inputElement.removeEventListener("change", handler);
      });
      inputElement.click();
    };

    type State = {
      disclosedRecipients: PublicHalf[];
      hiddenRecipients: PublicHalf[];
      content: string;
      image: File | undefined;
      expirationTime: 1 | 4 | 7 | undefined;
      selectedRecipients: PublicHalf[];
    };

    type Action =
      | { type: "select recipient"; publicHalf: PublicHalf }
      | { type: "unselect recipient"; publicHalf: PublicHalf }
      | { type: "add hidden recipients" }
      | { type: "add disclosed recipients" }
      | { type: "remove hidden recipient"; publicHalf: PublicHalf }
      | { type: "remove disclosed recipient"; publicHalf: PublicHalf }
      | { type: "clear selected" }
      | { type: "set image"; image: File }
      | { type: "clear image" }
      | { type: "set content"; content: string }
      | { type: "set expiration time"; expirationTime: 1 | 4 | 7 }
      | { type: "reset" };

    const repliedTo = (() => {
      if (inbox === null) return undefined;
      if (inReplyTo === null) return undefined;
      const decodedId = base32.decode.asBytes(inReplyTo);
      return inbox.messages.get(synthesizeId(decodedId));
    })();

    const initialState = () => ({
      disclosedRecipients: (() => {
        if (repliedTo === undefined) return [];
        const recipientSet = new Set();
        const recipients = [];
        if (inbox === null) return [];
        const syntheticInboxId = synthesizeContactId(
          inbox.publicHalf.publicEncryptionKey,
          inbox.publicHalf.publicSigningKey
        );

        for (const recipient of repliedTo.disclosedRecipients) {
          const syntheticId = synthesizeContactId(
            recipient.publicEncryptionKey,
            recipient.publicSigningKey
          );
          if (syntheticId === syntheticInboxId) continue;
          if (recipientSet.has(syntheticId)) continue;
          recipientSet.add(syntheticId);
          recipients.push(recipient);
        }

        {
          const syntheticId = synthesizeContactId(
            repliedTo.sender.publicEncryptionKey,
            repliedTo.sender.publicSigningKey
          );
          if (!recipientSet.has(syntheticId)) {
            recipientSet.add(syntheticId);
            recipients.push(repliedTo.sender);
          }
        }

        return recipients;
      })(),
      hiddenRecipients: [],
      content: "",
      image: undefined,
      expirationTime: undefined,
      selectedRecipients: [],
    });

    const [state, dispatch] = useReducer(
      (state: State, action: Action): State => {
        switch (action.type) {
          case "select recipient": {
            if (
              state.selectedRecipients.every(
                (recipient) => !equal(recipient, action.publicHalf)
              )
            ) {
              return {
                ...state,
                selectedRecipients: [
                  ...state.selectedRecipients,
                  action.publicHalf,
                ],
              };
            }
            return state;
          }
          case "unselect recipient": {
            return {
              ...state,
              selectedRecipients: state.selectedRecipients.filter(
                (recipient) => !equal(recipient, action.publicHalf)
              ),
            };
          }
          case "add hidden recipients": {
            const selectedRecipientSet = makeSet(state.selectedRecipients);
            const hiddenRecipientSet = makeSet(state.hiddenRecipients);

            return {
              ...state,
              disclosedRecipients: state.disclosedRecipients.filter(
                (recipient) => {
                  const syntheticId = synthesizeContactId(
                    recipient.publicEncryptionKey,
                    recipient.publicSigningKey
                  );

                  return !selectedRecipientSet.has(syntheticId);
                }
              ),
              hiddenRecipients: state.hiddenRecipients.concat(
                state.selectedRecipients.filter((recipient) => {
                  const syntheticId = synthesizeContactId(
                    recipient.publicEncryptionKey,
                    recipient.publicSigningKey
                  );

                  return !hiddenRecipientSet.has(syntheticId);
                })
              ),
              selectedRecipients: [],
            };
          }
          case "add disclosed recipients": {
            const selectedRecipientSet = makeSet(state.selectedRecipients);
            const disclosedRecipientSet = makeSet(state.disclosedRecipients);

            return {
              ...state,
              hiddenRecipients: state.hiddenRecipients.filter((recipient) => {
                const syntheticId = synthesizeContactId(
                  recipient.publicEncryptionKey,
                  recipient.publicSigningKey
                );

                return !selectedRecipientSet.has(syntheticId);
              }),
              disclosedRecipients: state.disclosedRecipients.concat(
                state.selectedRecipients.filter((recipient) => {
                  const syntheticId = synthesizeContactId(
                    recipient.publicEncryptionKey,
                    recipient.publicSigningKey
                  );

                  return !disclosedRecipientSet.has(syntheticId);
                })
              ),
              selectedRecipients: [],
            };
          }
          case "remove hidden recipient": {
            const { publicEncryptionKey, publicSigningKey } = action.publicHalf;
            const syntheticId = synthesizeContactId(
              publicEncryptionKey,
              publicSigningKey
            );
            return {
              ...state,
              hiddenRecipients: state.hiddenRecipients.filter(
                ({ publicEncryptionKey, publicSigningKey }) =>
                  synthesizeContactId(publicEncryptionKey, publicSigningKey) !==
                  syntheticId
              ),
            };
          }
          case "remove disclosed recipient": {
            const { publicEncryptionKey, publicSigningKey } = action.publicHalf;
            const syntheticId = synthesizeContactId(
              publicEncryptionKey,
              publicSigningKey
            );
            return {
              ...state,
              disclosedRecipients: state.disclosedRecipients.filter(
                ({ publicEncryptionKey, publicSigningKey }) =>
                  synthesizeContactId(publicEncryptionKey, publicSigningKey) !==
                  syntheticId
              ),
            };
          }
          case "clear selected": {
            return { ...state, selectedRecipients: [] };
          }
          case "set image": {
            return { ...state, image: action.image };
          }
          case "clear image": {
            return { ...state, image: undefined };
          }
          case "set content": {
            return { ...state, content: action.content };
          }
          case "set expiration time": {
            return { ...state, expirationTime: action.expirationTime };
          }
          case "reset": {
            return initialState();
          }
        }
      },
      initialState()
    );

    const recipientLimit = 255;

    if (inbox === null) return null;
    if (!visible) return null;

    return (
      <Theme.NeatBackground
        initial={{ opacity: 0, transform: "scale(1.5)" }}
        animate={controls}
        className="compose-and-view-message"
      >
        <Localized id="compose-message">
          <Theme.Header layout />
        </Localized>
        {flag && (
          <>
            <motion.div
              layout
              style={{ transform: "scale(0.5)" }}
              animate={{ transform: "scale(1)" }}
            >
              <Theme.Space layout />
              <InboxCard inbox={inbox} displayInboxNotifications={false} />
              {inReplyTo !== null &&
                (repliedTo !== undefined ? (
                  <>
                    <Theme.Space layout />
                    <MessagePreview message={repliedTo} inbox={inbox} />
                  </>
                ) : (
                  <>
                    <Theme.Space layout />
                    <Theme.ItemWithDetails layout>
                      <div>
                        <Localized id="cant-retrieve-message" />
                      </div>
                      <div>
                        <Localized id="cant-retrieve-message-explanation" />
                      </div>
                    </Theme.ItemWithDetails>
                  </>
                ))}
              <Theme.Space layout />
              <input
                type="file"
                accept="image/png, image/jpeg, image/bmp, image/webp"
                id="file-input-for-image-selection"
                style={{ display: "none" }}
              />
              {(() => {
                const addRecipient = (
                  type: "disclosed" | "hidden",
                  setVariant: (key: Variant) => void
                ) => {
                  const recipientLimitExceeded =
                    state.disclosedRecipients.length +
                      state.hiddenRecipients.length +
                      state.selectedRecipients.length >
                    recipientLimit;

                  const selectedSet = makeSet(state.selectedRecipients);

                  return (
                    <>
                      <Localized id="search-contacts-or-type-inbox-id">
                        <TextInput
                          value={searchQuery}
                          setValue={setSearchQuery}
                        />
                      </Localized>
                      <Theme.Space layout />
                      <Theme.Button
                        onClick={() => {
                          setSearchQuery("");
                          dispatch({ type: "clear selected" });
                          history.goBack();
                        }}
                        layout
                      >
                        <Localized id="go-back" />
                      </Theme.Button>
                      <Theme.Space layout />
                      {state.selectedRecipients.length > 0 && (
                        <Theme.Sticky layout>
                          <Theme.Button
                            layout
                            disabled={recipientLimitExceeded}
                            onClick={() => {
                              if (type === "disclosed") {
                                dispatch({
                                  type: "add disclosed recipients",
                                });
                              } else {
                                dispatch({ type: "add hidden recipients" });
                              }
                              setSearchQuery("");
                              history.goBack();
                            }}
                          >
                            <Localized
                              id={
                                recipientLimitExceeded
                                  ? "recipient-limit-exceeded"
                                  : type === "disclosed"
                                  ? "add-disclosed-recipients-selected"
                                  : "add-hidden-recipients-selected"
                              }
                              vars={{
                                selectedCount: state.selectedRecipients.length,
                              }}
                            />
                          </Theme.Button>
                        </Theme.Sticky>
                      )}
                      {(() => {
                        const normalizedInboxId = searchQuery.toUpperCase();

                        const valid =
                          normalizedInboxId.length === 16 &&
                          [...normalizedInboxId].every((character) =>
                            "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".includes(
                              character
                            )
                          );

                        if (!valid) return null;

                        return (
                          <RenderOnPromiseResolution
                            promise={lookupPublicHalf(
                              base32.decode.asBytes(normalizedInboxId)
                            )}
                            render={(publicHalves) => {
                              if (publicHalves.length === 0) return null;
                              const publicHalf = publicHalves[0];

                              const syntheticId = synthesizeContactId(
                                publicHalf.publicEncryptionKey,
                                publicHalf.publicSigningKey
                              );

                              if (contacts.has(syntheticId)) return null;
                              if (selectedSet.has(syntheticId)) return null;

                              return (
                                <motion.div
                                  layout
                                  initial={{ transform: "scale(0)" }}
                                  animate={{ transform: "scale(1)" }}
                                >
                                  <Theme.Space layout />
                                  <Theme.Item
                                    layout
                                    onClick={() =>
                                      dispatch({
                                        type: "select recipient",
                                        publicHalf,
                                      })
                                    }
                                  >
                                    <div>
                                      <Theme.Deemphasize>
                                        <Localized id="inbox-id-lookup-result" />
                                      </Theme.Deemphasize>
                                    </div>
                                    <div>
                                      <Theme.Bold>
                                        {normalizedInboxId}
                                      </Theme.Bold>
                                    </div>
                                  </Theme.Item>
                                </motion.div>
                              );
                            }}
                          />
                        );
                      })()}
                      {state.selectedRecipients
                        .map((publicHalf) => {
                          const syntheticId = synthesizeContactId(
                            publicHalf.publicEncryptionKey,
                            publicHalf.publicSigningKey
                          );
                          const id = calculatePublicHalfId(
                            publicHalf.publicEncryptionKey,
                            publicHalf.publicSigningKey
                          );
                          const shortInboxId = base32.encode(id.slice(0, 10));
                          const contact = contacts.get(syntheticId);

                          if (contact === undefined) {
                            if (
                              !shortInboxId
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())
                            )
                              return undefined;

                            return (
                              <React.Fragment key={syntheticId}>
                                <Theme.Space layout />
                                <Theme.Item
                                  layout
                                  onClick={() =>
                                    dispatch({
                                      type: "unselect recipient",
                                      publicHalf,
                                    })
                                  }
                                  className="selected"
                                >
                                  <div>
                                    <Theme.Deemphasize>
                                      <Localized id="inbox-id-lookup-result" />
                                    </Theme.Deemphasize>
                                  </div>
                                  <div>
                                    <BoldOccurrences highlight={searchQuery}>
                                      {shortInboxId}
                                    </BoldOccurrences>
                                  </div>
                                </Theme.Item>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={contact.ephemeralLocalId}>
                              <Theme.Space layout />
                              <Theme.Item
                                layout
                                onClick={() =>
                                  dispatch({
                                    type: "unselect recipient",
                                    publicHalf: {
                                      publicEncryptionKey:
                                        contact.publicEncryptionKey,
                                      publicSigningKey:
                                        contact.publicSigningKey,
                                    },
                                  })
                                }
                                className="selected"
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
                            </React.Fragment>
                          );
                        })
                        .filter((value) => value !== undefined)}
                      {[...contacts.values()]
                        .map((contact) => ({
                          contact,
                          shortInboxId: base32.encode(
                            contact.globalId.slice(0, 10)
                          ),
                        }))
                        .filter(
                          ({ contact, shortInboxId }) =>
                            (contact.label
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()) ||
                              shortInboxId
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())) &&
                            !selectedSet.has(
                              synthesizeContactId(
                                contact.publicEncryptionKey,
                                contact.publicSigningKey
                              )
                            )
                        )
                        .map(({ contact, shortInboxId }) => (
                          <React.Fragment key={contact.ephemeralLocalId}>
                            <Theme.Space layout />
                            <Theme.Item
                              layout
                              onClick={() =>
                                dispatch({
                                  type: "select recipient",
                                  publicHalf: {
                                    publicEncryptionKey:
                                      contact.publicEncryptionKey,
                                    publicSigningKey: contact.publicSigningKey,
                                  },
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
                          </React.Fragment>
                        ))}
                    </>
                  );
                };

                if (variant === "compose") {
                  const contents = (
                    <>
                      {state.image === undefined ? (
                        <Theme.Button onClick={selectImage} layout>
                          <Localized id="attach-image" />
                        </Theme.Button>
                      ) : (
                        <>
                          <motion.div
                            layout
                            style={{
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <DisplayImageFromFileObject file={state.image} />
                          </motion.div>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => dispatch({ type: "clear image" })}
                          >
                            <Localized id="remove-image" />
                          </Theme.Button>
                        </>
                      )}
                      <Theme.Space layout />
                      <Theme.Button onClick={() => history.goBack()} layout>
                        <Localized id="go-back" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <motion.div layout>
                        <Theme.Textarea
                          value={state.content}
                          onChange={(event) =>
                            dispatch({
                              type: "set content",
                              content: event.target.value,
                            })
                          }
                        />
                      </motion.div>
                      {(state.content.trim() !== "" ||
                        state.image !== undefined) && (
                        <>
                          <Theme.Space layout />
                          <Theme.Button
                            onClick={() => setVariantAndTaint("recipients")}
                            layout
                          >
                            <Localized id="send" />
                          </Theme.Button>
                        </>
                      )}
                    </>
                  );

                  if (!pageTainted) return contents;

                  return (
                    <motion.div
                      layout
                      key="compose variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {contents}
                    </motion.div>
                  );
                }

                if (variant === "recipients") {
                  return (
                    <motion.div
                      layout
                      key="recipients variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      <Theme.Button onClick={() => history.goBack()} layout>
                        <Localized id="go-back" />
                      </Theme.Button>
                      <motion.hr layout />
                      <Theme.ItemWithDetails
                        layout
                        className="no-bottom-rounded-corners"
                      >
                        <div>
                          <Localized id="disclosed-recipients" />
                        </div>
                        <div>
                          <Localized id="disclosed-recipients-explanation" />
                        </div>
                      </Theme.ItemWithDetails>
                      <Theme.Button
                        layout
                        className="no-top-rounded-border"
                        onClick={() =>
                          setVariantAndTaint("add disclosed recipients")
                        }
                      >
                        <Localized id="add-disclosed-recipients" />
                      </Theme.Button>
                      {state.disclosedRecipients.map((publicHalf) => {
                        const syntheticId = synthesizeContactId(
                          publicHalf.publicEncryptionKey,
                          publicHalf.publicSigningKey
                        );
                        const id = calculatePublicHalfId(
                          publicHalf.publicEncryptionKey,
                          publicHalf.publicSigningKey
                        );
                        const shortInboxId = base32.encode(id.slice(0, 10));
                        const contact = contacts.get(syntheticId);

                        if (contact === undefined) {
                          return (
                            <React.Fragment key={syntheticId}>
                              <Theme.Space layout />
                              <Theme.Item
                                layout
                                onClick={() =>
                                  dispatch({
                                    type: "remove disclosed recipient",
                                    publicHalf,
                                  })
                                }
                              >
                                <div>
                                  <Theme.Deemphasize>
                                    <Localized id="inbox-id-lookup-result-tap-to-remove" />
                                  </Theme.Deemphasize>
                                </div>
                                <div>{shortInboxId}</div>
                              </Theme.Item>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={contact.ephemeralLocalId}>
                            <Theme.Space layout />
                            <Theme.Item
                              layout
                              onClick={() =>
                                dispatch({
                                  type: "remove disclosed recipient",
                                  publicHalf,
                                })
                              }
                            >
                              <div>
                                {contact.label}{" "}
                                <Theme.Deemphasize>
                                  <Localized id="tap-to-remove" />
                                </Theme.Deemphasize>
                              </div>
                              <div>{shortInboxId}</div>
                            </Theme.Item>
                          </React.Fragment>
                        );
                      })}
                      <motion.hr layout />
                      <Theme.ItemWithDetails
                        layout
                        className="no-bottom-rounded-corners"
                      >
                        <div>
                          <Localized id="hidden-recipients" />
                        </div>
                        <div>
                          <Localized id="hidden-recipients-explanation" />
                        </div>
                      </Theme.ItemWithDetails>
                      <Theme.Button
                        layout
                        className="no-top-rounded-border"
                        onClick={() =>
                          setVariantAndTaint("add hidden recipients")
                        }
                      >
                        <Localized id="add-hidden-recipients" />
                      </Theme.Button>
                      {state.hiddenRecipients.map((publicHalf) => {
                        const syntheticId = synthesizeContactId(
                          publicHalf.publicEncryptionKey,
                          publicHalf.publicSigningKey
                        );
                        const id = calculatePublicHalfId(
                          publicHalf.publicEncryptionKey,
                          publicHalf.publicSigningKey
                        );
                        const shortInboxId = base32.encode(id.slice(0, 10));
                        const contact = contacts.get(syntheticId);

                        if (contact === undefined) {
                          return (
                            <React.Fragment key={syntheticId}>
                              <Theme.Space layout />
                              <Theme.Item
                                layout
                                onClick={() =>
                                  dispatch({
                                    type: "remove hidden recipient",
                                    publicHalf,
                                  })
                                }
                              >
                                <div>
                                  <Theme.Deemphasize>
                                    <Localized id="inbox-id-lookup-result-tap-to-remove" />
                                  </Theme.Deemphasize>
                                </div>
                                <div>{shortInboxId}</div>
                              </Theme.Item>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={contact.ephemeralLocalId}>
                            <Theme.Space layout />
                            <Theme.Item
                              layout
                              onClick={() =>
                                dispatch({
                                  type: "remove hidden recipient",
                                  publicHalf,
                                })
                              }
                            >
                              <div>
                                {contact.label}{" "}
                                <Theme.Deemphasize>
                                  <Localized id="tap-to-remove" />
                                </Theme.Deemphasize>
                              </div>
                              <div>{shortInboxId}</div>
                            </Theme.Item>
                          </React.Fragment>
                        );
                      })}
                      {(state.disclosedRecipients.length > 0 ||
                        state.hiddenRecipients.length > 0) && (
                        <>
                          <motion.hr layout />
                          <Theme.Button
                            layout
                            onClick={() => setVariantAndTaint("time to live")}
                          >
                            <Localized id="send" />
                          </Theme.Button>
                        </>
                      )}
                    </motion.div>
                  );
                }

                if (variant === "add disclosed recipients") {
                  return (
                    <motion.div
                      layout
                      key="add disclosed recipients variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {addRecipient("disclosed", setVariantAndTaint)}
                    </motion.div>
                  );
                }

                if (variant === "add hidden recipients") {
                  return (
                    <motion.div
                      layout
                      key="add hidden recipients variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      {addRecipient("hidden", setVariantAndTaint)}
                    </motion.div>
                  );
                }

                if (variant === "time to live") {
                  return (
                    <motion.div
                      layout
                      key="time to live variant"
                      animate={{ transform: "scale(1)" }}
                    >
                      <Theme.Text layout>
                        <Localized id="time-to-live-explanation" />
                      </Theme.Text>
                      <Theme.Space layout />
                      <Theme.Button layout onClick={() => history.goBack()}>
                        <Localized id="go-back" />
                      </Theme.Button>
                      {state.expirationTime !== undefined && (
                        <>
                          <Theme.Space layout />
                          <Theme.Button
                            layout
                            onClick={() => {
                              const compressedImagePromise = new Promise<
                                Blob | undefined
                              >((resolve) => {
                                if (state.image !== undefined) {
                                  const url = URL.createObjectURL(state.image);
                                  const image = new Image();

                                  image.src = url;
                                  image.addEventListener("load", () => {
                                    const resizeImage = (): [
                                      number,
                                      number
                                    ] => {
                                      const maxDimension = Math.max(
                                        image.width,
                                        image.height
                                      );
                                      if (maxDimension <= 1200)
                                        return [image.width, image.height];
                                      return [
                                        (image.width * 1200) / maxDimension,
                                        (image.height * 1200) / maxDimension,
                                      ];
                                    };

                                    const [newWidth, newHeight] = resizeImage();

                                    const canvas = document.createElement(
                                      "canvas"
                                    );
                                    canvas.width = newWidth;
                                    canvas.height = newHeight;
                                    const context = canvas.getContext("2d");
                                    if (context === null) {
                                      console.log(
                                        new Error("This should be unreachable.")
                                      );
                                      URL.revokeObjectURL(url);
                                      return;
                                    }
                                    context.imageSmoothingQuality = "high";
                                    context.drawImage(
                                      image,
                                      0,
                                      0,
                                      newWidth,
                                      newHeight
                                    );
                                    canvas.toBlob(
                                      (blob) => {
                                        if (blob === null) {
                                          console.log(
                                            new Error(
                                              "This should be unreachable."
                                            )
                                          );
                                          return;
                                        }

                                        resolve(blob);
                                      },
                                      "image/webp",
                                      0.7
                                    );
                                    URL.revokeObjectURL(url);
                                  });
                                } else {
                                  resolve(undefined);
                                }
                              });

                              compressedImagePromise
                                .then((compressedImage) =>
                                  compressedImage === undefined
                                    ? undefined
                                    : (((compressedImage as unknown) as any).arrayBuffer() as Promise<
                                        ArrayBuffer
                                      >)
                                )
                                .then((compressedImage) => {
                                  if (state.expirationTime === undefined) {
                                    console.log(
                                      new Error("This should be unreachable.")
                                    );
                                    return;
                                  }

                                  const expirationTime = (() => {
                                    const oneDay = 86400;
                                    const delta = state.expirationTime * oneDay;
                                    const now = Math.trunc(Date.now() / 1000);
                                    return now + delta;
                                  })();

                                  sendMessage(
                                    inbox,
                                    inReplyTo === null
                                      ? undefined
                                      : base32.decode.asBytes(inReplyTo),
                                    state.disclosedRecipients,
                                    "plaintext",
                                    state.content,
                                    compressedImage === undefined
                                      ? []
                                      : [
                                          {
                                            mimeType: "image/webp",
                                            blob: [
                                              ...new Uint8Array(
                                                compressedImage
                                              ),
                                            ],
                                          },
                                        ],
                                    state.hiddenRecipients.concat(
                                      (() => {
                                        const disclosedRecipientSet = makeSet(
                                          state.disclosedRecipients
                                        );
                                        const hiddenRecipientSet = makeSet(
                                          state.hiddenRecipients
                                        );
                                        const syntheticId = synthesizeContactId(
                                          inbox.publicHalf.publicEncryptionKey,
                                          inbox.publicHalf.publicSigningKey
                                        );
                                        if (
                                          disclosedRecipientSet.has(syntheticId)
                                        )
                                          return [];
                                        if (hiddenRecipientSet.has(syntheticId))
                                          return [];
                                        return [inbox.publicHalf];
                                      })()
                                    ),
                                    expirationTime
                                  );
                                });

                              // Back to Recipients variant
                              history.goBack();
                              // Back to Compose variant
                              history.goBack();
                              // Back to the inbox
                              history.goBack();
                            }}
                          >
                            <Localized id="send" />
                          </Theme.Button>
                        </>
                      )}
                      <Theme.Space layout />
                      <Theme.Button
                        layout
                        className={state.expirationTime === 1 ? "selected" : ""}
                        onClick={() =>
                          dispatch({
                            type: "set expiration time",
                            expirationTime: 1,
                          })
                        }
                      >
                        <Localized id="a-day" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <Theme.Button
                        layout
                        className={state.expirationTime === 4 ? "selected" : ""}
                        onClick={() =>
                          dispatch({
                            type: "set expiration time",
                            expirationTime: 4,
                          })
                        }
                      >
                        <Localized id="four-days" />
                      </Theme.Button>
                      <Theme.Space layout />
                      <Theme.Button
                        layout
                        className={state.expirationTime === 7 ? "selected" : ""}
                        onClick={() =>
                          dispatch({
                            type: "set expiration time",
                            expirationTime: 7,
                          })
                        }
                      >
                        <Localized id="seven-days" />
                      </Theme.Button>
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

export default ComposeMessage;
