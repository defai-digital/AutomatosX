// sample2.rs - Traits, generics, and advanced patterns

use std::fmt;

/// Trait for drawable objects
pub trait Drawable {
    fn draw(&self) -> String;
    fn get_bounds(&self) -> (f64, f64, f64, f64);
}

/// Trait for objects that can be serialized
pub trait Serializable {
    fn serialize(&self) -> Vec<u8>;
    fn deserialize(data: &[u8]) -> Result<Self, String>
    where
        Self: Sized;
}

/// Generic container for any type
pub struct Container<T> {
    value: T,
}

impl<T> Container<T> {
    pub fn new(value: T) -> Self {
        Container { value }
    }

    pub fn get(&self) -> &T {
        &self.value
    }

    pub fn set(&mut self, value: T) {
        self.value = value;
    }

    pub fn into_inner(self) -> T {
        self.value
    }
}

impl<T: Clone> Container<T> {
    pub fn clone_value(&self) -> T {
        self.value.clone()
    }
}

impl<T: fmt::Display> Container<T> {
    pub fn display_value(&self) {
        println!("Value: {}", self.value);
    }
}

/// Generic pair of values
pub struct Pair<T, U> {
    first: T,
    second: U,
}

impl<T, U> Pair<T, U> {
    pub fn new(first: T, second: U) -> Self {
        Pair { first, second }
    }

    pub fn get_first(&self) -> &T {
        &self.first
    }

    pub fn get_second(&self) -> &U {
        &self.second
    }

    pub fn swap(self) -> Pair<U, T> {
        Pair {
            first: self.second,
            second: self.first,
        }
    }
}

/// Rectangle shape
pub struct Rectangle {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Rectangle {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self {
        Rectangle {
            x,
            y,
            width,
            height,
        }
    }

    pub fn area(&self) -> f64 {
        self.width * self.height
    }
}

impl Drawable for Rectangle {
    fn draw(&self) -> String {
        format!(
            "Rectangle at ({}, {}) with width {} and height {}",
            self.x, self.y, self.width, self.height
        )
    }

    fn get_bounds(&self) -> (f64, f64, f64, f64) {
        (self.x, self.y, self.width, self.height)
    }
}

/// Circle shape
pub struct CircleShape {
    x: f64,
    y: f64,
    radius: f64,
}

impl CircleShape {
    pub fn new(x: f64, y: f64, radius: f64) -> Self {
        CircleShape { x, y, radius }
    }

    pub fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius.powi(2)
    }
}

impl Drawable for CircleShape {
    fn draw(&self) -> String {
        format!(
            "Circle at ({}, {}) with radius {}",
            self.x, self.y, self.radius
        )
    }

    fn get_bounds(&self) -> (f64, f64, f64, f64) {
        (
            self.x - self.radius,
            self.y - self.radius,
            2.0 * self.radius,
            2.0 * self.radius,
        )
    }
}

/// Generic result type
pub enum Result<T, E> {
    Ok(T),
    Err(E),
}

impl<T, E> Result<T, E> {
    pub fn is_ok(&self) -> bool {
        matches!(self, Result::Ok(_))
    }

    pub fn is_err(&self) -> bool {
        matches!(self, Result::Err(_))
    }

    pub fn unwrap(self) -> T
    where
        E: fmt::Debug,
    {
        match self {
            Result::Ok(value) => value,
            Result::Err(err) => panic!("Unwrap failed: {:?}", err),
        }
    }
}

/// Option type for nullable values
pub enum Option<T> {
    Some(T),
    None,
}

impl<T> Option<T> {
    pub fn is_some(&self) -> bool {
        matches!(self, Option::Some(_))
    }

    pub fn is_none(&self) -> bool {
        matches!(self, Option::None)
    }

    pub fn unwrap(self) -> T {
        match self {
            Option::Some(value) => value,
            Option::None => panic!("Unwrap on None"),
        }
    }

    pub fn map<U, F>(self, f: F) -> Option<U>
    where
        F: FnOnce(T) -> U,
    {
        match self {
            Option::Some(value) => Option::Some(f(value)),
            Option::None => Option::None,
        }
    }
}

/// Iterator trait for custom iteration
pub trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;

    fn count(mut self) -> usize
    where
        Self: Sized,
    {
        let mut count = 0;
        while let Option::Some(_) = self.next() {
            count += 1;
        }
        count
    }
}

/// Range iterator
pub struct RangeIterator {
    current: i32,
    end: i32,
}

impl RangeIterator {
    pub fn new(start: i32, end: i32) -> Self {
        RangeIterator {
            current: start,
            end,
        }
    }
}

impl Iterator for RangeIterator {
    type Item = i32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.end {
            let value = self.current;
            self.current += 1;
            Option::Some(value)
        } else {
            Option::None
        }
    }
}

/// Helper function to draw any drawable object
pub fn draw_shape<T: Drawable>(shape: &T) -> String {
    shape.draw()
}

/// Helper function to create a container
pub fn make_container<T>(value: T) -> Container<T> {
    Container::new(value)
}

/// Constant for default buffer size
pub const DEFAULT_BUFFER_SIZE: usize = 4096;

/// Static version string
pub static APP_VERSION: &str = "2.0.0";
