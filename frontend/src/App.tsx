import React from "react";
import { Redirect, Route } from "react-router-dom";
import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import styled from "styled-components";
import Home from "./pages/Home";
import Inbox from "./pages/Inbox";
import Ephemerality from "./help/Ephemerality";
import "./index.css";

const AppName = styled.div`
  padding-top: 20px;
  padding-bottom: 20px;
  font-size: 30px;
  text-align: center;
`;

const Outer = styled.div`
  padding-left: 10vw;
  padding-right: 10vw;
  padding-bottom: 32px;
`;

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <Outer>
        <AppName>Parlance</AppName>
        <Route exact path="/home" component={Home} />
        <Route exact path="/inbox" component={Inbox} />
        <Route exact path="/" render={() => <Redirect to="/home" />} />
        <Route exact path="/help/ephemerality" component={Ephemerality} />
      </Outer>
    </IonReactRouter>
  </IonApp>
);

export default App;
