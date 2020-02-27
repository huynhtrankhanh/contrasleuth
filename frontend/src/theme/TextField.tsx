import styled from "styled-components";
const TextField = styled.input`
  line-height: inherit;
  font-size: inherit;
  width: 100%;
  margin-left: 7px;
  padding-left: 3px;
  padding-right: 3px;
  font-family: inherit;
  outline: 1px solid rgba(0, 0, 0, 0.6);
  &:focus {
    outline: 2px solid black;
  }
`;

export default TextField;
