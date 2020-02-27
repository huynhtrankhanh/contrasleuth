import React from "react";
import Heading from "../theme/Heading";
import Text from "../theme/Text";
import Note from "../theme/Note";
const Page = () => (
  <>
    <Heading>Ephemerality</Heading>
    <Text>
      In Parlance, everything is ephemeral. Mobile devices can only hold so much
      data. As encrypted messages are broadcast to every Parlance user to ensure
      deliverability and guard users' privacy, we have to be careful not to
      overburden devices running Parlance.
    </Text>
    <Heading id="inbox-ephemerality">Inbox ephemerality</Heading>
    <Text>
      When an inbox is created, an entry containing the public keys of the inbox
      is made. Public keys are binary data that is used to route messages to
      your inbox. That entry expires after 28 days and you can only renew an
      inbox when it has expired. A notification will be delivered to your device
      when one of your inboxes expires.
    </Text>
    <Text>
      People who wish to contact you have to look up your public keys. If they
      choose to store your inbox ID in their contact list, your public keys will
      be stored there as well and they will be able to contact you anytime
      without being subject to inbox ephemerality.
    </Text>
    <Text>
      If they don't store your ID in their contact list, when your inbox
      expires, they won't be able to contact you until you renew your inbox.
    </Text>
    <Heading>An exception to inbox ephemerality</Heading>
    <Text>
      Your public keys are also attached to your messages in addition to being
      stored in an entry. If your inbox expires and and they still have some of
      your messages,{" "}
      <Note>
        even though they haven't stored your inbox ID in their contact list,
      </Note>{" "}
      they will still be able to contact you.
    </Text>
    <Heading>Message and broadcast ephemerality</Heading>
    <Text>
      Messages and broadcasts are stored in the network for the duration you
      specify when you make them. People who receive your messages and
      broadcasts can save them to their device to be able to access them after
      they expire.
    </Text>
    <Heading>Automatic message saving</Heading>
    <Text>
      You can opt into automatic message saving. When that option is enabled,
      every message sent to you is automatically stored in your device and you
      can access your messages even after they expire.
    </Text>
  </>
);

export default Page;
