import React, { useState } from "react";
import { Localized } from "@fluent/react";
import * as Theme from "../theme";
import { useAnimation } from "framer-motion";

const CopyInboxId = ({
  base32EncodedShortId,
}: {
  base32EncodedShortId: string;
}) => {
  const [copyInboxIdButtonLabel, setCopyInboxIdButtonLabel] = useState<
    "copy-inbox-id" | "inbox-id-copied"
  >("copy-inbox-id");
  const copyInboxIdControls = useAnimation();

  return (
    <Localized id={copyInboxIdButtonLabel}>
      <Theme.Button
        initial={{ backgroundColor: "#d84315", color: "#ffffff" }}
        animate={copyInboxIdControls}
        onClick={() => {
          const inputElement = document.createElement("input");
          inputElement.value = base32EncodedShortId;
          document.body.appendChild(inputElement);
          inputElement.select();
          document.execCommand("copy");
          document.body.removeChild(inputElement);
          setCopyInboxIdButtonLabel("inbox-id-copied");
          copyInboxIdControls
            .start({ backgroundColor: "#ffffff", color: "#000000" })
            .then(() => {
              copyInboxIdControls
                .start({
                  backgroundColor: "#d84315",
                  color: "#ffffff",
                })
                .then(() => {
                  setCopyInboxIdButtonLabel("copy-inbox-id");
                });
            });
        }}
      />
    </Localized>
  );
};

export default CopyInboxId;
