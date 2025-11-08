// sample2.cpp - Templates and advanced features

#include <vector>
#include <memory>

// Template class
template<typename T>
class Container {
private:
    T value;

public:
    Container(T val) : value(val) {}

    T get() const {
        return value;
    }

    void set(T val) {
        value = val;
    }
};

// Template function
template<typename T>
T maximum(T a, T b) {
    return (a > b) ? a : b;
}

// Template struct
template<typename TFirst, typename TSecond>
struct Pair {
    TFirst first;
    TSecond second;

    Pair(TFirst f, TSecond s) : first(f), second(s) {}
};

// Smart pointer example
template<typename T>
class UniquePtr {
private:
    T* ptr;

public:
    explicit UniquePtr(T* p = nullptr) : ptr(p) {}

    ~UniquePtr() {
        delete ptr;
    }

    T* get() const {
        return ptr;
    }

    T* release() {
        T* temp = ptr;
        ptr = nullptr;
        return temp;
    }
};

// Interface (abstract class)
class IDrawable {
public:
    virtual void draw() = 0;
    virtual ~IDrawable() = default;
};

// Implementation
class Shape : public IDrawable {
protected:
    int x, y;

public:
    Shape(int x, int y) : x(x), y(y) {}

    void draw() override {
        // Draw implementation
    }

    virtual double area() const = 0;
};

class RectangleShape : public Shape {
private:
    int width, height;

public:
    RectangleShape(int x, int y, int w, int h)
        : Shape(x, y), width(w), height(h) {}

    double area() const override {
        return width * height;
    }
};

// Namespace with nested namespace
namespace graphics {
    namespace d2 {
        class Point2D {
        public:
            double x, y;
        };
    }

    namespace d3 {
        class Point3D {
        public:
            double x, y, z;
        };
    }
}

// Constants
const int BUFFER_SIZE = 4096;
const int MAX_RETRIES = 3;
