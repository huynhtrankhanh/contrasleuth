UPDATE
    messages
SET
    message_type = ?
WHERE
    message_id = ?
    AND inbox_id = ?