// sample2.res - Advanced ReScript features: variants, pattern matching, recursion

// Variant types
type color =
  | Red
  | Green
  | Blue
  | RGB(int, int, int)

type option_<'a> =
  | None
  | Some('a)

type result<'a, 'e> =
  | Ok('a)
  | Error('e)

// Recursive type
type tree<'a> =
  | Empty
  | Node('a, tree<'a>, tree<'a>)

// List type
type rec list<'a> =
  | Nil
  | Cons('a, list<'a>)

// Pattern matching functions
let colorToString = color =>
  switch color {
  | Red => "red"
  | Green => "green"
  | Blue => "blue"
  | RGB(r, g, b) => `rgb(${r->Belt.Int.toString}, ${g->Belt.Int.toString}, ${b->Belt.Int.toString})`
  }

let optionMap = (opt, f) =>
  switch opt {
  | None => None
  | Some(x) => Some(f(x))
  }

let resultMap = (res, f) =>
  switch res {
  | Ok(x) => Ok(f(x))
  | Error(e) => Error(e)
  }

// Recursive functions
let rec factorial = n =>
  if n <= 1 {
    1
  } else {
    n * factorial(n - 1)
  }

let rec fibonacci = n =>
  switch n {
  | 0 => 0
  | 1 => 1
  | n => fibonacci(n - 1) + fibonacci(n - 2)
  }

let rec sum = lst =>
  switch lst {
  | Nil => 0
  | Cons(head, tail) => head + sum(tail)
  }

let rec map = (lst, f) =>
  switch lst {
  | Nil => Nil
  | Cons(head, tail) => Cons(f(head), map(tail, f))
  }

// Tree operations
let rec treeSize = tree =>
  switch tree {
  | Empty => 0
  | Node(_, left, right) => 1 + treeSize(left) + treeSize(right)
  }

let rec treeHeight = tree =>
  switch tree {
  | Empty => 0
  | Node(_, left, right) => {
      let leftHeight = treeHeight(left)
      let rightHeight = treeHeight(right)
      1 + Js.Math.max_int(leftHeight, rightHeight)
    }
  }

// Module with variant types
module Status = {
  type t =
    | Pending
    | Active
    | Completed
    | Failed(string)

  let toString = status =>
    switch status {
    | Pending => "Pending"
    | Active => "Active"
    | Completed => "Completed"
    | Failed(msg) => `Failed: ${msg}`
    }

  let isTerminal = status =>
    switch status {
    | Completed | Failed(_) => true
    | Pending | Active => false
    }
}

// Polymorphic variant
type htmlTag = [#div | #span | #p | #h1]

let tagToString = tag =>
  switch tag {
  | #div => "div"
  | #span => "span"
  | #p => "p"
  | #h1 => "h1"
  }

// Module type (interface)
module type Comparable = {
  type t
  let compare: (t, t) => int
  let equal: (t, t) => bool
}

// Module implementing interface
module IntComparable: Comparable with type t = int = {
  type t = int
  let compare = (a, b) => a - b
  let equal = (a, b) => a == b
}

// Functor (parameterized module)
module MakeSet = (C: Comparable) => {
  type t = list<C.t>

  let empty = Nil

  let rec contains = (set, elem) =>
    switch set {
    | Nil => false
    | Cons(head, tail) =>
      if C.equal(head, elem) {
        true
      } else {
        contains(tail, elem)
      }
    }
}

// Constants
let maxInt = 2147483647
let minInt = -2147483648
let defaultTimeout = 5000
