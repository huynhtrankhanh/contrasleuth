import React, { useState } from "react";
import { motion } from "framer-motion";

export type Variant = {
  key: string;
  render: (setVariant: (key: string) => void) => React.ReactElement;
};
function MultivariantSection<T>({
  variants,
  defaultVariant,
}: {
  variants: Variant[];
  defaultVariant: string;
}) {
  const [variant, setVariant] = useState(defaultVariant);
  const [sectionTainted, setSectionTainted] = useState(false);

  const setVariantAndTaint = (variant: string) => {
    setVariant(variant);
    setSectionTainted(true);
  };

  return (
    <>
      {variants.map((variantDescriptor) => {
        if (variant !== variantDescriptor.key) {
          return <React.Fragment key={variantDescriptor.key} />;
        }

        if (variantDescriptor.key === defaultVariant && !sectionTainted) {
          return (
            <React.Fragment key={variantDescriptor.key}>
              {variantDescriptor.render(setVariant)}
            </React.Fragment>
          );
        }
        return (
          <motion.div
            key={variantDescriptor.key}
            animate={{ transform: "scale(1)" }}
          >
            {variantDescriptor.render(setVariantAndTaint)}
          </motion.div>
        );
      })}
    </>
  );
}

export default MultivariantSection;
