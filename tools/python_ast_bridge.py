#!/usr/bin/env python3
"""Python AST bridge for AutomatosX bugfix and refactor tools.

Uses Python's native `ast` module for accurate detection of:
- Resource leaks (files, sockets, connections without close/context manager)
- Missing context managers (open() without 'with')
- Async resource leaks (aiohttp sessions without async with)
- Executor leaks (ThreadPoolExecutor without shutdown)
- Exception handling issues (bare except, swallowed exceptions)
- Dead code detection (unused imports, functions, classes, variables)

Input (stdin JSON):
{
  "action": "analyze",
  "path": "src/app.py",
  "content": "import os\\nf = open('file.txt')\\n...",
  "queries": [
    {"type": "resource_leak", "patterns": ["open", "socket.socket"]},
    {"type": "missing_context_manager"},
    {"type": "async_resource_leak"},
    {"type": "executor_leak"},
    {"type": "exception_handling"},
    {"type": "unused_import"},
    {"type": "unused_function"},
    {"type": "unused_class"},
    {"type": "unused_variable"}
  ]
}

Output (stdout JSON):
{
  "findings": [
    {
      "type": "resource_leak",
      "line": 2,
      "column": 4,
      "endLine": 2,
      "endColumn": 22,
      "message": "Resource `f` from open not managed with with-statement or close()",
      "context": "f = open('file.txt')",
      "metadata": {"variableName": "f", "resourceType": "file"}
    }
  ],
  "symbols": [...],  // Optional: extracted symbols for dead code analysis
  "parseErrors": [],
  "pythonVersion": "3.11"
}
"""

import ast
import json
import sys
import platform
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional, Set


# ---------------------------------------------------------------------------
# Input/Output types
# ---------------------------------------------------------------------------

@dataclass
class Finding:
    type: str
    line: int
    column: int
    endLine: Optional[int]
    endColumn: Optional[int]
    message: str
    context: str
    metadata: Dict[str, Any]


@dataclass
class ParseError:
    message: str
    line: Optional[int]
    column: Optional[int]


# ---------------------------------------------------------------------------
# AST utilities
# ---------------------------------------------------------------------------

