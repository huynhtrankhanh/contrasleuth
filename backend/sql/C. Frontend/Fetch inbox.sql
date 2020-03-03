SELECT
    global_id,
    label,
    public_encryption_key,
    private_encryption_key,
    public_signing_key,
    private_signing_key,
    autosave_preference
FROM
    inboxes
WHERE
    global_id = ?