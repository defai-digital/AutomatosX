"""
Test fixture for Python dead code detection.
This file contains intentional examples of dead code for testing.
"""

# Unused imports
import os
import sys
from typing import List, Optional  # Only Optional is used below

# Used import
import json

# Unused constant
UNUSED_CONST = "never_used"

# Used constant
USED_CONST = "this is used"


def unused_func():
    """This function is never called."""
    return "dead code"


def used_func():
    """This function is called."""
    return USED_CONST


class UnusedClass:
    """This class is never instantiated or subclassed."""

    def method(self):
        return "unused"


class UsedClass:
    """This class is used."""

    def __init__(self, value: Optional[str] = None):
        self.value = value

    def get_value(self):
        return self.value


# Unused variable (not constant, lowercase)
unused_var = 42

# Used variable
used_var = json.dumps({"key": "value"})


def main():
    """Main function that uses some of the defined symbols."""
    result = used_func()
    obj = UsedClass("test")
    print(result, obj.get_value(), used_var)


if __name__ == "__main__":
    main()
