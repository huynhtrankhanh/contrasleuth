import React, { useState, useEffect, useRef } from "react";
import * as Theme from "../theme";
import { Localized } from "@fluent/react";
import { motion, useAnimation, AnimationControls } from "framer-motion";

export const Input = ({
  children,
  value,
  setValue,
  controls,
  inputRef,
}: {
  children?: string;
  value: string;
  setValue: (value: string) => void;
  controls: AnimationControls;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}) => (
  <Theme.Input
    ref={inputRef}
    placeholder={children}
    value={value}
    onChange={(event) => setValue(event.target.value)}
    initial={{ transform: "scale(1)" }}
    animate={controls}
  />
);

export const Submit = ({ children }: { children?: string }) => (
  <Theme.Button layout as={motion.input} type="submit" value={children} />
);

export type ValidationError = {
  title: string;
  description: string;
  action?: {
    title: string;
    callback: () => void;
  };
};

export type SyncOrAsync<T> =
  | {
      type: "sync";
      value: T;
    }
  | { type: "async"; value: Promise<T> };

export const SingleFieldForm = ({
  validate,
  submitButtonText,
  inputPlaceholder,
  defaultValue,
}: {
  validate: (input: string) => SyncOrAsync<ValidationError | undefined>;
  submitButtonText: string;
  inputPlaceholder: string;
  defaultValue?: string;
}) => {
  const [input, setInput] = useState(
    defaultValue === undefined ? "" : defaultValue
  );
  const controls = useAnimation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [validateResult, setValidateResult] = useState<
    ValidationError | undefined
  >(undefined);

  useEffect(() => {
    if (inputRef.current !== null) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inputRef]);

  return (
    <motion.form
      layout
      onSubmit={(event) => {
        event.preventDefault();
        if (input.trim() === "") {
          controls
            .start({ transform: "scale(1.5)" })
            .then(() => controls.start({ transform: "scale(1)" }));
          if (inputRef.current !== null) {
            inputRef.current.focus();
          }
          return;
        }

        const validateResult = validate(input);

        if (validateResult.type === "sync") {
          setValidateResult(validateResult.value);
        } else {
          validateResult.value.then((value) => setValidateResult(value));
        }
      }}
    >
      {validateResult !== undefined && (
        <>
          <Theme.ItemWithDetails layout>
            <Localized id={validateResult.title}>
              <div />
            </Localized>
            <Localized id={validateResult.description}>
              <div />
            </Localized>
          </Theme.ItemWithDetails>
          {validateResult.action !== undefined && (
            <>
              <Theme.Space layout />
              <Theme.Button layout onClick={validateResult.action.callback}>
                <Localized id={validateResult.action.title} />
              </Theme.Button>
            </>
          )}
          <Theme.Space layout />
        </>
      )}
      <Localized id={inputPlaceholder}>
        <Input
          inputRef={inputRef}
          value={input}
          setValue={setInput}
          controls={controls}
        />
      </Localized>
      <Theme.Space layout />
      <Localized id={submitButtonText}>
        <Submit />
      </Localized>
    </motion.form>
  );
};