def _call_qualname(node: ast.AST) -> Optional[str]:
    """Return dotted name for a call target (Name/Attribute)."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parts: List[str] = []
        cur: ast.AST = node
        while isinstance(cur, ast.Attribute):
            parts.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name):
            parts.append(cur.id)
            return ".".join(reversed(parts))
    return None


def _first_assigned_name(targets: Iterable[ast.AST]) -> Optional[str]:
    for target in targets:
        if isinstance(target, ast.Name):
            return target.id
    return None


def _get_source_line(source_lines: List[str], lineno: int) -> str:
    """Get source line (1-indexed) safely."""
    if 0 < lineno <= len(source_lines):
        return source_lines[lineno - 1].strip()
    return ""


# ---------------------------------------------------------------------------
# Resource usage analysis
# ---------------------------------------------------------------------------

RESOURCE_CALLS: Dict[str, str] = {
    # Sync resources
    "open": "sync_resource",
    "io.open": "sync_resource",
    "pathlib.Path.open": "sync_resource",
    "socket.socket": "sync_resource",
    "sqlite3.connect": "sync_resource",
    "psycopg2.connect": "sync_resource",
    "mysql.connector.connect": "sync_resource",
    # Async resources
    "aiohttp.ClientSession": "async_resource",
    "asyncpg.connect": "async_resource",
    "aiofiles.open": "async_resource",
    "aioredis.from_url": "async_resource",
    # Executors
    "concurrent.futures.ThreadPoolExecutor": "executor",
    "concurrent.futures.ProcessPoolExecutor": "executor",
    "ThreadPoolExecutor": "executor",
    "ProcessPoolExecutor": "executor",
}

CLEANUP_METHODS: Dict[str, Set[str]] = {
    "sync_resource": {"close", "disconnect", "release"},
    "async_resource": {"close", "aclose", "disconnect", "release"},
    "executor": {"shutdown"},
}


@dataclass
class ResourceCall:
    category: str
    qualname: str
    lineno: int
    col: int
    end_lineno: Optional[int]
    end_col: Optional[int]
    assigned_to: Optional[str]
    context_kind: Optional[str]  # None | "with" | "asyncwith"


class ResourceUsageAnalyzer(ast.NodeVisitor):
    """Collect resource creation sites and cleanup calls."""

    def __init__(self) -> None:
        self.calls: List[ResourceCall] = []
        self.cleanups: Dict[str, Set[str]] = {}
        self._context_kind: Optional[str] = None
        self._assign_targets: List[Optional[str]] = []

    def visit_With(self, node: ast.With) -> Any:
        for item in node.items:
            prev = self._context_kind
            self._context_kind = "with"
            self.visit(item.context_expr)
            self._context_kind = prev
            if item.optional_vars:
                self.visit(item.optional_vars)
        for stmt in node.body:
            self.visit(stmt)

    def visit_AsyncWith(self, node: ast.AsyncWith) -> Any:
        for item in node.items:
            prev = self._context_kind
            self._context_kind = "asyncwith"
            self.visit(item.context_expr)
            self._context_kind = prev
            if item.optional_vars:
                self.visit(item.optional_vars)
        for stmt in node.body:
            self.visit(stmt)

    def visit_Assign(self, node: ast.Assign) -> Any:
        target_name = _first_assigned_name(node.targets)
        self._assign_targets.append(target_name)
        self.visit(node.value)
        self._assign_targets.pop()
        for target in node.targets:
            self.visit(target)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> Any:
        target_name = _first_assigned_name([node.target])
        self._assign_targets.append(target_name)
        if node.value:
            self.visit(node.value)
        self._assign_targets.pop()
        self.visit(node.target)
        if node.annotation:
            self.visit(node.annotation)

    def visit_Call(self, node: ast.Call) -> Any:
        # Cleanup detection
        if isinstance(node.func, ast.Attribute):
            attr = node.func.attr
            if isinstance(node.func.value, ast.Name):
                var = node.func.value.id
                self.cleanups.setdefault(var, set()).add(attr)

        qualname = _call_qualname(node.func)
        category = RESOURCE_CALLS.get(qualname or "")
        if category:
            assigned_to = self._assign_targets[-1] if self._assign_targets else None
            self.calls.append(
                ResourceCall(
                    category=category,
                    qualname=qualname or "",
                    lineno=getattr(node, "lineno", 1),
                    col=getattr(node, "col_offset", 0) + 1,
                    end_lineno=getattr(node, "end_lineno", None),
                    end_col=getattr(node, "end_col_offset", None),
                    assigned_to=assigned_to,
                    context_kind=self._context_kind,
                )
            )

        self.generic_visit(node)


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

class BaseDetector:
    def __init__(self, analyzer: ResourceUsageAnalyzer, source_lines: List[str]) -> None:
        self.analyzer = analyzer
        self.source_lines = source_lines
        self.findings: List[Finding] = []

    def report(self, type_name: str, message: str, lineno: int, col: int,
               end_lineno: Optional[int] = None, end_col: Optional[int] = None,
               metadata: Optional[Dict[str, Any]] = None) -> None:
        context = _get_source_line(self.source_lines, lineno)
        self.findings.append(Finding(
            type=type_name,
            line=lineno,
            column=col,
            endLine=end_lineno or lineno,
            endColumn=end_col,
            message=message,
            context=context,
            metadata=metadata or {}
        ))

    def run(self) -> None:
        raise NotImplementedError

    def _has_cleanup(self, var: str, methods: Set[str]) -> bool:
        return bool(self.analyzer.cleanups.get(var, set()) & methods)


class ResourceLeakDetector(BaseDetector):
    def run(self) -> None:
        for call in self.analyzer.calls:
            if call.category != "sync_resource":
                continue
            if call.context_kind == "with":
                continue
            if call.assigned_to and self._has_cleanup(call.assigned_to, CLEANUP_METHODS["sync_resource"]):
                continue
            name = call.assigned_to or "<unnamed>"
            self.report(
                "resource_leak",
                f"Resource `{name}` from {call.qualname} not managed with with-statement or close()",
                call.lineno,
                call.col,
                call.end_lineno,
                call.end_col,
                {"variableName": name, "resourceType": "file", "callName": call.qualname}
            )


class MissingContextManagerDetector(BaseDetector):
    def run(self) -> None:
        for call in self.analyzer.calls:
            if call.category != "sync_resource":
                continue
            if call.context_kind == "with":
                continue
            if not call.assigned_to:
                continue
            # Skip if already reported by ResourceLeakDetector (avoid duplicates)
            if self._has_cleanup(call.assigned_to, CLEANUP_METHODS["sync_resource"]):
                # Has cleanup but not using context manager - suggest improvement
                self.report(
                    "missing_context_manager",
                    f"`{call.assigned_to}` should use a with-statement instead of manual close()",
                    call.lineno,
                    call.col,
                    call.end_lineno,
                    call.end_col,
                    {"variableName": call.assigned_to, "callName": call.qualname, "hasClose": True}
                )


class AsyncResourceLeakDetector(BaseDetector):
    def run(self) -> None:
        for call in self.analyzer.calls:
            if call.category != "async_resource":
                continue
            if call.context_kind == "asyncwith":
                continue
            if call.assigned_to and self._has_cleanup(call.assigned_to, CLEANUP_METHODS["async_resource"]):
                continue
            name = call.assigned_to or "<unnamed>"
            self.report(
                "async_resource_leak",
                f"Async resource `{name}` from {call.qualname} not managed with async with or close()/aclose()",
                call.lineno,
                call.col,
                call.end_lineno,
                call.end_col,
                {"variableName": name, "resourceType": "async", "callName": call.qualname}
            )


class ExecutorLeakDetector(BaseDetector):
    def run(self) -> None:
        for call in self.analyzer.calls:
            if call.category != "executor":
                continue
            if call.context_kind == "with":
                continue
            if call.assigned_to and self._has_cleanup(call.assigned_to, CLEANUP_METHODS["executor"]):
                continue
            name = call.assigned_to or "<unnamed>"
            self.report(
                "executor_leak",
                f"Executor `{name}` from {call.qualname} not managed with with-statement or shutdown()",
                call.lineno,
                call.col,
                call.end_lineno,
                call.end_col,
                {"variableName": name, "executorType": call.qualname}
            )


class ExceptionHandlingDetector(BaseDetector):
    def __init__(self, analyzer: ResourceUsageAnalyzer, source_lines: List[str], tree: ast.AST):
        super().__init__(analyzer, source_lines)
        self.tree = tree

    def run(self) -> None:
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ExceptHandler):
                self._handle_except(node)

    def _handle_except(self, node: ast.ExceptHandler) -> None:
        lineno = getattr(node, "lineno", 1)
        col = getattr(node, "col_offset", 0) + 1
        end_lineno = getattr(node, "end_lineno", None)
        end_col = getattr(node, "end_col_offset", None)

        if node.type is None:
            self.report(
                "exception_handling",
                "Bare except catches all exceptions; catch specific exception types instead",
                lineno, col, end_lineno, end_col,
                {"issue": "bare_except"}
            )
            return

        if isinstance(node.type, ast.Name) and node.type.id == "Exception":
            if self._body_is_pass(node.body):
                self.report(
                    "exception_handling",
                    "`except Exception` with pass swallows errors; handle or log them",
                    lineno, col, end_lineno, end_col,
                    {"issue": "swallowed_exception", "exceptionType": "Exception"}
                )

    @staticmethod
    def _body_is_pass(body: List[ast.stmt]) -> bool:
        if not body:
            return True
        return all(isinstance(stmt, ast.Pass) for stmt in body)


# ---------------------------------------------------------------------------
# Dead Code Detection (v12.10.0)
# ---------------------------------------------------------------------------

# Query types for dead code detection
DEAD_CODE_QUERY_TYPES = {
    "unused_import",
    "unused_function",
    "unused_class",
    "unused_variable",
    "unused_parameter",
    "type_only_import",
}

# Dynamic patterns that reduce confidence
DYNAMIC_PATTERNS = {
    "getattr", "setattr", "delattr", "hasattr",
    "__getattr__", "__setattr__", "__delattr__",
    "__dict__", "__import__",
    "globals", "locals",
    "exec", "eval",
    "importlib.import_module",
}

# Dunder methods that are implicitly used
DUNDER_METHODS = {
    "__init__", "__new__", "__del__",
    "__str__", "__repr__", "__bytes__",
    "__hash__", "__eq__", "__ne__", "__lt__", "__le__", "__gt__", "__ge__",
    "__bool__", "__len__", "__iter__", "__next__", "__contains__",
    "__getitem__", "__setitem__", "__delitem__",
    "__call__", "__enter__", "__exit__", "__aenter__", "__aexit__",
    "__add__", "__sub__", "__mul__", "__truediv__", "__floordiv__",
    "__mod__", "__pow__", "__and__", "__or__", "__xor__",
    "__radd__", "__rsub__", "__rmul__", "__rtruediv__",
    "__iadd__", "__isub__", "__imul__", "__itruediv__",
    "__neg__", "__pos__", "__abs__", "__invert__",
    "__int__", "__float__", "__complex__", "__index__",
    "__await__", "__aiter__", "__anext__",
    "__get__", "__set__", "__delete__", "__set_name__",
    "__init_subclass__", "__class_getitem__",
    "__slots__", "__match_args__",
}


@dataclass
class SymbolInfo:
    """Information about a symbol definition."""
    name: str
    kind: str  # 'import', 'function', 'class', 'variable', 'parameter', 'method'
    line: int
    column: int
    end_line: Optional[int]
    end_column: Optional[int]
    is_private: bool
    is_dunder: bool
    decorators: List[str]
    parent_class: Optional[str]
    is_exported: bool  # In __all__


@dataclass
class UsageInfo:
    """Information about a symbol usage."""
    name: str
    line: int
    column: int
    context: str  # 'value', 'type', 'decorator', 'import', 'attribute'
    is_self_reference: bool


class SymbolExtractor(ast.NodeVisitor):
    """Extract all symbol definitions from Python source."""

    def __init__(self, all_exports: Set[str]) -> None:
        self.symbols: List[SymbolInfo] = []
        self.imports: List[SymbolInfo] = []
        self._class_stack: List[str] = []
        self._all_exports = all_exports

    def _get_decorator_name(self, node: ast.expr) -> str:
        """Get the name of a decorator."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return node.attr
        elif isinstance(node, ast.Call):
            return self._get_decorator_name(node.func)
        return "<unknown>"

    def _is_private(self, name: str) -> bool:
        """Check if name is private (starts with _ but not __)."""
        return name.startswith('_') and not name.startswith('__')

    def _is_dunder(self, name: str) -> bool:
        """Check if name is a dunder method."""
        return name.startswith('__') and name.endswith('__')

    def _is_exported(self, name: str) -> bool:
        """Check if name is in __all__ or is public."""
        if self._all_exports:
            return name in self._all_exports
        return not name.startswith('_')

    def visit_Import(self, node: ast.Import) -> Any:
        for alias in node.names:
            name = alias.asname or alias.name.split('.')[0]
            self.imports.append(SymbolInfo(
                name=name,
                kind='import',
                line=node.lineno,
                column=node.col_offset,
                end_line=getattr(node, 'end_lineno', None),
                end_column=getattr(node, 'end_col_offset', None),
                is_private=self._is_private(name),
                is_dunder=False,
                decorators=[],
                parent_class=None,
                is_exported=self._is_exported(name),
            ))
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> Any:
        for alias in node.names:
            if alias.name == '*':
                continue  # Skip star imports
            name = alias.asname or alias.name
            self.imports.append(SymbolInfo(
                name=name,
                kind='import',
                line=node.lineno,
                column=node.col_offset,
                end_line=getattr(node, 'end_lineno', None),
                end_column=getattr(node, 'end_col_offset', None),
                is_private=self._is_private(name),
                is_dunder=False,
                decorators=[],
                parent_class=None,
                is_exported=self._is_exported(name),
            ))
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self._handle_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        self._handle_function(node)

    def _handle_function(self, node: Any) -> None:
        decorators = [self._get_decorator_name(d) for d in node.decorator_list]
        parent_class = self._class_stack[-1] if self._class_stack else None
        kind = 'method' if parent_class else 'function'

        self.symbols.append(SymbolInfo(
            name=node.name,
            kind=kind,
            line=node.lineno,
            column=node.col_offset,
            end_line=getattr(node, 'end_lineno', None),
            end_column=getattr(node, 'end_col_offset', None),
            is_private=self._is_private(node.name),
            is_dunder=self._is_dunder(node.name),
            decorators=decorators,
            parent_class=parent_class,
            is_exported=self._is_exported(node.name),
        ))

        # Extract parameters (only for non-method functions or first param is not self/cls)
        for arg in node.args.args:
            if arg.arg in ('self', 'cls'):
                continue
            self.symbols.append(SymbolInfo(
                name=arg.arg,
                kind='parameter',
                line=arg.lineno if hasattr(arg, 'lineno') else node.lineno,
                column=arg.col_offset if hasattr(arg, 'col_offset') else node.col_offset,
                end_line=getattr(arg, 'end_lineno', None),
                end_column=getattr(arg, 'end_col_offset', None),
                is_private=self._is_private(arg.arg),
                is_dunder=False,
                decorators=[],
                parent_class=None,
                is_exported=False,
            ))

        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        decorators = [self._get_decorator_name(d) for d in node.decorator_list]

        self.symbols.append(SymbolInfo(
            name=node.name,
            kind='class',
            line=node.lineno,
            column=node.col_offset,
            end_line=getattr(node, 'end_lineno', None),
            end_column=getattr(node, 'end_col_offset', None),
            is_private=self._is_private(node.name),
            is_dunder=False,
            decorators=decorators,
            parent_class=None,
            is_exported=self._is_exported(node.name),
        ))

        # Visit class body with class context
        self._class_stack.append(node.name)
        self.generic_visit(node)
        self._class_stack.pop()

    def visit_Assign(self, node: ast.Assign) -> Any:
        # Only track module-level assignments
        if self._class_stack:
            self.generic_visit(node)
            return

        for target in node.targets:
            if isinstance(target, ast.Name):
                self.symbols.append(SymbolInfo(
                    name=target.id,
                    kind='variable',
                    line=node.lineno,
                    column=node.col_offset,
                    end_line=getattr(node, 'end_lineno', None),
                    end_column=getattr(node, 'end_col_offset', None),
                    is_private=self._is_private(target.id),
                    is_dunder=self._is_dunder(target.id),
                    decorators=[],
                    parent_class=None,
                    is_exported=self._is_exported(target.id),
                ))
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> Any:
        # Only track module-level assignments
        if self._class_stack:
            self.generic_visit(node)
            return

        if isinstance(node.target, ast.Name):
            self.symbols.append(SymbolInfo(
                name=node.target.id,
                kind='variable',
                line=node.lineno,
                column=node.col_offset,
                end_line=getattr(node, 'end_lineno', None),
                end_column=getattr(node, 'end_col_offset', None),
                is_private=self._is_private(node.target.id),
                is_dunder=self._is_dunder(node.target.id),
                decorators=[],
                parent_class=None,
                is_exported=self._is_exported(node.target.id),
            ))
        self.generic_visit(node)


