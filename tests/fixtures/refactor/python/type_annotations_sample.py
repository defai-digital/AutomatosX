"""
Test fixture for Python type annotation detection.
Type-only imports should be detected and suggested for TYPE_CHECKING guard.
"""

from typing import TYPE_CHECKING, List, Optional, Dict

# Type-only import - should be detected as type-only usage
from dataclasses import dataclass

if TYPE_CHECKING:
    # These imports are properly guarded - should NOT be flagged
    from typing import TypeVar

# This import is used only in type annotations, not at runtime
# Should be flagged with "type_only_usage" reason
from collections.abc import Sequence  # Only used in type hint below


def process_items(items: Sequence[str]) -> List[str]:
    """Items parameter uses Sequence type, but could use TYPE_CHECKING."""
    return list(items)


def get_config() -> Optional[Dict[str, str]]:
    """Returns optional config dict."""
    return {"key": "value"}


# Used at runtime
@dataclass
class Config:
    name: str
    value: int


def main():
    result = process_items(["a", "b", "c"])
    config = get_config()
    cfg = Config("test", 42)
    print(result, config, cfg)


if __name__ == "__main__":
    main()
