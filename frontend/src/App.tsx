import React from "react";
import { Redirect, Route } from "react-router-dom";
import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import styled from "styled-components";
import Home from "./pages/Home";
import "./index.css";

const AppName = styled.div`
  padding-top: 20px;
  padding-bottom: 20px;
  font-size: 30px;
  text-align: center;
`;

const Outermost = styled.div`
  display: flex;
  justify-content: center;
`;

const Outer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  width: calc(100vw - 20px - 20px);
  max-width: 600px;
  min-height: calc(100vh - 32px);
  @media (min-width: 600px) {
    border-left: 1px solid rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(0, 0, 0, 0.2);
  }
  padding-left: 20px;
  padding-right: 20px;
  padding-bottom: 32px;
`;

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <Outermost>
        <Outer>
          <AppName>Parlance</AppName>
          <Route exact path="/home" component={Home} />
          <Route exact path="/" render={() => <Redirect to="/home" />} />
        </Outer>
      </Outermost>
    </IonReactRouter>
  </IonApp>
);

export default App;
