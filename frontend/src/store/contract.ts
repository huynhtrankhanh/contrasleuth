const contract = (callback: () => void) => {
  const dumpState = () => {};

  const addInbox = () => {};
  const renameInbox = () => {};
  const deleteInbox = () => {};
  const setAutosavePreference = () => {};
  const getPublicHalfEntry = () => {};

  const saveMessage = () => {};
  const unsaveMessage = () => {};
  const hideMessage = () => {};
  const encodeMessage = () => {};

  const insertMessage = () => {};

  return {
    dumpState,
    addInbox,
    renameInbox,
    deleteInbox,
    setAutosavePreference,
    getPublicHalfEntry,
    saveMessage,
    unsaveMessage,
    hideMessage,
    encodeMessage,
    insertMessage
  };
};

export default Contract;
