# sample1.rb - Basic Ruby features: classes, methods, constants, inheritance

# Point class representing a 2D point
class Point
  attr_reader :x, :y

  def initialize(x, y)
    @x = x
    @y = y
  end

  def distance_from_origin
    Math.sqrt(@x ** 2 + @y ** 2)
  end

  def distance_to(other)
    dx = @x - other.x
    dy = @y - other.y
    Math.sqrt(dx ** 2 + dy ** 2)
  end

  def to_s
    "(#{@x}, #{@y})"
  end

  def self.origin
    new(0, 0)
  end
end

# Circle class with center and radius
class Circle
  attr_accessor :center, :radius

  PI = 3.14159

  def initialize(center, radius)
    @center = center
    @radius = radius
  end

  def area
    PI * @radius ** 2
  end

  def circumference
    2 * PI * @radius
  end

  def contains?(point)
    @center.distance_to(point) <= @radius
  end

  def self.unit_circle
    new(Point.origin, 1.0)
  end
end

# Calculator class for basic operations
class Calculator
  attr_reader :memory

  MAX_VALUE = 1e100
  MIN_VALUE = -1e100

  def initialize
    @memory = 0
  end

  def add(a, b)
    result = a + b
    @memory = result
    result
  end

  def subtract(a, b)
    result = a - b
    @memory = result
    result
  end

  def multiply(a, b)
    result = a * b
    @memory = result
    result
  end

  def divide(a, b)
    raise ArgumentError, "Division by zero" if b.zero?
    result = a / b.to_f
    @memory = result
    result
  end

  def clear
    @memory = 0
  end

  def self.quick_add(a, b)
    a + b
  end
end

# ScientificCalculator inherits from Calculator
class ScientificCalculator < Calculator
  def power(base, exponent)
    result = base ** exponent
    @memory = result
    result
  end

  def square_root(n)
    raise ArgumentError, "Cannot take square root of negative number" if n < 0
    result = Math.sqrt(n)
    @memory = result
    result
  end

  def sine(angle)
    Math.sin(angle)
  end

  def cosine(angle)
    Math.cos(angle)
  end
end

# CalculatorFactory for creating calculators
class CalculatorFactory
  def self.create(type)
    case type
    when :basic
      Calculator.new
    when :scientific
      ScientificCalculator.new
    else
      raise ArgumentError, "Unknown calculator type: #{type}"
    end
  end

  def self.supported_types
    [:basic, :scientific]
  end
end

# Shape base class
class Shape
  attr_reader :color

  def initialize(color)
    @color = color
  end

  def area
    raise NotImplementedError, "Subclass must implement area"
  end

  def perimeter
    raise NotImplementedError, "Subclass must implement perimeter"
  end
end

# Rectangle shape
class Rectangle < Shape
  attr_reader :width, :height

  def initialize(color, width, height)
    super(color)
    @width = width
    @height = height
  end

  def area
    @width * @height
  end

  def perimeter
    2 * (@width + @height)
  end
end

# Module-level constants
VERSION = "1.0.0"
APP_NAME = "Ruby Calculator"
DEFAULT_PRECISION = 6

# Module-level methods
def create_point(x, y)
  Point.new(x, y)
end

def calculate_distance(p1, p2)
  p1.distance_to(p2)
end
