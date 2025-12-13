"""
Test fixture for Python dunder method recognition.
Dunder methods are implicitly called by Python runtime and should NOT be flagged.
"""


class CompleteClass:
    """A class with many dunder methods - none should be flagged."""

    def __init__(self, value):
        self._value = value

    def __str__(self):
        return f"CompleteClass({self._value})"

    def __repr__(self):
        return f"CompleteClass(value={self._value!r})"

    def __eq__(self, other):
        if isinstance(other, CompleteClass):
            return self._value == other._value
        return False

    def __hash__(self):
        return hash(self._value)

    def __len__(self):
        return len(self._value) if hasattr(self._value, "__len__") else 1

    def __iter__(self):
        if hasattr(self._value, "__iter__"):
            return iter(self._value)
        return iter([self._value])

    def __getitem__(self, key):
        if hasattr(self._value, "__getitem__"):
            return self._value[key]
        raise TypeError("not subscriptable")

    def __call__(self, *args, **kwargs):
        return self._value


class ContextManager:
    """Context manager - __enter__ and __exit__ should NOT be flagged."""

    def __init__(self, name):
        self.name = name

    def __enter__(self):
        print(f"Entering {self.name}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Exiting {self.name}")
        return False


# Unused regular method - SHOULD be flagged
class PartialClass:
    def __init__(self, value):
        self.value = value

    def unused_method(self):
        """This method is never called."""
        return "unused"

    def used_method(self):
        """This method is called."""
        return self.value


def main():
    obj = CompleteClass([1, 2, 3])
    print(str(obj))
    print(repr(obj))
    print(len(obj))
    for item in obj:
        print(item)
    print(obj[0])
    print(obj())

    with ContextManager("test") as cm:
        print(cm.name)

    partial = PartialClass("test")
    print(partial.used_method())


if __name__ == "__main__":
    main()
