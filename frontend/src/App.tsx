import React, { useState, useEffect } from "react";
import { withRouter, Redirect, Route, Switch } from "react-router-dom";
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
import { inboxes, Inbox, synthesizeId } from "./store";
import base32 from "hi-base32";

const App = withRouter(
  observer(() => {
    const [page, setPage] = useState<Page>("not found");
    const [shouldEnter, setShouldEnter] = useState(true);
    const [inbox, setInbox] = useState<Inbox | null>(null);

    useEffect(() => {
      if (
        page !== "inbox" &&
        page !== "setup" &&
        page !== "inbox settings" &&
        shouldEnter
      ) {
        setInbox(null);
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
