import styled from "styled-components";
import { motion } from "framer-motion";

export const NeatBackground = styled(motion.div)`
  min-width: 100vw;
  min-height: calc(100vh - 64px);
  padding-top: 32px;
  padding-bottom: 32px;
  background: #d84315;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: white;
  flex-direction: column;
`;

export const Sticky = styled(motion.div)`
  position: sticky;
  top: 16px;
`;

export const Space = styled(motion.div)`
  margin-top: 12px;
`;

export const Header = styled(motion.h1)`
  font-size: 32px;
  font-weight: bold;
  text-align: center;
`;

export const Item = styled(motion.button)`
  appearance: none;
  vertical-align: middle;
  color: inherit;
  font: inherit;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  outline: 0;
  border-radius: 0;
  text-align: inherit;
  box-sizing: content-box;
  cursor: pointer;

  display: block;
  border-radius: 7px;
  background: #b71c1c;
  width: calc(100vw - 2 * 40px);
  padding-left: 20px;
  padding-right: 20px;
  max-width: 500px;
  font-size: 18px;
  line-height: 40px;
  text-overflow: ellipsis;
  overflow: hidden;
  &.no-top-rounded-corners {
    border-top-left-radius: 0px;
    border-top-right-radius: 0px;
  }
`;

export const Button = styled(motion.button)`
  appearance: none;
  vertical-align: middle;
  color: inherit;
  font: inherit;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  outline: 0;
  border-radius: 0;
  text-align: inherit;
  box-sizing: content-box;
  cursor: pointer;

  background: #d84315;
  display: block;
  border-radius: 7px;
  width: calc(100vw - 2 * 40px);
  padding-left: 20px;
  padding-right: 20px;
  max-width: 500px;
  border: 1px solid white;
  line-height: 40px;
  font-size: 18px;
`;

export const Input = styled(motion.input)`
  display: block;
  border-radius: 7px;
  background: #b71c1c;
  width: calc(100vw - 2 * 40px - 2px);
  padding-left: 21px;
  padding-right: 21px;
  padding-top: 1px;
  padding-bottom: 1px;
  max-width: 498px;
  border: 1px solid white;
  line-height: 38px;
  font-size: 18px;
  outline: none;
  color: white;
  &::placeholder {
    color: white;
    opacity: 0.7;
  }
  &:focus {
    border: 2px solid white;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 0px;
    padding-bottom: 0px;
    margin: 0;
  }
`;

export const InboxNotifications = styled(motion.div)`
  width: calc(100vw - 2 * 40px);
  padding-left: 20px;
  padding-right: 20px;
  max-width: 500px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  background-color: #fdd835;
  color: #b71c1c;
  text-transform: uppercase;
  font-size: 14px;
  line-height: 22px;
`;
