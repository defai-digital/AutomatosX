// sample1.cs - Basic C# features: classes, methods, properties, fields

using System;

namespace Calculator
{
    // Point class representing a 2D point
    public class Point
    {
        public double X { get; set; }
        public double Y { get; set; }

        public Point(double x, double y)
        {
            X = x;
            Y = y;
        }

        public double DistanceFromOrigin()
        {
            return Math.Sqrt(X * X + Y * Y);
        }

        public double DistanceTo(Point other)
        {
            double dx = X - other.X;
            double dy = Y - other.Y;
            return Math.Sqrt(dx * dx + dy * dy);
        }

        public override string ToString()
        {
            return $"({X}, {Y})";
        }

        public static Point Origin => new Point(0, 0);
    }

    // Circle class with center and radius
    public class Circle
    {
        public const double PI = 3.14159;

        public Point Center { get; set; }
        public double Radius { get; set; }

        public Circle(Point center, double radius)
        {
            Center = center;
            Radius = radius;
        }

        public double Area()
        {
            return PI * Radius * Radius;
        }

        public double Circumference()
        {
            return 2 * PI * Radius;
        }

        public bool Contains(Point point)
        {
            return Center.DistanceTo(point) <= Radius;
        }

        public static Circle UnitCircle()
        {
            return new Circle(Point.Origin, 1.0);
        }
    }

    // Calculator class for basic operations
    public class Calculator
    {
        private double _memory;

        public const double MaxValue = 1e100;
        public const double MinValue = -1e100;

        public double Memory => _memory;

        public Calculator()
        {
            _memory = 0;
        }

        public double Add(double a, double b)
        {
            double result = a + b;
            _memory = result;
            return result;
        }

        public double Subtract(double a, double b)
        {
            double result = a - b;
            _memory = result;
            return result;
        }

        public double Multiply(double a, double b)
        {
            double result = a * b;
            _memory = result;
            return result;
        }

        public double Divide(double a, double b)
        {
            if (b == 0)
                throw new ArgumentException("Division by zero");

            double result = a / b;
            _memory = result;
            return result;
        }

        public void Clear()
        {
            _memory = 0;
        }

        public static double QuickAdd(double a, double b)
        {
            return a + b;
        }
    }

    // ScientificCalculator inherits from Calculator
    public class ScientificCalculator : Calculator
    {
        public double Power(double baseValue, double exponent)
        {
            double result = Math.Pow(baseValue, exponent);
            return result;
        }

        public double SquareRoot(double n)
        {
            if (n < 0)
                throw new ArgumentException("Cannot take square root of negative number");

            return Math.Sqrt(n);
        }

        public double Sine(double angle)
        {
            return Math.Sin(angle);
        }

        public double Cosine(double angle)
        {
            return Math.Cos(angle);
        }
    }

    // CalculatorFactory for creating calculators
    public static class CalculatorFactory
    {
        public enum CalculatorType
        {
            Basic,
            Scientific
        }

        public static Calculator Create(CalculatorType type)
        {
            switch (type)
            {
                case CalculatorType.Basic:
                    return new Calculator();
                case CalculatorType.Scientific:
                    return new ScientificCalculator();
                default:
                    throw new ArgumentException($"Unknown calculator type: {type}");
            }
        }

        public static CalculatorType[] SupportedTypes()
        {
            return new[] { CalculatorType.Basic, CalculatorType.Scientific };
        }
    }

    // Shape base class
    public abstract class Shape
    {
        public string Color { get; set; }

        protected Shape(string color)
        {
            Color = color;
        }

        public abstract double Area();
        public abstract double Perimeter();
    }

    // Rectangle shape
    public class Rectangle : Shape
    {
        public double Width { get; set; }
        public double Height { get; set; }

        public Rectangle(string color, double width, double height)
            : base(color)
        {
            Width = width;
            Height = height;
        }

        public override double Area()
        {
            return Width * Height;
        }

        public override double Perimeter()
        {
            return 2 * (Width + Height);
        }
    }

    // Application constants
    public static class Constants
    {
        public const string Version = "1.0.0";
        public const string AppName = "CSharp Calculator";
        public const int DefaultPrecision = 6;
    }
}
