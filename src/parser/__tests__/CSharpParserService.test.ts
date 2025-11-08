/**
 * CSharpParserService.test.ts
 *
 * Tests for C# language parser using Tree-sitter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CSharpParserService } from '../CSharpParserService.js';
import { Symbol, SymbolKind } from '../LanguageParser.js';
import * as fs from 'fs';
import * as path from 'path';

describe('CSharpParserService', () => {
  let parser: CSharpParserService;

  beforeEach(() => {
    parser = new CSharpParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('csharp');
    });

    it('should support C# file extensions', () => {
      expect(parser.extensions).toEqual(['.cs']);
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
namespace MyApp
{
    public class Calculator
    {
        private double _memory;
    }

    public class Helper
    {
        public void Help() {}
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(2);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Calculator');
      expect(classNames).toContain('Helper');
    });

    it('should extract interface declarations', () => {
      const code = `
namespace MyApp
{
    public interface ICalculator
    {
        double Add(double a, double b);
    }

    public interface IHelper
    {
        void Help();
    }
}
`;

      const result = parser.parse(code);

      const interfaces = result.symbols.filter(s => s.kind === 'interface');
      expect(interfaces).toHaveLength(2);

      expect(interfaces[0].name).toBe('ICalculator');
      expect(interfaces[1].name).toBe('IHelper');
    });

    it('should extract struct declarations', () => {
      const code = `
namespace MyApp
{
    public struct Point
    {
        public double X;
        public double Y;
    }

    public readonly struct Vector3
    {
        public double X { get; }
    }
}
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs).toHaveLength(2);

      expect(structs[0].name).toBe('Point');
      expect(structs[1].name).toBe('Vector3');
    });

    it('should extract enum declarations', () => {
      const code = `
namespace MyApp
{
    public enum Status
    {
        Active,
        Inactive
    }

    public enum HttpStatusCode
    {
        OK = 200,
        NotFound = 404
    }
}
`;

      const result = parser.parse(code);

      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums).toHaveLength(2);

      expect(enums[0].name).toBe('Status');
      expect(enums[1].name).toBe('HttpStatusCode');
    });

    it('should extract method declarations', () => {
      const code = `
namespace MyApp
{
    public class Calculator
    {
        public double Add(double a, double b)
        {
            return a + b;
        }

        public double Subtract(double a, double b)
        {
            return a - b;
        }
    }
}
`;

      const result = parser.parse(code);

      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods).toHaveLength(2);

      expect(methods[0].name).toBe('Calculator.Add');
      expect(methods[1].name).toBe('Calculator.Subtract');
    });

    it('should extract constructors', () => {
      const code = `
namespace MyApp
{
    public class Calculator
    {
        private double _memory;

        public Calculator()
        {
            _memory = 0;
        }

        public Calculator(double initialMemory)
        {
            _memory = initialMemory;
        }
    }
}
`;

      const result = parser.parse(code);

      const constructors = result.symbols.filter(
        s => s.kind === 'method' && s.name.includes('Calculator')
      );
      expect(constructors).toHaveLength(2);
    });

    it('should extract properties', () => {
      const code = `
namespace MyApp
{
    public class Person
    {
        public string Name { get; set; }
        public int Age { get; private set; }
        public double Height { get; }
    }
}
`;

      const result = parser.parse(code);

      const properties = result.symbols.filter(s => s.kind === 'variable');
      expect(properties.length).toBeGreaterThanOrEqual(3);

      const propertyNames = properties.map(p => p.name);
      expect(propertyNames).toContain('Name');
      expect(propertyNames).toContain('Age');
      expect(propertyNames).toContain('Height');
    });

    it('should extract constants', () => {
      const code = `
namespace MyApp
{
    public class Constants
    {
        public const int MaxSize = 100;
        public const string Version = "1.0.0";
    }
}
`;

      const result = parser.parse(code);

      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(2);

      const constantNames = constants.map(c => c.name);
      expect(constantNames).toContain('MaxSize');
      expect(constantNames).toContain('Version');
    });

    it('should handle generic classes', () => {
      const code = `
namespace MyApp
{
    public class Container<T>
    {
        private T _value;

        public T Get()
        {
            return _value;
        }
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('Container');

      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle inheritance', () => {
      const code = `
namespace MyApp
{
    public class Calculator
    {
        public double Add(double a, double b)
        {
            return a + b;
        }
    }

    public class ScientificCalculator : Calculator
    {
        public double Power(double baseValue, double exponent)
        {
            return Math.Pow(baseValue, exponent);
        }
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('Calculator');
      expect(classes[1].name).toBe('ScientificCalculator');
    });

    it('should extract delegates', () => {
      const code = `
namespace MyApp
{
    public delegate void LogHandler(string message);
    public delegate T Factory<T>() where T : new();
}
`;

      const result = parser.parse(code);

      const delegates = result.symbols.filter(s => s.kind === 'type');
      expect(delegates).toHaveLength(2);

      const delegateNames = delegates.map(d => d.name);
      expect(delegateNames).toContain('LogHandler');
      expect(delegateNames).toContain('Factory');
    });

    it('should include position information', () => {
      const code = `namespace MyApp
{
    public class Calculator
    {
        public double Add(double a, double b)
        {
            return a + b;
        }
    }
}`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(1);

      const symbol = classes[0];
      expect(symbol.line).toBeGreaterThanOrEqual(1);
      expect(symbol.column).toBeGreaterThanOrEqual(0);
      expect(symbol.endLine).toBeDefined();
      expect(symbol.endColumn).toBeDefined();
      expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
    });

    it('should handle complex C# code', () => {
      const code = `
namespace MyApp
{
    public interface IRepository<T> where T : class
    {
        T GetById(int id);
        void Add(T entity);
    }

    public class UserRepository : IRepository<User>
    {
        private readonly Dictionary<int, User> _storage;

        public UserRepository()
        {
            _storage = new Dictionary<int, User>();
        }

        public User GetById(int id)
        {
            return _storage.ContainsKey(id) ? _storage[id] : null;
        }

        public void Add(User entity)
        {
            _storage[entity.Id] = entity;
        }
    }

    public enum UserStatus
    {
        Active,
        Inactive
    }
}
`;

      const result = parser.parse(code);

      const interfaces = result.symbols.filter(s => s.kind === 'interface');
      const classes = result.symbols.filter(s => s.kind === 'class');
      const enums = result.symbols.filter(s => s.kind === 'enum');
      const methods = result.symbols.filter(s => s.kind === 'method');

      expect(interfaces).toHaveLength(1);
      expect(classes).toHaveLength(1);
      expect(enums).toHaveLength(1);
      expect(methods.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('fixture files', () => {
    it('should parse sample1.cs (basic features)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'csharp', 'sample1.cs');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract classes: Point, Circle, Calculator, ScientificCalculator, etc.
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(6);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Point');
      expect(classNames).toContain('Circle');
      expect(classNames).toContain('Calculator');
      expect(classNames).toContain('ScientificCalculator');
      expect(classNames).toContain('Rectangle');

      // Should extract constants
      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(5);

      // Should extract methods
      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods.length).toBeGreaterThanOrEqual(15);
    });

    it('should parse sample2.cs (interfaces and generics)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'csharp', 'sample2.cs');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract interfaces
      const interfaces = result.symbols.filter(s => s.kind === 'interface');
      expect(interfaces.length).toBeGreaterThanOrEqual(5);

      const interfaceNames = interfaces.map(i => i.name);
      expect(interfaceNames).toContain('IRepository');
      expect(interfaceNames).toContain('IComparable');
      expect(interfaceNames).toContain('IDrawable');

      // Should extract generic classes
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(8);

      // Should extract delegates
      const delegates = result.symbols.filter(s => s.kind === 'type');
      expect(delegates.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse sample3.cs (modern patterns)', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'csharp', 'sample3.cs');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract classes
      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(10);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('AsyncDataService');
      expect(classNames).toContain('QueryBuilder');
      expect(classNames).toContain('StateMachine');
      expect(classNames).toContain('Configuration');
      expect(classNames).toContain('User');

      // Should extract enums
      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums.length).toBeGreaterThanOrEqual(1);

      // Should extract constants
      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
namespace MyApp
{
    public class Incomplete
    {
        public void Method(
            // Missing closing parenthesis and body
`;

      const result = parser.parse(code);

      expect(result.symbols).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
namespace MyApp
{
    public class Valid
    {
        public void Method() {}
    }

    public class Invalid
    {
        public void Incomplete(
        // Missing parts

    public class AnotherValid
    {
        public void Method() {}
    }
}
`;

      const result = parser.parse(code);

      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance', () => {
    it('should parse large files quickly', () => {
      const lines = ['namespace MyApp', '{'];
      for (let i = 0; i < 50; i++) {
        lines.push(`    public class Class${i}`);
        lines.push('    {');
        lines.push(`        public void Method${i}() {}`);
        lines.push('    }');
      }
      lines.push('}');
      const code = lines.join('\n');

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(50);
      expect(result.parseTime).toBeLessThan(100);
    });
  });
});
