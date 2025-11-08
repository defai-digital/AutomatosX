// Calculator application demonstrating classes, interfaces, and methods
package com.example.calculator;

import java.util.ArrayList;
import java.util.List;

/**
 * Calculator interface for basic arithmetic operations
 */
public interface Calculator {
    double add(double a, double b);
    double subtract(double a, double b);
    double multiply(double a, double b);
    double divide(double a, double b) throws ArithmeticException;
}

/**
 * Operation represents a single calculation
 */
class Operation {
    private String type;
    private double operandA;
    private double operandB;
    private double result;

    public Operation(String type, double a, double b, double result) {
        this.type = type;
        this.operandA = a;
        this.operandB = b;
        this.result = result;
    }

    public String getType() {
        return type;
    }

    public double getResult() {
        return result;
    }
}

/**
 * BasicCalculator implements basic arithmetic operations
 */
public class BasicCalculator implements Calculator {
    private double memory;
    private List<Operation> history;

    public BasicCalculator() {
        this.memory = 0;
        this.history = new ArrayList<>();
    }

    @Override
    public double add(double a, double b) {
        double result = a + b;
        recordOperation("add", a, b, result);
        return result;
    }

    @Override
    public double subtract(double a, double b) {
        double result = a - b;
        recordOperation("subtract", a, b, result);
        return result;
    }

    @Override
    public double multiply(double a, double b) {
        double result = a * b;
        recordOperation("multiply", a, b, result);
        return result;
    }

    @Override
    public double divide(double a, double b) throws ArithmeticException {
        if (b == 0) {
            throw new ArithmeticException("Division by zero");
        }
        double result = a / b;
        recordOperation("divide", a, b, result);
        return result;
    }

    private void recordOperation(String type, double a, double b, double result) {
        history.add(new Operation(type, a, b, result));
    }

    public List<Operation> getHistory() {
        return new ArrayList<>(history);
    }

    public void clearHistory() {
        history.clear();
    }

    public void storeToMemory(double value) {
        this.memory = value;
    }

    public double recallFromMemory() {
        return this.memory;
    }

    public static double max(double a, double b) {
        return a > b ? a : b;
    }

    public static double min(double a, double b) {
        return a < b ? a : b;
    }
}

/**
 * ScientificCalculator extends BasicCalculator with advanced functions
 */
public class ScientificCalculator extends BasicCalculator {

    public double power(double base, double exponent) {
        return Math.pow(base, exponent);
    }

    public double sqrt(double value) {
        if (value < 0) {
            throw new ArithmeticException("Cannot take square root of negative number");
        }
        return Math.sqrt(value);
    }

    public double sin(double angle) {
        return Math.sin(angle);
    }

    public double cos(double angle) {
        return Math.cos(angle);
    }

    public double tan(double angle) {
        return Math.tan(angle);
    }
}

/**
 * CalculatorMode enum for different calculator modes
 */
enum CalculatorMode {
    STANDARD,
    SCIENTIFIC,
    PROGRAMMER
}

/**
 * CalculatorFactory for creating calculator instances
 */
class CalculatorFactory {
    public static Calculator createCalculator(CalculatorMode mode) {
        switch (mode) {
            case SCIENTIFIC:
                return new ScientificCalculator();
            case STANDARD:
            default:
                return new BasicCalculator();
        }
    }
}
