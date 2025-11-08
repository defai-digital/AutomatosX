/**
 * RubyParserService.test.ts
 *
 * Tests for Ruby language parser using Tree-sitter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RubyParserService } from '../RubyParserService.js';
import { Symbol, SymbolKind } from '../LanguageParser.js';
import * as fs from 'fs';
import * as path from 'path';

describe('RubyParserService', () => {
  let parser: RubyParserService;

  beforeEach(() => {
    parser = new RubyParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('ruby');
    });

    it('should support Ruby file extensions', () => {
      expect(parser.extensions).toEqual(['.rb']);
    });
  });

  describe('parse', () => {
    it('should parse empty file', () => {
      const result = parser.parse('');

      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    it('should extract class declarations', () => {
      const code = `
class Point
  def initialize(x, y)
    @x = x
    @y = y
  end
end

class Circle
  def initialize(center, radius)
    @center = center
    @radius = radius
  end
end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(2);

      expect(classes[0].name).toBe('Point');
      expect(classes[0].kind).toBe('class');

      expect(classes[1].name).toBe('Circle');
      expect(classes[1].kind).toBe('class');
    });

    it('should extract class with inheritance', () => {
      const code = `
class Calculator
  def add(a, b)
    a + b
  end
end

class ScientificCalculator < Calculator
  def power(base, exponent)
    base ** exponent
  end
end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(2);

      expect(classes[0].name).toBe('Calculator');
      expect(classes[1].name).toBe('ScientificCalculator');
    });

    it('should extract module declarations', () => {
      const code = `
module Comparable
  def ==(other)
    compare_to(other) == 0
  end
end

module Drawable
  def draw
    "Drawing"
  end
end
`;

      const result = parser.parse(code);

      const modules = result.symbols.filter(s => s.kind === 'interface');
      expect(modules).toHaveLength(2);

      expect(modules[0].name).toBe('Comparable');
      expect(modules[1].name).toBe('Drawable');
    });

    it('should extract instance methods', () => {
      const code = `
class Calculator
  def add(a, b)
    a + b
  end

  def subtract(a, b)
    a - b
  end

  def multiply(a, b)
    a * b
  end
end
`;

      const result = parser.parse(code);

      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods).toHaveLength(3);

      expect(methods[0].name).toBe('add');
      expect(methods[1].name).toBe('subtract');
      expect(methods[2].name).toBe('multiply');
    });

    it('should extract class methods (singleton methods)', () => {
      const code = `
class Point
  def self.origin
    new(0, 0)
  end

  def self.random
    new(rand(100), rand(100))
  end
end
`;

      const result = parser.parse(code);

      const classMethods = result.symbols.filter(
        s => s.kind === 'method' && s.name.startsWith('self.')
      );
      expect(classMethods).toHaveLength(2);

      expect(classMethods[0].name).toBe('self.origin');
      expect(classMethods[1].name).toBe('self.random');
    });

    it('should extract constants', () => {
      const code = `
class Circle
  PI = 3.14159
  MAX_RADIUS = 1000
end

VERSION = "1.0.0"
MAX_SIZE = 100
`;

      const result = parser.parse(code);

      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(4);

      const constantNames = constants.map(c => c.name);
      expect(constantNames).toContain('PI');
      expect(constantNames).toContain('MAX_RADIUS');
      expect(constantNames).toContain('VERSION');
      expect(constantNames).toContain('MAX_SIZE');
    });

    it('should extract instance variables', () => {
      const code = `
class Point
  def initialize(x, y)
    @x = x
    @y = y
  end
end
`;

      const result = parser.parse(code);

      const variables = result.symbols.filter(s => s.kind === 'variable');
      expect(variables.length).toBeGreaterThanOrEqual(2);

      const varNames = variables.map(v => v.name);
      expect(varNames).toContain('@x');
      expect(varNames).toContain('@y');
    });

    it('should extract class variables', () => {
      const code = `
class Model
  @@table_name = nil

  def self.table_name=(name)
    @@table_name = name
  end
end
`;

      const result = parser.parse(code);

      const classVars = result.symbols.filter(
        s => s.kind === 'variable' && s.name.startsWith('@@')
      );
      expect(classVars.length).toBeGreaterThanOrEqual(1);
      expect(classVars[0].name).toBe('@@table_name');
    });

    it('should handle classes with mixins', () => {
      const code = `
module Serializable
  def to_json
    # Convert to JSON
  end
end

class Container
  include Serializable

  def initialize(value)
    @value = value
  end
end
`;

      const result = parser.parse(code);

      const modules = result.symbols.filter(s => s.kind === 'interface');
      const classes = result.symbols.filter(s => s.kind === 'class');

      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('Serializable');

      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('Container');
    });

    it('should include position information', () => {
      const code = `class Point
  def initialize(x, y)
    @x = x
    @y = y
  end
end`;

      const result = parser.parse(code);

      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
      const symbol = result.symbols[0];

      expect(symbol.line).toBe(1);
      expect(symbol.column).toBe(0);
      expect(symbol.endLine).toBeDefined();
      expect(symbol.endColumn).toBeDefined();
      expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
    });

    it('should handle complex Ruby code', () => {
      const code = `
module Validator
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    def validates(field, options = {})
      @validations ||= []
      @validations << { field: field, options: options }
    end
  end

  def valid?
    true
  end
end

class Product
  include Validator

  attr_accessor :name, :price

  validates :name, presence: true
  validates :price, presence: true

  def initialize(name: nil, price: nil)
    @name = name
    @price = price
  end

  def in_stock?
    @quantity > 0
  end

  def self.expensive(threshold)
    # Query expensive products
  end
end

MAX_RETRIES = 3
DEFAULT_TIMEOUT = 60
`;

      const result = parser.parse(code);

      const modules = result.symbols.filter(s => s.kind === 'interface');
      const classes = result.symbols.filter(s => s.kind === 'class');
      const methods = result.symbols.filter(s => s.kind === 'method');
      const constants = result.symbols.filter(s => s.kind === 'constant');

      expect(modules.length).toBeGreaterThanOrEqual(2);
      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(methods.length).toBeGreaterThanOrEqual(5);
      expect(constants.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle state machine pattern', () => {
      const code = `
class StateMachine
  attr_reader :current_state

  STATES = [:idle, :running, :paused, :stopped].freeze

  def initialize
    @current_state = :idle
  end

  def start
    @current_state = :running
  end

  def pause
    @current_state = :paused
  end

  def stop
    @current_state = :stopped
  end
end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      const constants = result.symbols.filter(s => s.kind === 'constant');
      const methods = result.symbols.filter(s => s.kind === 'method');

      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('StateMachine');

      expect(constants.length).toBeGreaterThanOrEqual(1);
      expect(methods.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle singleton pattern', () => {
      const code = `
class Config
  @instance = nil

  def initialize
    @host = 'localhost'
    @port = 8080
  end

  def self.instance
    @instance ||= new
  end

  def self.reset
    @instance = nil
  end

  private_class_method :new
end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      const methods = result.symbols.filter(s => s.kind === 'method');
      const classMethods = methods.filter(m => m.name.startsWith('self.'));

      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('Config');

      expect(classMethods.length).toBeGreaterThanOrEqual(2);
      expect(classMethods.map(m => m.name)).toContain('self.instance');
      expect(classMethods.map(m => m.name)).toContain('self.reset');
    });

    it('should handle builder pattern', () => {
      const code = `
class ConfigBuilder
  def initialize
    @host = nil
    @port = nil
  end

  def host(value)
    @host = value
    self
  end

  def port(value)
    @port = value
    self
  end

  def build
    config = OpenStruct.new
    config.host = @host
    config.port = @port || 8080
    config
  end

  def self.create
    new
  end
end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      const methods = result.symbols.filter(s => s.kind === 'method');

      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('ConfigBuilder');

      expect(methods.length).toBeGreaterThanOrEqual(5);
      expect(methods.map(m => m.name)).toContain('host');
      expect(methods.map(m => m.name)).toContain('port');
      expect(methods.map(m => m.name)).toContain('build');
    });

    it('should handle observer pattern', () => {
      const code = `
module Observable
  def initialize
    super
    @observers = []
  end

  def add_observer(observer)
    @observers << observer
  end

  def notify_observers(event)
    @observers.each { |observer| observer.update(event) }
  end
end

class Subject
  include Observable

  def initialize
    super
    @state = :idle
  end

  def change_state(new_state)
    @state = new_state
    notify_observers(new_state)
  end
end
`;

      const result = parser.parse(code);

      const modules = result.symbols.filter(s => s.kind === 'interface');
      const classes = result.symbols.filter(s => s.kind === 'class');

      expect(modules.length).toBeGreaterThanOrEqual(1);
      expect(modules[0].name).toBe('Observable');

      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(classes[0].name).toBe('Subject');
    });

    it('should handle error classes', () => {
      const code = `
class ApplicationError < StandardError; end
class ValidationError < ApplicationError; end
class NotFoundError < ApplicationError; end
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(3);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('ApplicationError');
      expect(classNames).toContain('ValidationError');
      expect(classNames).toContain('NotFoundError');
    });

    it('should handle metaprogramming patterns', () => {
      const code = `
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
`;

      const result = parser.parse(code);

      const modules = result.symbols.filter(s => s.kind === 'interface');
      const methods = result.symbols.filter(s => s.kind === 'method');

      expect(modules.length).toBeGreaterThanOrEqual(2);
      expect(methods.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('fixture files', () => {
    it('should parse sample1.rb (basic Ruby features)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'ruby', 'sample1.rb');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract: Point, Circle, Calculator, ScientificCalculator,
      // CalculatorFactory, Shape, Rectangle classes
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(7);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Point');
      expect(classNames).toContain('Circle');
      expect(classNames).toContain('Calculator');
      expect(classNames).toContain('ScientificCalculator');
      expect(classNames).toContain('CalculatorFactory');
      expect(classNames).toContain('Shape');
      expect(classNames).toContain('Rectangle');

      // Should extract constants
      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(5);

      // Should extract methods
      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods.length).toBeGreaterThanOrEqual(15);
    });

    it('should parse sample2.rb (modules and mixins)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'ruby', 'sample2.rb');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract modules: Comparable, Drawable, Serializable, Observable, Enumerable
      const modules = result.symbols.filter(s => s.kind === 'interface');
      expect(modules.length).toBeGreaterThanOrEqual(5);

      const moduleNames = modules.map(m => m.name);
      expect(moduleNames).toContain('Comparable');
      expect(moduleNames).toContain('Drawable');
      expect(moduleNames).toContain('Serializable');
      expect(moduleNames).toContain('Observable');
      expect(moduleNames).toContain('Enumerable');

      // Should extract classes: Container, Pair, Result, Shape, Rectangle, etc.
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(8);

      // Should extract constants
      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse sample3.rb (advanced patterns)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'ruby', 'sample3.rb');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract classes: Config, ConfigBuilder, StateMachine, Model, User, Post, Product, etc.
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(10);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Config');
      expect(classNames).toContain('ConfigBuilder');
      expect(classNames).toContain('StateMachine');
      expect(classNames).toContain('Model');
      expect(classNames).toContain('User');
      expect(classNames).toContain('Post');
      expect(classNames).toContain('Product');
      expect(classNames).toContain('CachedCalculator');

      // Should extract modules: Validator, Cacheable
      const modules = result.symbols.filter(s => s.kind === 'interface');
      expect(modules.length).toBeGreaterThanOrEqual(2);

      const moduleNames = modules.map(m => m.name);
      expect(moduleNames).toContain('Validator');
      expect(moduleNames).toContain('Cacheable');

      // Should extract constants
      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(4);

      // Should extract error classes
      expect(classNames).toContain('ApplicationError');
      expect(classNames).toContain('ValidationError');
      expect(classNames).toContain('NotFoundError');
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', () => {
      // Tree-sitter parsers are error-tolerant
      const code = `
class Incomplete
  def method(
    # Missing closing parenthesis and body
`;

      // Should not throw, but parse what it can
      const result = parser.parse(code);

      expect(result.symbols).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
class ValidClass
  def valid_method
    true
  end
end

class InvalidClass
  def incomplete_method(
    # Missing parts

class AnotherValid
  def another_method
    false
  end
end
`;

      const result = parser.parse(code);

      // Should extract the valid classes
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance', () => {
    it('should parse large files quickly', () => {
      // Generate a large Ruby file
      const lines = ['# Large Ruby file', ''];
      for (let i = 0; i < 100; i++) {
        lines.push(`class Class${i}`);
        lines.push(`  def method${i}`);
        lines.push(`    @value${i} = ${i}`);
        lines.push('  end');
        lines.push('end');
        lines.push('');
      }
      const code = lines.join('\n');

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(100);
      // Should parse in reasonable time (< 100ms for 100 classes)
      expect(result.parseTime).toBeLessThan(100);
    });
  });
});