class UsageCollector(ast.NodeVisitor):
    """Collect all symbol usages in Python source."""

    def __init__(self, defined_names: Set[str]) -> None:
        self.defined_names = defined_names
        self.usages: Dict[str, List[UsageInfo]] = {}
        self._type_annotation_depth: int = 0
        self._definition_lines: Dict[str, int] = {}  # name -> definition line

    def set_definition_lines(self, symbols: List[SymbolInfo]) -> None:
        """Set definition lines for self-reference detection."""
        for sym in symbols:
            self._definition_lines[sym.name] = sym.line

    def _add_usage(self, name: str, line: int, column: int, context: str) -> None:
        if name not in self.defined_names:
            return

        is_self_ref = self._definition_lines.get(name) == line
        usage = UsageInfo(
            name=name,
            line=line,
            column=column,
            context=context,
            is_self_reference=is_self_ref,
        )
        self.usages.setdefault(name, []).append(usage)

    def visit_Name(self, node: ast.Name) -> Any:
        if isinstance(node.ctx, ast.Load):
            context = 'type' if self._type_annotation_depth > 0 else 'value'
            self._add_usage(node.id, node.lineno, node.col_offset, context)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        # Track attribute access for potential method calls
        if isinstance(node.ctx, ast.Load) and isinstance(node.value, ast.Name):
            self._add_usage(node.value.id, node.lineno, node.col_offset, 'attribute')
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self._handle_function_annotations(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        self._handle_function_annotations(node)
        self.generic_visit(node)

    def _handle_function_annotations(self, node: Any) -> None:
        # Track return type annotation
        if node.returns:
            self._type_annotation_depth += 1
            self.visit(node.returns)
            self._type_annotation_depth -= 1

        # Track parameter annotations
        for arg in node.args.args + node.args.posonlyargs + node.args.kwonlyargs:
            if arg.annotation:
                self._type_annotation_depth += 1
                self.visit(arg.annotation)
                self._type_annotation_depth -= 1

    def visit_AnnAssign(self, node: ast.AnnAssign) -> Any:
        # Track annotation
        self._type_annotation_depth += 1
        self.visit(node.annotation)
        self._type_annotation_depth -= 1

        # Track value
        if node.value:
            self.visit(node.value)

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        # Track base classes
        for base in node.bases:
            self.visit(base)

        # Track decorators
        for decorator in node.decorator_list:
            self._add_usage_from_expr(decorator, 'decorator')

        self.generic_visit(node)

    def _add_usage_from_expr(self, node: ast.expr, context: str) -> None:
        """Add usage from an expression node."""
        if isinstance(node, ast.Name):
            self._add_usage(node.id, node.lineno, node.col_offset, context)
        elif isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name):
                self._add_usage(node.value.id, node.lineno, node.col_offset, context)
        elif isinstance(node, ast.Call):
            self._add_usage_from_expr(node.func, context)


