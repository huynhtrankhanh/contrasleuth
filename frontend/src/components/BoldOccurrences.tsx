import React from "react";
import * as Theme from "../theme";

const BoldOccurrences = ({
  children,
  highlight,
}: {
  children: string | undefined;
  highlight: string;
}) => {
  if (children === undefined) return null;
  if (highlight === "") return <>{children}</>;

  const flags = Array(children.length).fill(false);

  {
    const lowercasedChildren = children.toLowerCase();
    const lowercasedHighlight = highlight.toLowerCase();

    let startIndex = lowercasedChildren.indexOf(lowercasedHighlight);
    while (startIndex !== -1) {
      for (let i = startIndex; i < startIndex + highlight.length; i++) {
        flags[i] = true;
      }
      startIndex = lowercasedChildren.indexOf(
        lowercasedHighlight,
        startIndex + 1
      );
    }
  }

  const renderDescriptions: { highlighted: boolean; text: string }[] = [];

  for (let i = 0; i < flags.length; i++) {
    if (i === 0 || flags[i] !== flags[i - 1]) {
      renderDescriptions.push({ highlighted: flags[i], text: "" });
    }

    renderDescriptions[renderDescriptions.length - 1].text += children[i];
  }

  return (
    <>
      {renderDescriptions.map(({ highlighted, text }, index) => (
        <React.Fragment key={index}>
          {highlighted ? <Theme.Bold>{text}</Theme.Bold> : text}
        </React.Fragment>
      ))}
    </>
  );
};

export default BoldOccurrences;
