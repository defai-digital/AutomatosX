// sample3.cpp - Modern C++ features and patterns

#include <string>
#include <vector>
#include <functional>
#include <memory>

// Singleton pattern
class Configuration {
private:
    static Configuration* instance;
    std::string host;
    int port;

    Configuration() : host("localhost"), port(8080) {}

public:
    static Configuration& getInstance() {
        if (!instance) {
            instance = new Configuration();
        }
        return *instance;
    }

    std::string getHost() const { return host; }
    int getPort() const { return port; }
};

Configuration* Configuration::instance = nullptr;

// Builder pattern
class QueryBuilder {
private:
    std::string table;
    std::vector<std::string> columns;
    std::string whereClause;

public:
    QueryBuilder& from(const std::string& t) {
        table = t;
        return *this;
    }

    QueryBuilder& select(const std::string& col) {
        columns.push_back(col);
        return *this;
    }

    QueryBuilder& where(const std::string& condition) {
        whereClause = condition;
        return *this;
    }

    std::string build() const {
        return "SELECT * FROM " + table;
    }
};

// Observer pattern
class Observer {
public:
    virtual void update(int value) = 0;
    virtual ~Observer() = default;
};

class Subject {
private:
    std::vector<Observer*> observers;
    int state;

public:
    void attach(Observer* obs) {
        observers.push_back(obs);
    }

    void setState(int s) {
        state = s;
        notify();
    }

    void notify() {
        for (auto obs : observers) {
            obs->update(state);
        }
    }
};

// Template specialization
template<typename T>
class Stack {
private:
    std::vector<T> items;

public:
    void push(const T& item) {
        items.push_back(item);
    }

    T pop() {
        T item = items.back();
        items.pop_back();
        return item;
    }

    bool empty() const {
        return items.empty();
    }
};

// Enum class with underlying type
enum class ErrorCode : int {
    Success = 0,
    NotFound = 404,
    ServerError = 500
};

// Struct with constructor
struct User {
    std::string name;
    std::string email;
    int age;

    User(std::string n, std::string e, int a)
        : name(n), email(e), age(a) {}

    bool isAdult() const {
        return age >= 18;
    }
};

// Constants
const int MAX_CONNECTIONS = 100;
const std::string APP_VERSION = "3.0.0";

// Function with lambda (just the function, lambda is expression)
void processData(std::function<int(int)> transform) {
    // Process with transform
}
