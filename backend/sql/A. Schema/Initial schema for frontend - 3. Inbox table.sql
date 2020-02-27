CREATE TABLE IF NOT EXISTS inboxes (
    global_id BLOB PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    public_encryption_key BLOB NOT NULL,
    private_encryption_key BLOB NOT NULL,
    public_signing_key BLOB NOT NULL,
    private_signing_key BLOB NOT NULL,
    autosave_preference TEXT CHECK(
        autosave_preference IN ("autosave", "manual")
    ) NOT NULL
)