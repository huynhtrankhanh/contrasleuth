CREATE TABLE IF NOT EXISTS inventory (
    blake2b BLOB PRIMARY KEY NOT NULL,
    payload BLOB NOT NULL,
    nonce INTEGER NOT NULL,
    expiration_time INTEGER NOT NULL
)
