import styled from "styled-components";
import { Link } from "react-router-dom";
const Action = styled(Link)`
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  &:focus {
    outline: 1px solid black;
  }
`;

export default Action;
