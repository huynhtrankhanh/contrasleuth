import React, { useState } from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import "./index.css";
import Page from "./pages";
import SelectInbox from "./pages/SelectInbox";
import CreateInbox from "./pages/CreateInbox";
import Contacts from "./pages/Contacts";
import AddContact from "./pages/AddContact";

const App: React.FC = () => {
  const [page, setPage] = useState<Page>("not found");
  const [shouldEnter, setShouldEnter] = useState(true);

  const goTo = (page: Page) => () => {
    setPage(page);
    return null;
  };

  return (
    <IonApp>
      <IonReactRouter>
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
          <Route component={goTo("not found")} />
        </Switch>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
