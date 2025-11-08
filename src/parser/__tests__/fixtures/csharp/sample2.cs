// sample2.cs - Interfaces, generics, LINQ, and advanced patterns

using System;
using System.Collections.Generic;
using System.Linq;

namespace AdvancedFeatures
{
    // Generic repository interface
    public interface IRepository<T> where T : class
    {
        T GetById(int id);
        IEnumerable<T> GetAll();
        void Add(T entity);
        void Update(T entity);
        void Delete(int id);
    }

    // Comparable interface
    public interface IComparable<T>
    {
        int CompareTo(T other);
    }

    // Drawable interface
    public interface IDrawable
    {
        void Draw();
        Rectangle GetBounds();
    }

    // Generic container class
    public class Container<T>
    {
        private T _value;

        public Container(T value)
        {
            _value = value;
        }

        public T Get()
        {
            return _value;
        }

        public void Set(T value)
        {
            _value = value;
        }

        public Container<TResult> Map<TResult>(Func<T, TResult> mapper)
        {
            return new Container<TResult>(mapper(_value));
        }

        public static Container<T> Wrap(T value)
        {
            return new Container<T>(value);
        }
    }

    // Generic pair class
    public struct Pair<TFirst, TSecond>
    {
        public TFirst First { get; set; }
        public TSecond Second { get; set; }

        public Pair(TFirst first, TSecond second)
        {
            First = first;
            Second = second;
        }

        public Pair<TSecond, TFirst> Swap()
        {
            return new Pair<TSecond, TFirst>(Second, First);
        }
    }

    // Result class for error handling
    public class Result<T>
    {
        public T Value { get; private set; }
        public Exception Error { get; private set; }

        private Result(T value, Exception error)
        {
            Value = value;
            Error = error;
        }

        public bool IsSuccess => Error == null;
        public bool IsFailure => !IsSuccess;

        public static Result<T> Success(T value)
        {
            return new Result<T>(value, null);
        }

        public static Result<T> Failure(Exception error)
        {
            return new Result<T>(default(T), error);
        }

        public T Unwrap()
        {
            if (IsFailure)
                throw Error;
            return Value;
        }
    }

    // Shape hierarchy with IDrawable
    public abstract class Shape : IDrawable
    {
        public string Color { get; set; }

        protected Shape(string color)
        {
            Color = color;
        }

        public abstract double Area();

        public virtual void Draw()
        {
            Console.WriteLine($"Drawing {GetType().Name}");
        }

        public abstract Rectangle GetBounds();
    }

    // Rectangle implementation
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

        public override Rectangle GetBounds()
        {
            return new Rectangle(Color, Width, Height);
        }
    }

    // Circle implementation
    public class CircleShape : Shape
    {
        public const double PI = 3.14159;

        public double Radius { get; set; }

        public CircleShape(string color, double radius)
            : base(color)
        {
            Radius = radius;
        }

        public override double Area()
        {
            return PI * Radius * Radius;
        }

        public override Rectangle GetBounds()
        {
            double diameter = 2 * Radius;
            return new Rectangle(Color, diameter, diameter);
        }
    }

    // Observer pattern implementation
    public interface IObserver<T>
    {
        void Update(T value);
    }

    public interface IObservable<T>
    {
        void Subscribe(IObserver<T> observer);
        void Unsubscribe(IObserver<T> observer);
        void Notify(T value);
    }

    // Subject implementation
    public class Subject<T> : IObservable<T>
    {
        private readonly List<IObserver<T>> _observers = new List<IObserver<T>>();
        private T _state;

        public T State
        {
            get => _state;
            set
            {
                _state = value;
                Notify(value);
            }
        }

        public void Subscribe(IObserver<T> observer)
        {
            if (!_observers.Contains(observer))
                _observers.Add(observer);
        }

        public void Unsubscribe(IObserver<T> observer)
        {
            _observers.Remove(observer);
        }

        public void Notify(T value)
        {
            foreach (var observer in _observers)
            {
                observer.Update(value);
            }
        }
    }

    // Observer implementation
    public class Observer<T> : IObserver<T>
    {
        public T LastValue { get; private set; }

        public void Update(T value)
        {
            LastValue = value;
            Console.WriteLine($"Observer received: {value}");
        }
    }

    // Strategy pattern
    public interface ISortStrategy<T>
    {
        IEnumerable<T> Sort(IEnumerable<T> items);
    }

    public class QuickSortStrategy<T> : ISortStrategy<T> where T : IComparable<T>
    {
        public IEnumerable<T> Sort(IEnumerable<T> items)
        {
            // Simplified QuickSort implementation
            var list = items.ToList();
            list.Sort();
            return list;
        }
    }

    // Repository implementation
    public class InMemoryRepository<T> : IRepository<T> where T : class
    {
        private readonly Dictionary<int, T> _storage = new Dictionary<int, T>();
        private int _nextId = 1;

        public T GetById(int id)
        {
            return _storage.ContainsKey(id) ? _storage[id] : null;
        }

        public IEnumerable<T> GetAll()
        {
            return _storage.Values;
        }

        public void Add(T entity)
        {
            _storage[_nextId++] = entity;
        }

        public void Update(T entity)
        {
            // Update logic here
        }

        public void Delete(int id)
        {
            _storage.Remove(id);
        }
    }

    // Event handling
    public class Button
    {
        public event EventHandler Click;
        public event EventHandler<MouseEventArgs> MouseMove;

        public void OnClick()
        {
            Click?.Invoke(this, EventArgs.Empty);
        }

        public void OnMouseMove(int x, int y)
        {
            MouseMove?.Invoke(this, new MouseEventArgs(x, y));
        }
    }

    public class MouseEventArgs : EventArgs
    {
        public int X { get; set; }
        public int Y { get; set; }

        public MouseEventArgs(int x, int y)
        {
            X = x;
            Y = y;
        }
    }

    // Delegate types
    public delegate void LogHandler(string message);
    public delegate T Factory<T>() where T : new();
    public delegate TResult Transformer<TIn, TResult>(TIn input);

    // Constants
    public static class Configuration
    {
        public const int DefaultBufferSize = 4096;
        public const int MaxRetries = 3;
        public const string Version = "2.0.0";
    }
}
