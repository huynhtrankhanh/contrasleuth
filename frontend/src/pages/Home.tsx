import React from "react";
import Heading from "../theme/Heading";
import Note from "../theme/Note";
import Text from "../theme/Text";
import TextField from "../theme/TextField";
import Action from "../theme/Action";
import SectionWithEmphasis from "../theme/SectionWithEmphasis";
import HorizontalAlign from "../theme/HorizontalAlign";
import StaticUUID from "../components/StaticUUID";
import Label from "../theme/Label";

const Home = () => (
  <>
    <Heading>Inboxes</Heading>
    <Text>
      Nothing here yet. Do you want to{" "}
      <Action to="#">create a new inbox?</Action>
    </Text>
    <SectionWithEmphasis>
      <Heading>New inbox</Heading>
      <Text>
        <HorizontalAlign>
          <StaticUUID>
            {uuid => (
              <>
                <Label htmlFor={uuid}>Label:</Label> <TextField id={uuid} />
              </>
            )}
          </StaticUUID>
        </HorizontalAlign>
      </Text>
      <Text>
        <HorizontalAlign>
          <StaticUUID>
            {uuid => (
              <>
                <Label htmlFor={uuid}>ID:</Label>{" "}
                <TextField id={uuid} value="f23ieifabwsdtu7x" readOnly />
              </>
            )}
          </StaticUUID>
        </HorizontalAlign>
      </Text>
      <Text>
        <Note>Inbox ID is randomly assigned and can't be changed.</Note>
      </Text>
    </SectionWithEmphasis>
  </>
);

export default Home;
