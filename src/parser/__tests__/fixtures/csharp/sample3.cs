// sample3.cs - Modern C# patterns: async/await, LINQ, extension methods, attributes

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ModernPatterns
{
    // Extension methods
    public static class StringExtensions
    {
        public static bool IsNullOrEmpty(this string str)
        {
            return string.IsNullOrEmpty(str);
        }

        public static string Capitalize(this string str)
        {
            if (str.IsNullOrEmpty())
                return str;

            return char.ToUpper(str[0]) + str.Substring(1);
        }
    }

    public static class EnumerableExtensions
    {
        public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T> source)
        {
            return source.Where(item => item != null);
        }
    }

    // Attribute classes
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class LogAttribute : Attribute
    {
        public string Message { get; set; }

        public LogAttribute(string message)
        {
            Message = message;
        }
    }

    [AttributeUsage(AttributeTargets.Property)]
    public class RequiredAttribute : Attribute
    {
    }

    // Async/await patterns
    public class AsyncDataService
    {
        public async Task<string> FetchDataAsync(string url)
        {
            await Task.Delay(100); // Simulate network delay
            return $"Data from {url}";
        }

        public async Task<T> FetchJsonAsync<T>(string url) where T : class
        {
            await Task.Delay(100);
            return default(T);
        }

        public async Task ProcessBatchAsync(IEnumerable<string> urls)
        {
            var tasks = urls.Select(url => FetchDataAsync(url));
            await Task.WhenAll(tasks);
        }
    }

    // Builder pattern
    public class QueryBuilder
    {
        private string _table;
        private List<string> _columns = new List<string>();
        private string _whereClause;
        private int? _limit;

        public QueryBuilder From(string table)
        {
            _table = table;
            return this;
        }

        public QueryBuilder Select(params string[] columns)
        {
            _columns.AddRange(columns);
            return this;
        }

        public QueryBuilder Where(string condition)
        {
            _whereClause = condition;
            return this;
        }

        public QueryBuilder Limit(int limit)
        {
            _limit = limit;
            return this;
        }

        public string Build()
        {
            var columns = _columns.Any() ? string.Join(", ", _columns) : "*";
            var query = $"SELECT {columns} FROM {_table}";

            if (!string.IsNullOrEmpty(_whereClause))
                query += $" WHERE {_whereClause}";

            if (_limit.HasValue)
                query += $" LIMIT {_limit.Value}";

            return query;
        }

        public static QueryBuilder Create()
        {
            return new QueryBuilder();
        }
    }

    // State machine pattern
    public enum MachineState
    {
        Idle,
        Running,
        Paused,
        Stopped
    }

    public class StateMachine
    {
        public MachineState CurrentState { get; private set; }

        public StateMachine()
        {
            CurrentState = MachineState.Idle;
        }

        public void Start()
        {
            if (CurrentState != MachineState.Idle && CurrentState != MachineState.Stopped)
                throw new InvalidOperationException($"Cannot start from {CurrentState}");

            CurrentState = MachineState.Running;
        }

        public void Pause()
        {
            if (CurrentState != MachineState.Running)
                throw new InvalidOperationException($"Cannot pause from {CurrentState}");

            CurrentState = MachineState.Paused;
        }

        public void Resume()
        {
            if (CurrentState != MachineState.Paused)
                throw new InvalidOperationException($"Cannot resume from {CurrentState}");

            CurrentState = MachineState.Running;
        }

        public void Stop()
        {
            CurrentState = MachineState.Stopped;
        }

        public void Reset()
        {
            CurrentState = MachineState.Idle;
        }
    }

    // Singleton pattern
    public sealed class Configuration
    {
        private static Configuration _instance;
        private static readonly object _lock = new object();

        public string Host { get; set; }
        public int Port { get; set; }
        public int Timeout { get; set; }

        private Configuration()
        {
            Host = "localhost";
            Port = 8080;
            Timeout = 30;
        }

        public static Configuration Instance
        {
            get
            {
                if (_instance == null)
                {
                    lock (_lock)
                    {
                        if (_instance == null)
                        {
                            _instance = new Configuration();
                        }
                    }
                }
                return _instance;
            }
        }

        public static void Reset()
        {
            lock (_lock)
            {
                _instance = null;
            }
        }
    }

    // Model base class
    public abstract class Model
    {
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        protected Model()
        {
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public virtual void Save()
        {
            UpdatedAt = DateTime.UtcNow;
            // Save logic
        }

        public virtual void Delete()
        {
            // Delete logic
        }
    }

    // User model
    [Log("User model accessed")]
    public class User : Model
    {
        [Required]
        public string Name { get; set; }

        [Required]
        public string Email { get; set; }

        public int Age { get; set; }

        public User()
        {
        }

        public User(string name, string email, int age)
        {
            Name = name;
            Email = email;
            Age = age;
        }

        public bool IsAdult()
        {
            return Age >= 18;
        }

        public static User FindByEmail(string email)
        {
            // Find user by email
            return null;
        }
    }

    // Post model
    public class Post : Model
    {
        public string Title { get; set; }
        public string Content { get; set; }
        public int UserId { get; set; }
        public bool Published { get; set; }

        public User GetAuthor()
        {
            // Get author by UserId
            return null;
        }

        public static IEnumerable<Post> GetPublished()
        {
            // Get all published posts
            return Enumerable.Empty<Post>();
        }
    }

    // Validation service
    public interface IValidator<T>
    {
        ValidationResult Validate(T item);
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; }

        public ValidationResult()
        {
            Errors = new List<string>();
            IsValid = true;
        }
    }

    public class UserValidator : IValidator<User>
    {
        public ValidationResult Validate(User user)
        {
            var result = new ValidationResult();

            if (string.IsNullOrEmpty(user.Name))
            {
                result.IsValid = false;
                result.Errors.Add("Name is required");
            }

            if (string.IsNullOrEmpty(user.Email))
            {
                result.IsValid = false;
                result.Errors.Add("Email is required");
            }

            if (user.Age < 0)
            {
                result.IsValid = false;
                result.Errors.Add("Age must be positive");
            }

            return result;
        }
    }

    // Cache service
    public class CacheService<TKey, TValue>
    {
        private readonly Dictionary<TKey, CacheEntry<TValue>> _cache;
        private readonly TimeSpan _defaultTTL;

        public CacheService(TimeSpan defaultTTL)
        {
            _cache = new Dictionary<TKey, CacheEntry<TValue>>();
            _defaultTTL = defaultTTL;
        }

        public void Set(TKey key, TValue value)
        {
            _cache[key] = new CacheEntry<TValue>(value, DateTime.UtcNow.Add(_defaultTTL));
        }

        public bool TryGet(TKey key, out TValue value)
        {
            if (_cache.ContainsKey(key))
            {
                var entry = _cache[key];
                if (entry.ExpiresAt > DateTime.UtcNow)
                {
                    value = entry.Value;
                    return true;
                }
                else
                {
                    _cache.Remove(key);
                }
            }

            value = default(TValue);
            return false;
        }

        public void Clear()
        {
            _cache.Clear();
        }

        private class CacheEntry<T>
        {
            public T Value { get; set; }
            public DateTime ExpiresAt { get; set; }

            public CacheEntry(T value, DateTime expiresAt)
            {
                Value = value;
                ExpiresAt = expiresAt;
            }
        }
    }

    // Error classes
    public class ApplicationException : Exception
    {
        public ApplicationException(string message) : base(message)
        {
        }
    }

    public class ValidationException : ApplicationException
    {
        public ValidationException(string message) : base(message)
        {
        }
    }

    public class NotFoundException : ApplicationException
    {
        public NotFoundException(string message) : base(message)
        {
        }
    }

    // Constants
    public static class AppConstants
    {
        public const int MaxRetries = 3;
        public const int DefaultTimeout = 60;
        public const int BufferSize = 8192;
        public const string AppVersion = "3.0.0";
    }
}
