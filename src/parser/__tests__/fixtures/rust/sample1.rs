// sample1.rs - Basic Rust features: structs, enums, functions, impl blocks

/// Point in 2D space
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    /// Create a new point
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    /// Calculate distance from origin
    pub fn distance_from_origin(&self) -> f64 {
        (self.x.powi(2) + self.y.powi(2)).sqrt()
    }

    /// Calculate distance to another point
    pub fn distance_to(&self, other: &Point) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx.powi(2) + dy.powi(2)).sqrt()
    }
}

/// Circle defined by center and radius
pub struct Circle {
    center: Point,
    radius: f64,
}

impl Circle {
    /// Create a new circle
    pub fn new(center: Point, radius: f64) -> Self {
        Circle { center, radius }
    }

    /// Calculate area
    pub fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius.powi(2)
    }

    /// Calculate circumference
    pub fn circumference(&self) -> f64 {
        2.0 * std::f64::consts::PI * self.radius
    }

    /// Check if point is inside circle
    pub fn contains(&self, point: &Point) -> bool {
        self.center.distance_to(point) <= self.radius
    }
}

/// Shape color
#[derive(Debug, Clone, Copy)]
pub enum Color {
    Red,
    Green,
    Blue,
    RGB(u8, u8, u8),
}

/// Calculator operations
pub enum Operation {
    Add,
    Subtract,
    Multiply,
    Divide,
}

/// Simple calculator
pub struct Calculator {
    memory: f64,
}

impl Calculator {
    /// Create a new calculator
    pub fn new() -> Self {
        Calculator { memory: 0.0 }
    }

    /// Perform an operation
    pub fn calculate(&mut self, a: f64, b: f64, op: Operation) -> f64 {
        let result = match op {
            Operation::Add => a + b,
            Operation::Subtract => a - b,
            Operation::Multiply => a * b,
            Operation::Divide => {
                if b != 0.0 {
                    a / b
                } else {
                    f64::NAN
                }
            }
        };
        self.memory = result;
        result
    }

    /// Get stored memory
    pub fn get_memory(&self) -> f64 {
        self.memory
    }

    /// Clear memory
    pub fn clear_memory(&mut self) {
        self.memory = 0.0;
    }
}

/// Maximum calculation limit
pub const MAX_CALC_VALUE: f64 = 1e100;

/// Minimum calculation limit
pub const MIN_CALC_VALUE: f64 = -1e100;

/// Default precision
pub const DEFAULT_PRECISION: usize = 6;

/// Application version
pub static VERSION: &str = "1.0.0";

/// Global counter (mutable static)
pub static mut GLOBAL_COUNTER: i32 = 0;

/// Type alias for result
pub type CalcResult = Result<f64, String>;

/// Type alias for point tuple
pub type PointTuple = (f64, f64);

/// Free function to create point from tuple
pub fn point_from_tuple(tuple: PointTuple) -> Point {
    Point::new(tuple.0, tuple.1)
}

/// Free function to calculate distance
pub fn calculate_distance(p1: &Point, p2: &Point) -> f64 {
    p1.distance_to(p2)
}

/// Helper function for safe division
fn safe_divide(a: f64, b: f64) -> CalcResult {
    if b == 0.0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point::new(0.0, 0.0);
        let p2 = Point::new(3.0, 4.0);
        assert_eq!(p1.distance_to(&p2), 5.0);
    }

    #[test]
    fn test_circle_area() {
        let center = Point::new(0.0, 0.0);
        let circle = Circle::new(center, 1.0);
        assert!((circle.area() - std::f64::consts::PI).abs() < 0.001);
    }
}
