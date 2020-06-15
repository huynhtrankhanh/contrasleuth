CREATE TABLE IF NOT EXISTS message_content_derivation_table (
    derived_from BLOB NOT NULL,
    derives BLOB NOT NULL,
    inbox_id BLOB NOT NULL
)