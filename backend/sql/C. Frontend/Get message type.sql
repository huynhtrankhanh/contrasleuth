SELECT
    message_type
FROM
    messages
WHERE
    global_id = ?
    AND inbox_id = ?