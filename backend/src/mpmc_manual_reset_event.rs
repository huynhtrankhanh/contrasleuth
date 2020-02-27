use futures_intrusive::sync::LocalManualResetEvent;
use std::collections::HashMap;
use std::rc::Rc;

pub struct MPMCManualResetEvent {
    counter: u128,
    events: HashMap<u128, Rc<LocalManualResetEvent>>,
}

impl MPMCManualResetEvent {
    pub fn new() -> MPMCManualResetEvent {
        MPMCManualResetEvent {
            events: HashMap::<u128, Rc<LocalManualResetEvent>>::new(),
            counter: 0,
        }
    }

    pub fn get_handle(&mut self) -> u128 {
        let event = LocalManualResetEvent::new(false);
        let handle_id = self.counter;
        self.events.insert(handle_id, Rc::new(event));
        self.counter += 1;
        handle_id
    }

    pub fn get_event(&self, handle: u128) -> Rc<LocalManualResetEvent> {
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
