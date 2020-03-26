import styled from "styled-components";
const TextField = styled.input`
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 5px;
  line-height: inherit;
  font-size: inherit;
  width: 100%;
  margin-left: 8px;
  margin-right: 1px;
  margin-bottom: 1px;
  margin-top: 1px;
  padding-left: 3px;
  padding-right: 3px;
  font-family: inherit;
  outline: none;
  &:focus {
    margin-left: 7px;
    margin-right: 0px;
    margin-bottom: 0px;
    margin-top: 0px;
    border: 2px solid black;
    border-radius: 0;
  }
`;

export default TextField;
