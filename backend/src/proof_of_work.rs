use async_std::task;
use checked::Checked;
use crypto::blake2b::Blake2b;
use crypto::digest::Digest;
use futures_intrusive::channel::UnbufferedChannel;
use rand::Rng;
use std::convert::TryInto;

fn get_current_target(hash: &[u8; 64], nonce: i64) -> u64 {
    let mut hasher = Blake2b::new(8);
    hasher.input(hash);
    hasher.input(&nonce.to_be_bytes());
    let mut result = [0u8; 8];
    hasher.result(&mut result);
    u64::from_be_bytes(result)
}

// Network attackers can attempt to induce overflow, therefore checked arithmetic is used.
fn get_expected_target(payload_length: u64, time_to_live: u64) -> u64 {
    // https://bitmessage.org/wiki/Proof_of_work
    let max_hash = Checked::from(18446744073709551615u64);
    let nonce_trials_per_byte = Checked::from(1000u64);
    let payload_length_extra_bytes = Checked::from(1000u64);
    let denominator = Checked::from(65536u64);
    let wrapped_payload_length = Checked::from(payload_length);
    let wrapped_time_to_live = Checked::from(time_to_live);
    let target = max_hash
        / (nonce_trials_per_byte
            * (wrapped_payload_length
                + payload_length_extra_bytes
                + wrapped_time_to_live * (wrapped_payload_length + payload_length_extra_bytes)
                    / denominator));
    match *target {
        Some(result) => result,
        // The most difficult proof of work target
        None => 0,
    }
}

pub fn get_expected_target2(payload: &[u8], expiration_time: i64) -> Option<u64> {
    use chrono::{DateTime, NaiveDateTime, Utc};
    let expiration_time: DateTime<Utc> =
        DateTime::<Utc>::from_utc(NaiveDateTime::from_timestamp(expiration_time, 0), Utc);
    let now: DateTime<Utc> = Utc::now();
    let duration = expiration_time - now;
    if now >= expiration_time {
        return None;
    }
    let time_to_live = duration.num_seconds();
    let expected_target = get_expected_target(
        payload.len().try_into().unwrap(),
        time_to_live.try_into().unwrap(),
    );
    Some(expected_target)
}

pub fn verify(payload: &[u8], nonce: i64, expiration_time: i64) -> bool {
    let expected_target = match get_expected_target2(payload, expiration_time) {
        Some(target) => target,
        None => return false,
    };
    let mut hasher = Blake2b::new(64);
    hasher.input(payload);
    let mut payload_hash = [0u8; 64];
    hasher.result(&mut payload_hash);
    let current_target = get_current_target(&payload_hash, nonce);
    current_target <= expected_target
}

/// Loosely based on https://github.com/imrehg/bmpow-rust/blob/master/src/lib.rs
/// This function returns None when the PoW operation is cancelled.
pub async fn prove(
    payload: &[u8],
    target: u64,
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Option<i64> {
    let channel = std::sync::Arc::new(UnbufferedChannel::<Option<i64>>::new());
    let threads = num_cpus::get();
    let mut hasher = Blake2b::new(64);
    hasher.input(payload);
    let mut payload_hash = [0u8; 64];
    hasher.result(&mut payload_hash);
    for _ in 0..threads {
        let channel = channel.clone();
        let cancelled = cancelled.clone();
        let payload_hash = payload_hash;
        std::thread::spawn(move || {
            let mut rng = rand::thread_rng();
            loop {
                if cancelled.load(std::sync::atomic::Ordering::Relaxed) {
                    task::block_on(async move { if let Err(_) = channel.send(None).await {} });
                    break;
                }
                let nonce = rng.gen::<i64>();
                if get_current_target(&payload_hash, nonce) <= target {
                    task::block_on(
                        async move { if let Err(_) = channel.send(Some(nonce)).await {} },
                    );
                    break;
                }
            }
        });
    }
    if let Some(nonce) = channel.receive().await {
        if let Some(_) = nonce {
            cancelled.store(true, std::sync::atomic::Ordering::Relaxed);
        }
        return nonce;
    }
    unreachable!()
}
