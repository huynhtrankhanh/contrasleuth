use std::fmt;

/// A unique identifier for a task.
///
/// # Examples
///
/// ```
/// use async_std::task;
///
/// task::block_on(async {
///     println!("id = {:?}", task::current().id());
/// })
/// ```
#[derive(Eq, PartialEq, Clone, Copy, Hash, Debug)]
pub struct TaskId(pub(crate) u128);

impl TaskId {
    /// Generates a new `TaskId`.
    pub(crate) fn generate() -> TaskId {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        TaskId(rng.gen::<u128>())
    }
}

impl fmt::Display for TaskId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
