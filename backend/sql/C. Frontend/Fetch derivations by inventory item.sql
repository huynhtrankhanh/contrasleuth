SELECT
    derives,
    inbox_id
FROM
    message_content_derivation_table
WHERE
    derived_from = ?