CREATE TABLE IF NOT EXISTS contacts (
    global_id BLOB PRIMARY KEY NOT NULL,
    public_encryption_key BLOB NOT NULL,
    public_signing_key BLOB NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
)