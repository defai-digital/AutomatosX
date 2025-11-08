// sample1.cpp - Basic C++ features: classes, functions, structs, enums

#include <cmath>
#include <string>

// Point class representing a 2D point
class Point {
public:
    double x, y;

    Point(double x, double y) : x(x), y(y) {}

    double distanceFromOrigin() const {
        return std::sqrt(x * x + y * y);
    }

    double distanceTo(const Point& other) const {
        double dx = x - other.x;
        double dy = y - other.y;
        return std::sqrt(dx * dx + dy * dy);
    }

    static Point origin() {
        return Point(0, 0);
    }
};

// Circle class
class Circle {
public:
    static constexpr double PI = 3.14159;

    Point center;
    double radius;

    Circle(const Point& center, double radius) : center(center), radius(radius) {}

    double area() const {
        return PI * radius * radius;
    }

    double circumference() const {
        return 2 * PI * radius;
    }

    bool contains(const Point& point) const {
        return center.distanceTo(point) <= radius;
    }
};

// Calculator class
class Calculator {
private:
    double memory;

public:
    static const double MAX_VALUE;
    static const double MIN_VALUE;

    Calculator() : memory(0) {}

    double add(double a, double b) {
        memory = a + b;
        return memory;
    }

    double subtract(double a, double b) {
        memory = a - b;
        return memory;
    }

    double getMemory() const {
        return memory;
    }

    void clear() {
        memory = 0;
    }

    static double quickAdd(double a, double b) {
        return a + b;
    }
};

const double Calculator::MAX_VALUE = 1e100;
const double Calculator::MIN_VALUE = -1e100;

// ScientificCalculator inherits from Calculator
class ScientificCalculator : public Calculator {
public:
    double power(double base, double exponent) {
        return std::pow(base, exponent);
    }

    double squareRoot(double n) {
        return std::sqrt(n);
    }
};

// Struct example
struct Rectangle {
    double width;
    double height;

    double area() const {
        return width * height;
    }

    double perimeter() const {
        return 2 * (width + height);
    }
};

// Enum example
enum Status {
    Active,
    Inactive,
    Pending
};

enum class Color {
    Red,
    Green,
    Blue
};

// Constants
const int MAX_SIZE = 100;
const std::string VERSION = "1.0.0";

// Namespace example
namespace math {
    double abs(double x) {
        return x >= 0 ? x : -x;
    }

    double max(double a, double b) {
        return a > b ? a : b;
    }
}
