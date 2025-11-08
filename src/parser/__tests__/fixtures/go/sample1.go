// Package calculator provides basic arithmetic operations
package calculator

import (
	"errors"
	"fmt"
)

// Calculator represents a basic calculator
type Calculator struct {
	Memory float64
	History []Operation
}

// Operation represents a calculation operation
type Operation struct {
	Type string
	A    float64
	B    float64
	Result float64
}

// Adder is an interface for types that can add
type Adder interface {
	Add(a, b float64) float64
}

// Multiplier is an interface for multiplication
type Multiplier interface {
	Multiply(a, b float64) float64
}

// NewCalculator creates a new Calculator instance
func NewCalculator() *Calculator {
	return &Calculator{
		Memory: 0,
		History: make([]Operation, 0),
	}
}

// Add performs addition
func (c *Calculator) Add(a, b float64) float64 {
	result := a + b
	c.recordOperation("add", a, b, result)
	return result
}

// Subtract performs subtraction
func (c *Calculator) Subtract(a, b float64) float64 {
	result := a - b
	c.recordOperation("subtract", a, b, result)
	return result
}

// Multiply performs multiplication
func (c *Calculator) Multiply(a, b float64) float64 {
	result := a * b
	c.recordOperation("multiply", a, b, result)
	return result
}

// Divide performs division with error handling
func (c *Calculator) Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	result := a / b
	c.recordOperation("divide", a, b, result)
	return result, nil
}

// recordOperation is a private method to record operations
func (c *Calculator) recordOperation(opType string, a, b, result float64) {
	op := Operation{
		Type: opType,
		A: a,
		B: b,
		Result: result,
	}
	c.History = append(c.History, op)
}

// GetHistory returns the calculation history
func (c *Calculator) GetHistory() []Operation {
	return c.History
}

// ClearHistory clears the calculation history
func (c *Calculator) ClearHistory() {
	c.History = make([]Operation, 0)
}

// StoreToMemory stores a value in memory
func (c *Calculator) StoreToMemory(value float64) {
	c.Memory = value
}

// RecallFromMemory recalls the value from memory
func (c *Calculator) RecallFromMemory() float64 {
	return c.Memory
}

// CalculatorMode represents different calculator modes
type CalculatorMode int

const (
	StandardMode CalculatorMode = iota
	ScientificMode
	ProgrammerMode
)

// FormatResult formats a result for display
func FormatResult(value float64) string {
	return fmt.Sprintf("%.2f", value)
}

// Max returns the maximum of two numbers
func Max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// Min returns the minimum of two numbers
func Min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
