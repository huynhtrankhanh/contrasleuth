import { useState, ReactElement } from "react";
import uuid from "uuid/v4";
const StaticUUID = ({
  children: fn
}: {
  children: (uuid: string) => ReactElement;
}) => {
  const [id] = useState(uuid());
  return fn(id);
};
export default StaticUUID;
