import React, { useState } from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import "./index.css";
import SelectInbox from "./pages/SelectInbox";
import Page from "./pages";
import CreateInbox from "./pages/CreateInbox";

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
        <Switch>
          <Route exact path="/select-inbox" component={goTo("select inbox")} />
          <Route exact path="/create-inbox" component={goTo("create inbox")} />
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
