// sample3.rs - Advanced Rust patterns: lifetimes, error handling, smart pointers

use std::rc::Rc;
use std::sync::Arc;

/// Custom error type
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    InvalidInput(String),
    IoError(String),
}

/// Custom result type alias
pub type AppResult<T> = std::result::Result<T, AppError>;

/// Reference wrapper with lifetime
pub struct Wrapper<'a, T> {
    data: &'a T,
}

impl<'a, T> Wrapper<'a, T> {
    pub fn new(data: &'a T) -> Self {
        Wrapper { data }
    }

    pub fn get(&self) -> &T {
        self.data
    }
}

/// Data processor with lifetime
pub struct DataProcessor<'a> {
    name: &'a str,
    config: &'a ProcessorConfig,
}

impl<'a> DataProcessor<'a> {
    pub fn new(name: &'a str, config: &'a ProcessorConfig) -> Self {
        DataProcessor { name, config }
    }

    pub fn process(&self, data: &str) -> AppResult<String> {
        if data.is_empty() {
            return Err(AppError::InvalidInput("Empty data".to_string()));
        }
        Ok(format!("{}: {}", self.name, data))
    }

    pub fn get_name(&self) -> &str {
        self.name
    }
}

/// Processor configuration
pub struct ProcessorConfig {
    pub max_size: usize,
    pub timeout: u64,
}

impl ProcessorConfig {
    pub fn new(max_size: usize, timeout: u64) -> Self {
        ProcessorConfig { max_size, timeout }
    }

    pub fn default() -> Self {
        ProcessorConfig {
            max_size: 1024,
            timeout: 30,
        }
    }
}

/// Smart pointer wrapper
pub struct SmartBox<T> {
    inner: Box<T>,
}

impl<T> SmartBox<T> {
    pub fn new(value: T) -> Self {
        SmartBox {
            inner: Box::new(value),
        }
    }

    pub fn get(&self) -> &T {
        &self.inner
    }

    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner
    }
}

/// Reference counted wrapper
pub struct RefCounted<T> {
    inner: Rc<T>,
}

impl<T> RefCounted<T> {
    pub fn new(value: T) -> Self {
        RefCounted {
            inner: Rc::new(value),
        }
    }

    pub fn clone_rc(&self) -> Self {
        RefCounted {
            inner: Rc::clone(&self.inner),
        }
    }

    pub fn get(&self) -> &T {
        &self.inner
    }
}

/// Thread-safe reference counted wrapper
pub struct ThreadSafe<T> {
    inner: Arc<T>,
}

impl<T> ThreadSafe<T> {
    pub fn new(value: T) -> Self {
        ThreadSafe {
            inner: Arc::new(value),
        }
    }

    pub fn clone_arc(&self) -> Self {
        ThreadSafe {
            inner: Arc::clone(&self.inner),
        }
    }

    pub fn get(&self) -> &T {
        &self.inner
    }
}

/// Node in a tree structure
pub struct TreeNode<T> {
    pub value: T,
    pub children: Vec<TreeNode<T>>,
}

impl<T> TreeNode<T> {
    pub fn new(value: T) -> Self {
        TreeNode {
            value,
            children: Vec::new(),
        }
    }

    pub fn add_child(&mut self, child: TreeNode<T>) {
        self.children.push(child);
    }

    pub fn count_nodes(&self) -> usize {
        1 + self.children.iter().map(|c| c.count_nodes()).sum::<usize>()
    }
}

/// Builder pattern for configuration
pub struct ConfigBuilder {
    host: Option<String>,
    port: Option<u16>,
    timeout: Option<u64>,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        ConfigBuilder {
            host: None,
            port: None,
            timeout: None,
        }
    }

    pub fn host(mut self, host: String) -> Self {
        self.host = Some(host);
        self
    }

    pub fn port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    pub fn timeout(mut self, timeout: u64) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn build(self) -> AppResult<Config> {
        let host = self.host.ok_or_else(|| {
            AppError::InvalidInput("Host is required".to_string())
        })?;

        let port = self.port.unwrap_or(8080);
        let timeout = self.timeout.unwrap_or(30);

        Ok(Config {
            host,
            port,
            timeout,
        })
    }
}

/// Configuration struct
pub struct Config {
    host: String,
    port: u16,
    timeout: u64,
}

impl Config {
    pub fn get_host(&self) -> &str {
        &self.host
    }

    pub fn get_port(&self) -> u16 {
        self.port
    }

    pub fn get_timeout(&self) -> u64 {
        self.timeout
    }
}

/// Trait for cloneable types
pub trait Cloneable {
    fn clone_obj(&self) -> Self
    where
        Self: Sized;
}

/// Trait for resettable types
pub trait Resettable {
    fn reset(&mut self);
}

/// State machine states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Idle,
    Running,
    Paused,
    Stopped,
}

/// State machine
pub struct StateMachine {
    current_state: State,
}

impl StateMachine {
    pub fn new() -> Self {
        StateMachine {
            current_state: State::Idle,
        }
    }

    pub fn start(&mut self) -> AppResult<()> {
        match self.current_state {
            State::Idle | State::Stopped => {
                self.current_state = State::Running;
                Ok(())
            }
            _ => Err(AppError::InvalidInput(
                "Cannot start from current state".to_string(),
            )),
        }
    }

    pub fn pause(&mut self) -> AppResult<()> {
        match self.current_state {
            State::Running => {
                self.current_state = State::Paused;
                Ok(())
            }
            _ => Err(AppError::InvalidInput(
                "Cannot pause from current state".to_string(),
            )),
        }
    }

    pub fn stop(&mut self) {
        self.current_state = State::Stopped;
    }

    pub fn get_state(&self) -> State {
        self.current_state
    }
}

impl Resettable for StateMachine {
    fn reset(&mut self) {
        self.current_state = State::Idle;
    }
}

/// Maximum retries constant
pub const MAX_RETRIES: u32 = 3;

/// Default timeout constant
pub const DEFAULT_TIMEOUT: u64 = 60;

/// Buffer size constant
pub const BUFFER_SIZE: usize = 8192;

/// Application name static
pub static APP_NAME: &str = "RustApp";

/// Type alias for callback function
pub type Callback = fn(String) -> AppResult<()>;

/// Type alias for async callback
pub type AsyncCallback = fn(String) -> std::pin::Pin<Box<dyn std::future::Future<Output = AppResult<()>>>>;

/// Helper function for safe unwrap
pub fn safe_unwrap<T>(option: std::option::Option<T>, default: T) -> T {
    option.unwrap_or(default)
}

/// Helper function for error conversion
pub fn convert_error(msg: &str) -> AppError {
    AppError::IoError(msg.to_string())
}
