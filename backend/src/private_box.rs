// Loosely based on auditdrivencrypto/private-box.

use sodiumoxide::crypto::box_::{gen_keypair, PUBLICKEYBYTES};
use sodiumoxide::crypto::scalarmult::{scalarmult, GroupElement, Scalar};
use sodiumoxide::crypto::secretbox::{
    gen_key, gen_nonce, open, seal, Key, Nonce, KEYBYTES, MACBYTES, NONCEBYTES,
};
use std::convert::TryInto;

/// Returns None if one of the public keys is unacceptable, i.e. is equal to
/// 0 or public key count exceeds 255.
pub fn encrypt(plaintext: &[u8], public_keys: &[&[u8]]) -> Option<Vec<u8>> {
    let mut ciphertext = Vec::<u8>::new();
    let nonce = gen_nonce();
    ciphertext.extend_from_slice(nonce.as_ref());
    let (ephemeral_public_key, ephemeral_private_key) = gen_keypair();
    ciphertext.extend_from_slice(ephemeral_public_key.as_ref());
    let key = gen_key();
    let key_with_recipient_count = {
        let mut blob = Vec::<u8>::new();
        blob.extend_from_slice(key.as_ref());
        blob.push(match public_keys.len().try_into() {
            Ok(length) => length,
            Err(_) => return None,
        });
        blob
    };
    for public_key in public_keys {
        let shared_key = match scalarmult(
            &Scalar::from_slice(ephemeral_private_key.as_ref()).unwrap(),
            &GroupElement::from_slice(public_key).unwrap(),
        ) {
            Ok(it) => Key::from_slice(it.as_ref()).unwrap(),
            Err(()) => return None,
        };
        ciphertext.extend_from_slice(&seal(&key_with_recipient_count, &nonce, &shared_key));
    }
    ciphertext.extend_from_slice(&seal(&plaintext, &nonce, &key));
    Some(ciphertext)
}

pub fn decrypt(ciphertext: &[u8], private_key: &[u8]) -> Option<Vec<u8>> {
    let mut counter: usize = 0;
    let mut advance = |count: usize| {
        let left = counter;
        counter += count;
        if counter > ciphertext.len() {
            return None;
        }
        Some(&ciphertext[left..counter])
    };
    let nonce = match advance(NONCEBYTES) {
        Some(it) => Nonce::from_slice(it).unwrap(),
        None => return None,
    };
    let ephemeral_public_key = match advance(PUBLICKEYBYTES) {
        Some(it) => it,
        None => return None,
    };

    let shared_key = match scalarmult(
        &Scalar::from_slice(private_key).unwrap(),
        &GroupElement::from_slice(ephemeral_public_key).unwrap(),
    ) {
        Ok(it) => Key::from_slice(it.as_ref()).unwrap(),
        Err(()) => return None,
    };

    const RECIPIENT_COUNT_BYTES: usize = 1;
    let mut iteration: u8 = 0;
    while let Some(maybe_key_with_recipient_count) =
        advance(KEYBYTES + RECIPIENT_COUNT_BYTES + MACBYTES)
    {
        if iteration == 255 {
            return None;
        }
        iteration += 1;

        let (key, recipient_count) = match open(maybe_key_with_recipient_count, &nonce, &shared_key)
        {
            Ok(decrypted) => {
                let recipient_count = decrypted[decrypted.len() - 1];
                (
                    match Key::from_slice(&decrypted[..decrypted.len() - 1]) {
                        Some(it) => it,
                        None => return None,
                    },
                    recipient_count,
                )
            }
            Err(()) => continue,
        };

        let remaining_count: usize = (recipient_count - iteration).try_into().unwrap();
        if let None = advance(remaining_count * (KEYBYTES + RECIPIENT_COUNT_BYTES + MACBYTES)) {
            return None;
        }
        let ciphertext = &ciphertext[counter..];

        match open(ciphertext, &nonce, &key) {
            Ok(plaintext) => return Some(plaintext),
            Err(()) => return None,
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use sodiumoxide::crypto::box_::gen_keypair;

    #[test]
    fn one_recipient() {
        sodiumoxide::init().unwrap();
        let (public_key, private_key) = gen_keypair();
        let string = "The quick brown fox jumps over the lazy dog.".as_bytes();
        let encrypted = encrypt(string, &vec![public_key.as_ref()]).unwrap();
        assert_eq!(
            &decrypt(&encrypted, private_key.as_ref()).unwrap() as &[u8],
            string
        );
    }

    #[test]
    fn three_recipients() {
        sodiumoxide::init().unwrap();
        let (public_key1, private_key1) = gen_keypair();
        let (public_key2, private_key2) = gen_keypair();
        let (public_key3, private_key3) = gen_keypair();
        let string = "The quick brown fox jumps over the lazy dog.".as_bytes();
        let encrypted = encrypt(
            string,
            &vec![
                public_key1.as_ref(),
                public_key2.as_ref(),
                public_key3.as_ref(),
            ],
        )
        .unwrap();
        assert_eq!(
            &decrypt(&encrypted, private_key1.as_ref()).unwrap() as &[u8],
            string
        );
        assert_eq!(
            &decrypt(&encrypted, private_key2.as_ref()).unwrap() as &[u8],
            string
        );
        assert_eq!(
            &decrypt(&encrypted, private_key3.as_ref()).unwrap() as &[u8],
            string
        );
    }
}
