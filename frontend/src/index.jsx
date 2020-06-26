import React from "react";
import ReactDOM from "react-dom";
import * as serviceWorker from "./serviceWorker";
import * as store from "./store";
import "mobx-react/batchingForReactDom";
import { negotiateLanguages } from "@fluent/langneg";
import { FluentBundle, FluentResource } from "@fluent/bundle";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { ready } from "libsodium-wrappers";
import moment from "moment/min/moment-with-locales";

import enUS from "./l10n/en-US.ft.txt";
import viVN from "./l10n/vi-VN.ft.txt";

// For debugging.
window.store = store;

const languages = negotiateLanguages(navigator.languages, ["en-US", "vi-VN"], {
  defaultLocale: "en-US",
});

const locales = { "en-US": enUS, "vi-VN": viVN };

moment.locale(languages[0]);

Promise.all([
  Promise.all(
    languages.map((locale) =>
      fetch(locales[locale])
        .then((response) => response.text())
        .then((body) => {
          const bundle = new FluentBundle(locale);
          const errors = bundle.addResource(new FluentResource(body));
          if (errors.length > 0) {
            console.log("Errors in locale ", locale);
            console.log(errors);
          }
          return bundle;
        })
    )
  ),
  ready,
]).then(([bundles, _]) => {
  console.log("Loaded bundles:", bundles);
  const l10n = new ReactLocalization(bundles);
  import("./App").then(({ default: App }) =>
    ReactDOM.render(
      <LocalizationProvider l10n={l10n}>
        <App />
      </LocalizationProvider>,
      document.getElementById("root")
    )
  );
});

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
