# sample2.rb - Modules, mixins, and advanced patterns

# Comparable module for comparison operations
module Comparable
  def ==(other)
    compare_to(other) == 0
  end

  def <(other)
    compare_to(other) < 0
  end

  def >(other)
    compare_to(other) > 0
  end

  def <=(other)
    compare_to(other) <= 0
  end

  def >=(other)
    compare_to(other) >= 0
  end
end

# Drawable module for objects that can be drawn
module Drawable
  def draw
    "Drawing #{self.class.name}"
  end

  def get_bounds
    [0, 0, 0, 0]
  end

  module ClassMethods
    def supported_formats
      [:svg, :png, :pdf]
    end
  end

  def self.included(base)
    base.extend(ClassMethods)
  end
end

# Serializable module
module Serializable
  def to_json
    require 'json'
    instance_variables.each_with_object({}) do |var, hash|
      hash[var.to_s.delete('@')] = instance_variable_get(var)
    end.to_json
  end

  def self.from_json(json_string)
    require 'json'
    data = JSON.parse(json_string)
    instance = new
    data.each do |key, value|
      instance.instance_variable_set("@#{key}", value)
    end
    instance
  end
end

# Container class with generic-like behavior
class Container
  include Serializable

  attr_accessor :value

  def initialize(value = nil)
    @value = value
  end

  def get
    @value
  end

  def set(val)
    @value = val
  end

  def map(&block)
    Container.new(block.call(@value))
  end

  def self.wrap(value)
    new(value)
  end
end

# Pair class holding two values
class Pair
  include Serializable

  attr_reader :first, :second

  def initialize(first, second)
    @first = first
    @second = second
  end

  def swap
    Pair.new(@second, @first)
  end

  def map_first(&block)
    Pair.new(block.call(@first), @second)
  end

  def map_second(&block)
    Pair.new(@first, block.call(@second))
  end
end

# Result class for error handling
class Result
  attr_reader :value, :error

  def initialize(value: nil, error: nil)
    @value = value
    @error = error
  end

  def success?
    @error.nil?
  end

  def failure?
    !success?
  end

  def unwrap
    raise @error if failure?
    @value
  end

  def self.success(value)
    new(value: value)
  end

  def self.failure(error)
    new(error: error)
  end
end

# Shape with Drawable mixin
class Shape
  include Drawable

  attr_reader :color

  def initialize(color)
    @color = color
  end

  def area
    raise NotImplementedError
  end
end

# Rectangle with Drawable
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

  def get_bounds
    [0, 0, @width, @height]
  end
end

# Circle with Drawable
class CircleShape < Shape
  attr_reader :radius

  PI = 3.14159

  def initialize(color, radius)
    super(color)
    @radius = radius
  end

  def area
    PI * @radius ** 2
  end

  def get_bounds
    diameter = 2 * @radius
    [-@radius, -@radius, diameter, diameter]
  end
end

# Observer pattern
module Observable
  def initialize
    super
    @observers = []
  end

  def add_observer(observer)
    @observers << observer unless @observers.include?(observer)
  end

  def remove_observer(observer)
    @observers.delete(observer)
  end

  def notify_observers(event)
    @observers.each { |observer| observer.update(event) }
  end
end

# Subject class using Observable
class Subject
  include Observable

  attr_reader :state

  def initialize
    super
    @state = :idle
  end

  def change_state(new_state)
    @state = new_state
    notify_observers(new_state)
  end
end

# Observer class
class Observer
  attr_reader :last_event

  def update(event)
    @last_event = event
    puts "Observer received event: #{event}"
  end
end

# Iterator module
module Enumerable
  def each
    raise NotImplementedError
  end

  def map(&block)
    result = []
    each { |item| result << block.call(item) }
    result
  end

  def select(&block)
    result = []
    each { |item| result << item if block.call(item) }
    result
  end

  def reduce(initial, &block)
    accumulator = initial
    each { |item| accumulator = block.call(accumulator, item) }
    accumulator
  end
end

# Range class with Enumerable
class Range
  include Enumerable

  attr_reader :start, :finish

  def initialize(start_val, end_val)
    @start = start_val
    @finish = end_val
  end

  def each(&block)
    current = @start
    while current <= @finish
      block.call(current)
      current += 1
    end
  end

  def size
    @finish - @start + 1
  end
end

# Module constants
DEFAULT_BUFFER_SIZE = 4096
MAX_RETRIES = 3
VERSION = "2.0.0"
