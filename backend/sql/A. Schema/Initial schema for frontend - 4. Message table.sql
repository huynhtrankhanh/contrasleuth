CREATE TABLE IF NOT EXISTS messages (
    global_id BLOB PRIMARY KEY NOT NULL,
    message_type TEXT CHECK(
        message_type IN (
            "unsaved",
            "saved",
            "hidden"
        )
    ) NOT NULL,
    content BLOB NOT NULL,
    inbox_id BLOB NOT NULL,
    FOREIGN KEY(inbox_id) REFERENCES inboxes(global_id)
)