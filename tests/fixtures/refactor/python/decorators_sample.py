"""
Test fixture for Python decorator-aware dead code detection.
Decorated functions should not be flagged as dead code.
"""

from dataclasses import dataclass
from functools import lru_cache


# Property decorator - should NOT be flagged
class MyClass:
    def __init__(self):
        self._value = 0

    @property
    def value(self):
        return self._value

    @staticmethod
    def helper():
        """Static method - should NOT be flagged."""
        return 42

    @classmethod
    def create(cls):
        """Class method - should NOT be flagged."""
        return cls()


# lru_cache decorator - should NOT be flagged
@lru_cache(maxsize=128)
def cached_computation(x: int) -> int:
    return x * 2


# dataclass decorator - should NOT be flagged
@dataclass
class DataPoint:
    x: float
    y: float


# Regular unused function - SHOULD be flagged
def truly_unused():
    """This is actually unused."""
    pass


# Usage
def main():
    obj = MyClass()
    print(obj.value)
    print(MyClass.helper())
    print(MyClass.create())
    print(cached_computation(10))
    point = DataPoint(1.0, 2.0)
    print(point)


if __name__ == "__main__":
    main()
