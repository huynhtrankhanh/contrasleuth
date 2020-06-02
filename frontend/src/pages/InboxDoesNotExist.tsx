import React from "react";
import * as Theme from "../theme";
import { Localized } from "@fluent/react";
import { Link } from "react-router-dom";

const InboxDoesNotExist = () => (
  <Theme.AlternateBackground>
    <Localized id="inbox-does-not-exist">
      <Theme.Header />
    </Localized>
    <Theme.Space />
    <Localized id="inbox-does-not-exist-explanation">
      <Theme.Text />
    </Localized>
    <Theme.Space />
    <Link to="/">
      <Localized id="select-inbox">
        <Theme.Button className="transparent" />
      </Localized>
    </Link>
  </Theme.AlternateBackground>
);

export default InboxDoesNotExist;
