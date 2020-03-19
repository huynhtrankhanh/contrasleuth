UPDATE
    messages
SET
    message_type = ?
WHERE
    global_id = ?
    AND inbox_id = ?