class DynamicPatternDetector(ast.NodeVisitor):
    """Detect dynamic patterns that reduce confidence in dead code detection."""

    def __init__(self) -> None:
        self.patterns_found: List[Dict[str, Any]] = []
        self.has_type_checking_block: bool = False

    def visit_Call(self, node: ast.Call) -> Any:
        func_name = _call_qualname(node.func)
        if func_name in DYNAMIC_PATTERNS:
            self.patterns_found.append({
                "pattern": func_name,
                "line": node.lineno,
                "confidence_penalty": 0.3 if func_name in ("getattr", "setattr") else 0.2,
            })
        self.generic_visit(node)

    def visit_If(self, node: ast.If) -> Any:
        # Detect TYPE_CHECKING blocks
        if isinstance(node.test, ast.Name) and node.test.id == 'TYPE_CHECKING':
            self.has_type_checking_block = True
        elif isinstance(node.test, ast.Attribute):
            if node.test.attr == 'TYPE_CHECKING':
                self.has_type_checking_block = True
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> Any:
        # Detect __dict__ access
        if isinstance(node.value, ast.Attribute) and node.value.attr == '__dict__':
            self.patterns_found.append({
                "pattern": "__dict__",
                "line": node.lineno,
                "confidence_penalty": 0.25,
            })
        self.generic_visit(node)


