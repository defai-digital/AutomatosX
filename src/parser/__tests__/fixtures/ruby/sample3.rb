# sample3.rb - Advanced Ruby patterns: metaprogramming, singleton methods, etc.

# Config class with singleton pattern
class Config
  @instance = nil

  attr_accessor :host, :port, :timeout

  def initialize
    @host = 'localhost'
    @port = 8080
    @timeout = 30
  end

  def self.instance
    @instance ||= new
  end

  def self.reset
    @instance = nil
  end

  private_class_method :new
end

# Builder pattern for configuration
class ConfigBuilder
  attr_reader :config

  def initialize
    @host = nil
    @port = nil
    @timeout = nil
  end

  def host(value)
    @host = value
    self
  end

  def port(value)
    @port = value
    self
  end

  def timeout(value)
    @timeout = value
    self
  end

  def build
    raise ArgumentError, "Host is required" if @host.nil?

    config = OpenStruct.new
    config.host = @host
    config.port = @port || 8080
    config.timeout = @timeout || 30
    config
  end

  def self.create
    new
  end
end

# State machine
class StateMachine
  attr_reader :current_state

  STATES = [:idle, :running, :paused, :stopped].freeze

  def initialize
    @current_state = :idle
  end

  def start
    raise "Cannot start from #{@current_state}" unless can_start?
    @current_state = :running
  end

  def pause
    raise "Cannot pause from #{@current_state}" unless @current_state == :running
    @current_state = :paused
  end

  def resume
    raise "Cannot resume from #{@current_state}" unless @current_state == :paused
    @current_state = :running
  end

  def stop
    @current_state = :stopped
  end

  def reset
    @current_state = :idle
  end

  private

  def can_start?
    [:idle, :stopped].include?(@current_state)
  end
end

# Active Record-like base class
class Model
  @@table_name = nil

  def self.table_name=(name)
    @@table_name = name
  end

  def self.table_name
    @@table_name || name.downcase + 's'
  end

  def self.all
    # Simulate database query
    []
  end

  def self.find(id)
    # Simulate database query
    nil
  end

  def self.where(conditions)
    # Simulate database query
    []
  end

  def save
    # Simulate saving to database
    true
  end

  def update(attributes)
    attributes.each do |key, value|
      send("#{key}=", value) if respond_to?("#{key}=")
    end
    save
  end

  def destroy
    # Simulate deleting from database
    true
  end
end

# User model
class User < Model
  self.table_name = 'users'

  attr_accessor :name, :email, :age

  def initialize(name: nil, email: nil, age: nil)
    @name = name
    @email = email
    @age = age
  end

  def full_name
    @name
  end

  def self.find_by_email(email)
    where(email: email).first
  end

  def self.adults
    where('age >= 18')
  end
end

# Post model
class Post < Model
  attr_accessor :title, :content, :user_id

  def initialize(title: nil, content: nil, user_id: nil)
    @title = title
    @content = content
    @user_id = user_id
  end

  def author
    User.find(@user_id)
  end

  def self.published
    where(published: true)
  end
end

# Validator module
module Validator
  def self.included(base)
    base.extend(ClassMethods)
    base.class_eval do
      @validations = []
    end
  end

  module ClassMethods
    def validates(field, options = {})
      @validations ||= []
      @validations << { field: field, options: options }
    end

    def validations
      @validations || []
    end
  end

  def valid?
    self.class.validations.all? do |validation|
      field = validation[:field]
      value = send(field)

      if validation[:options][:presence]
        !value.nil? && value != ''
      else
        true
      end
    end
  end

  def errors
    []
  end
end

# Product with validations
class Product
  include Validator

  attr_accessor :name, :price, :quantity

  validates :name, presence: true
  validates :price, presence: true
  validates :quantity, presence: true

  def initialize(name: nil, price: nil, quantity: nil)
    @name = name
    @price = price
    @quantity = quantity
  end

  def in_stock?
    @quantity > 0
  end

  def self.expensive(threshold)
    # Simulate query
    []
  end
end

# Cacheable module
module Cacheable
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    def cache_method(method_name)
      original_method = instance_method(method_name)

      define_method(method_name) do |*args|
        @cache ||= {}
        cache_key = [method_name, args].hash

        @cache[cache_key] ||= original_method.bind(self).call(*args)
      end
    end
  end

  def clear_cache
    @cache = {}
  end
end

# Calculator with caching
class CachedCalculator
  include Cacheable

  def fibonacci(n)
    return n if n <= 1
    fibonacci(n - 1) + fibonacci(n - 2)
  end

  cache_method :fibonacci

  def factorial(n)
    return 1 if n <= 1
    n * factorial(n - 1)
  end

  cache_method :factorial
end

# Constants
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 60
BUFFER_SIZE = 8192
APP_VERSION = "3.0.0"

# Error classes
class ApplicationError < StandardError; end
class ValidationError < ApplicationError; end
class NotFoundError < ApplicationError; end

# Module-level helper methods
def retry_operation(max_attempts = MAX_RETRIES, &block)
  attempts = 0
  begin
    attempts += 1
    block.call
  rescue => e
    retry if attempts < max_attempts
    raise e
  end
end

def with_timeout(seconds = DEFAULT_TIMEOUT, &block)
  # Simulate timeout handling
  block.call
end
