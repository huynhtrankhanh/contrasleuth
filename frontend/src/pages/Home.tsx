import React, { useState, useEffect } from "react";
import Heading from "../theme/Heading";
import Note from "../theme/Note";
import Text from "../theme/Text";
import Emoji from "../theme/Emoji";
import TextField from "../theme/TextField";
import ActionLink from "../theme/ActionLink";
import Separator from "../theme/Separator";
import Card from "../theme/Card";
import HorizontalAlign from "../theme/HorizontalAlign";
import StaticUUID from "../components/StaticUUID";
import Label from "../theme/Label";
import { Flipper, Flipped } from "react-flip-toolkit";

const Home = () => {
  const [toggle, setToggle] = useState(true);
  return (
    <>
      <Heading>Inboxes</Heading>
      <Separator />
      <StaticUUID>
        {uuid => (
          <Flipper flipKey={toggle}>
            <Flipped flipId={uuid}>
              <Card
                as={toggle ? "button" : undefined}
                onClick={toggle ? () => setToggle(false) : undefined}
              >
                <Flipped inverseFlipId={uuid}>
                  <div>
                    {toggle ? (
                      <HorizontalAlign>
                        <Emoji role="img" aria-hidden>
                          📝
                        </Emoji>
                        <Text>No inboxes. Create a new one.</Text>
                      </HorizontalAlign>
                    ) : (
                      <div>
                        <Heading>New inbox</Heading>
                        <Separator />
                        <Text>
                          <HorizontalAlign>
                            <StaticUUID>
                              {uuid => (
                                <>
                                  <Label htmlFor={uuid}>Label:</Label>{" "}
                                  <TextField id={uuid} />
                                </>
                              )}
                            </StaticUUID>
                          </HorizontalAlign>
                          <Separator />
                          <Card as="button">
                            <HorizontalAlign>
                              <Emoji role="img" aria-hidden>
                                📝
                              </Emoji>
                              <Text>Create inbox</Text>
                            </HorizontalAlign>
                          </Card>
                          <Separator />
                          <Card as="button" onClick={() => setToggle(true)}>
                            <HorizontalAlign>
                              <Emoji role="img" aria-hidden>
                                ❌
                              </Emoji>
                              <Text>Cancel</Text>
                            </HorizontalAlign>
                          </Card>
                        </Text>
                      </div>
                    )}
                  </div>
                </Flipped>
              </Card>
            </Flipped>
          </Flipper>
        )}
      </StaticUUID>
    </>
  );
};

export default Home;
