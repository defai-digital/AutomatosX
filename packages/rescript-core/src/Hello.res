// Hello.res - Simple ReScript module to test interop
// This module demonstrates basic ReScript → TypeScript integration

// Simple greeting function
@genType
let greet = (name: string): string => {
  `Hello, ${name}! Welcome to AutomatosX v2 with ReScript.`
}

// Function to demonstrate ReScript's type safety
@genType
let add = (a: int, b: int): int => {
  a + b
}

// Function to demonstrate option type (ReScript's null safety)
@genType
let getGreetingOrDefault = (name: option<string>): string => {
  switch name {
  | Some(n) => greet(n)
  | None => "Hello, Guest! Welcome to AutomatosX v2."
  }
}

// Record type to demonstrate complex data structures
@genType
type person = {
  name: string,
  age: int,
}

@genType
let greetPerson = (person: person): string => {
  `Hello, ${person.name}! You are ${Belt.Int.toString(person.age)} years old.`
}

// Module-level message
@genType
let welcomeMessage = "AutomatosX v2 - ReScript Core Runtime Initialized"