def _extract_all_exports(tree: ast.AST) -> Set[str]:
    """Extract names from __all__ if present."""
    exports: Set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == '__all__':
                    if isinstance(node.value, (ast.List, ast.Tuple)):
                        for elt in node.value.elts:
                            if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                exports.add(elt.value)
    return exports


class DeadCodeDetector:
    """Detect unused symbols in Python source."""

    def __init__(self, source_lines: List[str], tree: ast.AST) -> None:
        self.source_lines = source_lines
        self.tree = tree
        self.findings: List[Finding] = []

        # Extract __all__ exports
        self.all_exports = _extract_all_exports(tree)

        # Extract symbols
        self.extractor = SymbolExtractor(self.all_exports)
        self.extractor.visit(tree)

        # Collect usages
        all_names = {s.name for s in self.extractor.symbols}
        all_names.update(s.name for s in self.extractor.imports)
        self.collector = UsageCollector(all_names)
        self.collector.set_definition_lines(
            self.extractor.symbols + self.extractor.imports
        )
        self.collector.visit(tree)

        # Detect dynamic patterns
        self.dynamic_detector = DynamicPatternDetector()
        self.dynamic_detector.visit(tree)

    def run(self, query_types: Set[str]) -> None:
        """Run dead code detection for specified query types."""
        # Analyze imports
        if "unused_import" in query_types or "type_only_import" in query_types:
            self._analyze_imports(query_types)

        # Analyze symbols
        if any(q in query_types for q in ("unused_function", "unused_class", "unused_variable")):
            self._analyze_symbols(query_types)

    def _analyze_imports(self, query_types: Set[str]) -> None:
        for imp in self.extractor.imports:
            usages = self.collector.usages.get(imp.name, [])
            external_usages = [u for u in usages if not u.is_self_reference]

            if not external_usages and "unused_import" in query_types:
                confidence = self._calculate_confidence(imp, external_usages)
                if confidence >= 0.5:
                    self._report_finding(imp, "unused_import", confidence)
            elif external_usages and "type_only_import" in query_types:
                # Check if only used in type annotations
                type_only = all(u.context == 'type' for u in external_usages)
                if type_only and not self.dynamic_detector.has_type_checking_block:
                    confidence = 0.85
                    self._report_finding(imp, "type_only_import", confidence,
                                        "Import is only used in type annotations")

    def _analyze_symbols(self, query_types: Set[str]) -> None:
        for symbol in self.extractor.symbols:
            # Skip parameters for now (handled separately)
            if symbol.kind == 'parameter':
                continue

            # Skip dunder methods - they're implicitly used
            if symbol.is_dunder and symbol.name in DUNDER_METHODS:
                continue

            # Skip if exported via __all__
            if symbol.is_exported and self.all_exports:
                continue

            usages = self.collector.usages.get(symbol.name, [])
            external_usages = [u for u in usages if not u.is_self_reference]

            query_type = f"unused_{symbol.kind}"
            if symbol.kind == 'method':
                query_type = "unused_function"  # Methods are reported as functions

            if query_type not in query_types:
                continue

            if not external_usages:
                confidence = self._calculate_confidence(symbol, external_usages)
                if confidence >= 0.5:
                    self._report_finding(symbol, query_type, confidence)

    def _calculate_confidence(self, symbol: SymbolInfo, usages: List[UsageInfo]) -> float:
        """Calculate confidence score with penalties."""
        confidence = 0.9

        # Reduce confidence for dynamic patterns
        if self.dynamic_detector.patterns_found:
            max_penalty = max(p["confidence_penalty"] for p in self.dynamic_detector.patterns_found)
            confidence -= max_penalty

        # Reduce confidence for private symbols (may be intentional)
        if symbol.is_private:
            confidence -= 0.05

        # Reduce confidence for decorated symbols
        if symbol.decorators:
            # Some decorators mark usage (property, staticmethod, etc.)
            special_decorators = {'property', 'staticmethod', 'classmethod', 'abstractmethod',
                                 'cached_property', 'lru_cache', 'wraps', 'pytest.fixture'}
            if any(d in special_decorators for d in symbol.decorators):
                confidence -= 0.3
            else:
                confidence -= 0.1

        # Reduce confidence for methods (may be called via super or inheritance)
        if symbol.kind == 'method':
            confidence -= 0.15

        return max(0.0, confidence)

    def _report_finding(self, symbol: SymbolInfo, finding_type: str, confidence: float,
                       custom_message: Optional[str] = None) -> None:
        """Report a dead code finding."""
        context = _get_source_line(self.source_lines, symbol.line)

        if custom_message:
            message = custom_message
        else:
            kind_display = symbol.kind.replace('_', ' ')
            message = f"Unused {kind_display} `{symbol.name}` has no external usages"

        self.findings.append(Finding(
            type=finding_type,
            line=symbol.line,
            column=symbol.column,
            endLine=symbol.end_line,
            endColumn=symbol.end_column,
            message=message,
            context=context,
            metadata={
                "symbolName": symbol.name,
                "symbolKind": symbol.kind,
                "confidence": round(confidence, 2),
                "isPrivate": symbol.is_private,
                "isExported": symbol.is_exported,
                "decorators": symbol.decorators,
            }
        ))

    def get_symbols_info(self) -> List[Dict[str, Any]]:
        """Return extracted symbols for external use."""
        symbols = []
        for s in self.extractor.symbols + self.extractor.imports:
            symbols.append({
                "name": s.name,
                "kind": s.kind,
                "line": s.line,
                "column": s.column,
                "isPrivate": s.is_private,
                "isDunder": s.is_dunder,
                "isExported": s.is_exported,
                "decorators": s.decorators,
                "parentClass": s.parent_class,
            })
        return symbols

    def get_usages_info(self) -> Dict[str, List[Dict[str, Any]]]:
        """Return collected usages for external use."""
        result: Dict[str, List[Dict[str, Any]]] = {}
        for name, usages in self.collector.usages.items():
            result[name] = [
                {
                    "line": u.line,
                    "column": u.column,
                    "context": u.context,
                    "isSelfReference": u.is_self_reference,
                }
                for u in usages
            ]
        return result

    def get_dynamic_patterns(self) -> List[Dict[str, Any]]:
        """Return detected dynamic patterns."""
        return self.dynamic_detector.patterns_found


