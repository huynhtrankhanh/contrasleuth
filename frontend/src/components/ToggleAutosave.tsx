import React from "react";
import { Localized } from "@fluent/react";
import { useInvertedScale, motion } from "framer-motion";

const ToggleAutosave = ({ autosave }: { autosave: boolean }) => {
  const inverted = useInvertedScale();
  return autosave ? (
    <>
      <Localized id="save-messages-automatically">
        <motion.div style={inverted} />
      </Localized>
      <Localized id="save-messages-automatically-explanation">
        <motion.div style={inverted} />
      </Localized>
    </>
  ) : (
    <>
      <Localized id="save-messages-manually">
        <motion.div style={inverted} />
      </Localized>
      <Localized id="save-messages-manually-explanation">
        <motion.div style={inverted} />
      </Localized>
    </>
  );
};

export default ToggleAutosave;
