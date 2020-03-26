import styled from "styled-components";
const Card = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 5px;
  padding-left: 6px;
  padding-right: 6px;
  padding-top: 6px;
  padding-bottom: 6px;
  width: calc(100% - 1px - 1px - 6px - 6px);
  max-width: 400px;
  overflow: hidden;
  margin: 1px;

  :focus {
    margin: 0px;
    border: 2px solid black;
    border-radius: 0;
    :active {
      border-radius: 5px;
    }
  }
`;

export default Card;