# ---------------------------------------------------------------------------
# Bridge execution
# ---------------------------------------------------------------------------

def run_analysis(source: str, queries: List[Dict[str, Any]], include_symbols: bool = False) -> Dict[str, Any]:
    """Run requested detectors and return structured results."""
    source_lines = source.split('\n')
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}"

    # Parse query types
    requested_types: Set[str] = set()
    for query in queries:
        if isinstance(query, dict) and "type" in query:
            requested_types.add(query["type"])

    # Default to all if none specified
    if not requested_types:
        requested_types = {
            "resource_leak",
            "missing_context_manager",
            "async_resource_leak",
            "executor_leak",
            "exception_handling",
        }

    # Parse AST
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return {
            "findings": [],
            "parseErrors": [{
                "message": str(exc),
                "line": exc.lineno,
                "column": exc.offset
            }],
            "pythonVersion": python_version
        }

    # Analyze resource usage
    analyzer = ResourceUsageAnalyzer()
    analyzer.visit(tree)

    # Run detectors
    all_findings: List[Finding] = []

    if "resource_leak" in requested_types:
        detector = ResourceLeakDetector(analyzer, source_lines)
        detector.run()
        all_findings.extend(detector.findings)

    if "missing_context_manager" in requested_types:
        detector = MissingContextManagerDetector(analyzer, source_lines)
        detector.run()
        all_findings.extend(detector.findings)

    if "async_resource_leak" in requested_types:
        detector = AsyncResourceLeakDetector(analyzer, source_lines)
        detector.run()
        all_findings.extend(detector.findings)

    if "executor_leak" in requested_types:
        detector = ExecutorLeakDetector(analyzer, source_lines)
        detector.run()
        all_findings.extend(detector.findings)

    if "exception_handling" in requested_types:
        detector = ExceptionHandlingDetector(analyzer, source_lines, tree)
        detector.run()
        all_findings.extend(detector.findings)

    # Dead code detection (v12.10.0)
    dead_code_queries = requested_types & DEAD_CODE_QUERY_TYPES
    dead_code_detector: Optional[DeadCodeDetector] = None

    if dead_code_queries:
        dead_code_detector = DeadCodeDetector(source_lines, tree)
        dead_code_detector.run(dead_code_queries)
        all_findings.extend(dead_code_detector.findings)

    # Build result
    result: Dict[str, Any] = {
        "findings": [asdict(f) for f in all_findings],
        "parseErrors": [],
        "pythonVersion": python_version
    }

    # Include symbols if requested (for external semantic analysis)
    if include_symbols and dead_code_detector:
        result["symbols"] = dead_code_detector.get_symbols_info()
        result["usages"] = dead_code_detector.get_usages_info()
        result["dynamicPatterns"] = dead_code_detector.get_dynamic_patterns()

    return result


def main() -> None:
    """Main entry point - reads JSON from stdin, outputs JSON to stdout."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({
            "findings": [],
            "parseErrors": [{"message": f"Invalid JSON input: {e}", "line": None, "column": None}],
            "pythonVersion": f"{sys.version_info.major}.{sys.version_info.minor}"
        }, sys.stdout)
        return

    # Extract source content (support multiple key names)
    source = (
        payload.get("content")
        or payload.get("file_content")
        or payload.get("code")
        or payload.get("source")
        or ""
    )

    # Extract queries
    queries = payload.get("queries") or payload.get("query_types") or []

    # Check if symbols should be included in output
    include_symbols = payload.get("include_symbols", False)

    # Run analysis
    result = run_analysis(
        str(source),
        queries if isinstance(queries, list) else [],
        include_symbols=include_symbols
    )
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
