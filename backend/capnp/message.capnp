@0x87db98e2c793a47f;

struct PublicKey @0xc2f0428ee6b0d361 {
    publicEncryptionKey @0 :Data;
    publicSigningKey @1 :Data;
}

struct Attachment @0xadaeb5b804df50e9 {
    mimeType @0 :Text;
    blob @1 :Data;
}

struct Message @0xd7170526d566b4fb {
    inReplyTo :union {
        genesis @0 :Void;
        id @1 :Data;
    }
    disclosedRecipients @2 :List(PublicKey);
    richTextFormat :union {
        plaintext @3 :Void;
        markdown @4 :Void;
    }
    content @5 :Text;
    attachments @6 :List(Attachment);
    # 24 bytes of random data. Used to differentiate
    # messages when all other fields are identical.
    nonce @7 :Data;
}

struct UnverifiedMessage @0x84bcca3f1146651a {
    publicEncryptionKey @0 :Data;
    publicSigningKey @1 :Data;
    payload @2 :Data;
}
