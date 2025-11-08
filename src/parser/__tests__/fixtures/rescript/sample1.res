// sample1.res - Basic ReScript features: types, functions, modules

// Simple type definitions
type point = {
  x: float,
  y: float,
}

type circle = {
  center: point,
  radius: float,
}

// Constants
let pi = 3.14159
let maxValue = 1000.0

// Simple functions
let add = (a, b) => a + b

let subtract = (a, b) => a - b

let multiply = (a, b) => a *. b

// Function with type annotation
let distanceFromOrigin = (p: point): float => {
  let {x, y} = p
  Js.Math.sqrt(x *. x +. y *. y)
}

let circleArea = (c: circle): float => {
  let {radius} = c
  pi *. radius *. radius
}

// Module definition
module Math = {
  let square = x => x * x

  let cube = x => x * x * x

  let abs = x =>
    if x < 0 {
      -x
    } else {
      x
    }

  let max = (a, b) =>
    if a > b {
      a
    } else {
      b
    }
}

// Nested module
module Geometry = {
  type shape =
    | Circle(float)
    | Rectangle(float, float)
    | Triangle(float, float, float)

  let area = shape =>
    switch shape {
    | Circle(r) => pi *. r *. r
    | Rectangle(w, h) => w *. h
    | Triangle(a, b, c) => {
        let s = (a +. b +. c) /. 2.0
        Js.Math.sqrt(s *. (s -. a) *. (s -. b) *. (s -. c))
      }
    }
}

// Type aliases
type coordinate = (float, float)
type matrix = array<array<float>>

// Record type with functions
type calculator = {
  add: (int, int) => int,
  subtract: (int, int) => int,
}

let makeCalculator = () => {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
}
