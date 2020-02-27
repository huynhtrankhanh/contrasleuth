use crypto::blake2b::Blake2b;
use crypto::digest::Digest;

pub fn message_hash(payload: &[u8], expiration_time: i64) -> [u8; 64] {
    let mut parent_hasher = Blake2b::new(64);
    {
        let mut hasher = Blake2b::new(64);
        hasher.input(payload);
        let mut result = [0u8; 64];
        hasher.result(&mut result);
        parent_hasher.input(&result);
    }
    {
        let mut hasher = Blake2b::new(64);
        hasher.input(&expiration_time.to_be_bytes());
        let mut result = [0u8; 64];
        hasher.result(&mut result);
        parent_hasher.input(&result);
    }
    let mut result = [0u8; 64];
    parent_hasher.result(&mut result);
    result
}
