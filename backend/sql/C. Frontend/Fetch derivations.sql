SELECT
    derived_from
FROM
    message_content_derivation_table
WHERE
    derives = ?
    AND inbox_id = ?