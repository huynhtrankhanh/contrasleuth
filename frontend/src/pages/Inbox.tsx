import React from "react";
import { HashLink } from "react-router-hash-link";
import HorizontalAlign from "../theme/HorizontalAlign";
import Label from "../theme/Label";
import Section from "../theme/Section";
import Heading from "../theme/Heading";
import Note from "../theme/Note";
import Text from "../theme/Text";
import TextField from "../theme/TextField";
import Action from "../theme/Action";
import StaticUUID from "../components/StaticUUID";

const Inbox = () => (
  <>
    <Text>
      <Note>
        Connected to 5 devices and the Internet. 6215 messages in inventory.
      </Note>
    </Text>
    <Heading>Inbox information</Heading>
    <Text>
      Label: Lorem Ipsum <Action to="#">(change)</Action>
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
      Your inbox will expire in 7 days. Learn more about{" "}
      <Action as={HashLink} smooth to="/help/ephemerality#inbox-ephemerality">
        why inboxes expire and what happens when they do.
      </Action>
    </Text>
    <hr />
    <Heading>Deprioritized and ignored messages</Heading>
    <Text>
      <Action to="#">View deprioritized and ignored messages.</Action>
    </Text>
    <hr />
    <Heading>Messages stored in inventory</Heading>
    <Text>
      Do you want to view these messages after they expire?{" "}
      <Action to="#">Enable automatic message saving.</Action>
    </Text>
    <Section>
      <Text>
        <Note>From</Note> Parlance contributors, <Note>expires in 1 day</Note>{" "}
        <Action to="#">(save)</Action> <Action to="#">(ignore)</Action>
      </Text>
      <Heading>A hearty welcome!</Heading>
      <Text>
        <Action to="#">Message truncated. View full message.</Action>
      </Text>
    </Section>
    <hr />
    <Heading>Saved messages</Heading>
  </>
);

export default Inbox;
