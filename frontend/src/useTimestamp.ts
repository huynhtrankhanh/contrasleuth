import { useState, useEffect } from "react";

const eventBus = document.createElement("event-bus");

setInterval(() => {
  eventBus.dispatchEvent(new Event("tick"));
}, 1000);

const useTimestamp = () => {
  const [timestamp, setTimestamp] = useState(Math.trunc(Date.now() / 1000));
  useEffect(() => {
    const handler = () => setTimestamp(Math.trunc(Date.now() / 1000));
    eventBus.addEventListener("tick", handler);
    return () => eventBus.removeEventListener("tick", handler);
  }, []);
  return timestamp;
};

export default useTimestamp;
