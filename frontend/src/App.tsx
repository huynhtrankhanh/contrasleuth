import React, { useState, useEffect } from "react";
import {
  useParams,
  withRouter,
  Redirect,
  Route,
  Switch,
} from "react-router-dom";
import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import "./index.css";
import Page from "./pages";
import SelectInbox from "./pages/SelectInbox";
import CreateInbox from "./pages/CreateInbox";
import Contacts from "./pages/Contacts";
import AddContact from "./pages/AddContact";
import SetUpInbox from "./pages/SetUpInbox";
import InboxDetails from "./pages/InboxDetails";
import InboxSettings from "./pages/InboxSettings";
import InboxDoesNotExist from "./pages/InboxDoesNotExist";
import { observer } from "mobx-react";
import { inboxes, Inbox, synthesizeId, Message } from "./store";
import base32 from "hi-base32";
import ComposeMessage from "./pages/ComposeMessage";
import ViewMessage from "./pages/ViewMessage";

const App = withRouter(
  observer(() => {
    const [page, setPage] = useState<Page>("not found");
    const [shouldEnter, setShouldEnter] = useState(true);
    const [inbox, setInbox] = useState<Inbox | null>(null);
    const [inReplyTo, setInReplyTo] = useState<string | null>(null);
    const [messageId, setMessageId] = useState<string | null>(null);

    useEffect(() => {
      if (
        page !== "inbox" &&
        page !== "setup" &&
        page !== "inbox settings" &&
        page !== "compose" &&
        page !== "message" &&
        shouldEnter
      ) {
        setInbox(null);
        setInReplyTo(null);
      }
    }, [shouldEnter, page]);

    const goTo = (page: Page) => () => {
      setPage(page);
      return null;
    };

    const goToInbox = (inbox: Inbox) => () => {
      setInbox(inbox);
      setPage("inbox");
      return null;
    };

    const goToSetup = (inbox: Inbox) => () => {
      setInbox(inbox);
      setPage("setup");
      return null;
    };

    const goToSettings = (inbox: Inbox) => () => {
      setInbox(inbox);
      setPage("inbox settings");
      return null;
    };

    const goToCompose = (inbox: Inbox, inReplyTo: string | null) => () => {
      setInbox(inbox);
      setInReplyTo(inReplyTo);
      setPage("compose");
      return null;
    };

    const goToMessage = (inbox: Inbox, messageId: string) => () => {
      setInbox(inbox);
      setMessageId(messageId);
      setPage("message");
      return null;
    };

    return (
      <>
        {page === "not found" && shouldEnter && <InboxDoesNotExist />}
        <SelectInbox
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
        />
        <CreateInbox
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
        />
        <Contacts
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
        />
        <AddContact
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
        />
        <SetUpInbox
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
          inbox={inbox}
        />
        <InboxDetails
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
          inbox={inbox}
        />
        <InboxSettings
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
          inbox={inbox}
        />
        <ComposeMessage
          page={page}
          inReplyTo={inReplyTo}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
          inbox={inbox}
        />
        <ViewMessage
          page={page}
          shouldEnter={shouldEnter}
          setShouldEnter={setShouldEnter}
          inbox={inbox}
          messageId={messageId}
        />
        <Switch>
          <Route exact path="/select-inbox" component={goTo("select inbox")} />
          <Route exact path="/create-inbox" component={goTo("create inbox")} />
          <Route exact path="/contacts" component={goTo("contacts")} />
          <Route exact path="/add-contact" component={goTo("add contact")} />
          <Route
            exact
            path="/"
            render={() => <Redirect to="/select-inbox" />}
          />
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);
            const syntheticId = synthesizeId(inbox.globalId);
            const GoToInbox = goToInbox(inbox);
            return (
              <Route exact path={"/inbox/" + base32EncodedId} key={syntheticId}>
                {inboxes.has(syntheticId) ? (
                  inbox.setUp ? (
                    <GoToInbox />
                  ) : (
                    <Redirect to={"/setup/" + base32EncodedId} />
                  )
                ) : (
                  <Redirect to="/select-inbox" />
                )}
              </Route>
            );
          })}
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);

            if (inbox.setUp) {
              return (
                <Route
                  key={base32EncodedId}
                  exact
                  path={"/setup/" + base32EncodedId}
                  render={() => <Redirect to={"/inbox/" + base32EncodedId} />}
                />
              );
            }

            return (
              <Route
                key={base32EncodedId}
                exact
                path={"/setup/" + base32EncodedId}
                component={goToSetup(inbox)}
              />
            );
          })}
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);
            return (
              <Route
                key={base32EncodedId}
                exact
                path={"/settings/" + base32EncodedId}
                component={goToSettings(inbox)}
              />
            );
          })}
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);
            return (
              <Route
                key={base32EncodedId}
                exact
                path={"/compose/" + base32EncodedId}
                component={goToCompose(inbox, null)}
              />
            );
          })}
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);
            return (
              <Route
                key={base32EncodedId}
                exact
                path={"/compose/" + base32EncodedId + "/:inReplyTo"}
                component={() => {
                  const { inReplyTo } = useParams();
                  if (inReplyTo === undefined) {
                    console.log(new Error("This should be unreachable."));
                    return null;
                  }

                  return goToCompose(inbox, inReplyTo)();
                }}
              />
            );
          })}
          {[...inboxes.values()].map((inbox) => {
            const base32EncodedId = base32.encode(inbox.globalId);
            return (
              <Route
                key={base32EncodedId}
                exact
                path={"/message/" + base32EncodedId + "/:messageId"}
                component={() => {
                  const { messageId } = useParams();
                  if (messageId === undefined) {
                    console.log(new Error("This should be unreachable."));
                    return null;
                  }

                  return goToMessage(inbox, messageId)();
                }}
              />
            );
          })}
          <Route component={goTo("not found")} />
        </Switch>
      </>
    );
  })
);

export default () => (
  <IonApp>
    <IonReactRouter>
      <App />
    </IonReactRouter>
  </IonApp>
);
