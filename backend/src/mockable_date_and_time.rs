use async_std::task;
use async_trait::async_trait;
use chrono::Utc;
use std::convert::TryInto;
use std::sync::RwLock;
use std::time::Duration;

pub struct TrueTime {}

#[async_trait]
pub trait Clock {
    async fn wait(&self, milliseconds: u64);
    fn timestamp(&self) -> i64;
}

#[async_trait]
impl Clock for TrueTime {
    async fn wait(&self, milliseconds: u64) {
        task::sleep(Duration::from_millis(milliseconds)).await;
    }

    fn timestamp(&self) -> i64 {
        Utc::now().timestamp()
    }
}

use crate::mpmc_manual_reset_event::MPMCManualResetEvent;

pub struct MockTime {
    time_changed: RwLock<MPMCManualResetEvent>,
    current_time: RwLock<i64>,
    wake_up_time: RwLock<i64>,
}

impl Default for MockTime {
    fn default() -> Self {
        Self {
            current_time: RwLock::new(0),
            wake_up_time: RwLock::new(0),
            time_changed: RwLock::new(MPMCManualResetEvent::new()),
        }
    }
}

pub trait Advance {
    fn advance(&self, milliseconds: u64);
}

impl Advance for MockTime {
    fn advance(&self, milliseconds: u64) {
        let converted: i64 = milliseconds.try_into().unwrap();
        *self.current_time.write().unwrap() += converted;
        self.time_changed.read().unwrap().broadcast();
    }
}

#[async_trait]
impl Clock for MockTime {
    async fn wait(&self, milliseconds: u64) {
        let handle = self.time_changed.write().unwrap().get_handle();
        let event = self.time_changed.read().unwrap().get_event(handle);

        let old_time = *self.wake_up_time.read().unwrap();

        loop {
            let time = *self.current_time.read().unwrap();
            let time_difference: u64 = (time - old_time).try_into().unwrap();
            if time_difference >= milliseconds {
                self.time_changed.write().unwrap().drop_handle(handle);
                let converted: i64 = milliseconds.try_into().unwrap();
                *self.wake_up_time.write().unwrap() += converted;
                return;
            }
            event.wait().await;
        }
    }

    fn timestamp(&self) -> i64 {
        *self.current_time.read().unwrap()
    }
}

impl<'a, T: Advance> Advance for &'a T {
    fn advance(&self, milliseconds: u64) {
        (*self).advance(milliseconds);
    }
}

#[async_trait]
impl<'a, T: Send + Sync + Clock> Clock for &'a T {
    async fn wait(&self, milliseconds: u64) {
        (*self).wait(milliseconds).await;
    }

    fn timestamp(&self) -> i64 {
        (*self).timestamp()
    }
}
