use futures_intrusive::sync::ManualResetEvent;
use std::collections::HashMap;
use std::sync::Arc;

pub struct MPMCManualResetEvent {
    counter: u128,
    events: HashMap<u128, Arc<ManualResetEvent>>,
}

impl MPMCManualResetEvent {
    pub fn new() -> MPMCManualResetEvent {
        MPMCManualResetEvent {
            events: HashMap::<u128, Arc<ManualResetEvent>>::new(),
            counter: 0,
        }
    }

    pub fn get_handle(&mut self) -> u128 {
        let event = ManualResetEvent::new(false);
        let handle_id = self.counter;
        self.events.insert(handle_id, Arc::new(event));
        self.counter += 1;
        handle_id
    }

    pub fn get_event(&self, handle: u128) -> Arc<ManualResetEvent> {
        let event = self.events.get(&handle).unwrap();
        event.clone()
    }

    pub fn drop_handle(&mut self, handle: u128) {
        self.events.remove(&handle);
    }

    pub fn broadcast(&self) {
        for (_, handle) in self.events.iter() {
            handle.set()
        }
    }
}
