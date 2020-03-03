UPDATE
    contacts
SET
    public_encryption_key = ?,
    public_signing_key = ?,
    global_id = ?
WHERE
    global_id = ?