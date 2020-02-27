DELETE FROM
    message_content_derivation_table
WHERE
    derived_from = ?
    AND derives = ?
    AND inbox_id = ?