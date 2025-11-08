// Package utils provides utility functions
package utils

// StringProcessor processes strings
type StringProcessor interface {
	Process(s string) string
	Validate(s string) bool
}

// NumberValidator validates numbers
type NumberValidator interface {
	IsValid(n int) bool
	InRange(n, min, max int) bool
}

// Point represents a 2D point
type Point struct {
	X, Y float64
}

// Rectangle represents a rectangle
type Rectangle struct {
	TopLeft     Point
	BottomRight Point
}

// Circle represents a circle
type Circle struct {
	Center Point
	Radius float64
}

// Shape is an interface for geometric shapes
type Shape interface {
	Area() float64
	Perimeter() float64
}

// Area calculates the area of a rectangle
func (r Rectangle) Area() float64 {
	width := r.BottomRight.X - r.TopLeft.X
	height := r.BottomRight.Y - r.TopLeft.Y
	return width * height
}

// Perimeter calculates the perimeter of a rectangle
func (r Rectangle) Perimeter() float64 {
	width := r.BottomRight.X - r.TopLeft.X
	height := r.BottomRight.Y - r.TopLeft.Y
	return 2 * (width + height)
}

// Area calculates the area of a circle
func (c Circle) Area() float64 {
	return 3.14159 * c.Radius * c.Radius
}

// Perimeter calculates the perimeter of a circle
func (c Circle) Perimeter() float64 {
	return 2 * 3.14159 * c.Radius
}

// String type alias
type String string

// Int type alias
type Int int

// ProcessString processes a string
func ProcessString(s string) string {
	return s
}

// ProcessInt processes an integer
func ProcessInt(n int) int {
	return n
}

// ProcessFloat processes a float
func ProcessFloat(f float64) float64 {
	return f
}

// Processor is a generic processor
type Processor[T any] struct {
	value T
}

// NewProcessor creates a new processor
func NewProcessor[T any](value T) *Processor[T] {
	return &Processor[T]{value: value}
}

// Get returns the value
func (p *Processor[T]) Get() T {
	return p.value
}

// Set sets the value
func (p *Processor[T]) Set(value T) {
	p.value = value
}
