// sample3.res - Modern ReScript: external bindings, JS interop, React

// External JavaScript bindings
@val external setTimeout: (unit => unit, int) => int = "setTimeout"
@val external clearTimeout: int => unit = "clearTimeout"
@val external console: {..} = "console"

// Module bindings
@module("path") external join: (string, string) => string = "join"
@module("fs") external readFileSync: (string, string) => string = "readFileSync"

// Node.js process bindings
@scope("process") @val external env: Js.Dict.t<string> = "env"
@scope("process") @val external argv: array<string> = "argv"

// Browser APIs
@val @scope("window") external localStorage: {..} = "localStorage"
@send external getElementById: (Dom.document, string) => option<Dom.element> = "getElementById"

// Custom external with getter
@get external innerHTML: Dom.element => string = "innerHTML"
@set external setInnerHTML: (Dom.element, string) => unit = "innerHTML"

// Type definitions for JS interop
type user = {
  id: int,
  name: string,
  email: string,
  @as("is_active") isActive: bool,
}

type apiResponse<'data> = {
  success: bool,
  data: option<'data>,
  error: option<string>,
}

// External fetch API
@val
external fetch: string => promise<Response.t> = "fetch"

// Async/Promise functions
let fetchUser = async userId => {
  let url = `https://api.example.com/users/${userId->Belt.Int.toString}`
  let response = await fetch(url)
  let json = await response->Response.json
  json
}

let getUserData = userId => {
  fetchUser(userId)->Promise.then(data => {
    Js.log("User data received")
    Promise.resolve(data)
  })
}

// React component types
module Button = {
  @react.component
  let make = (~label: string, ~onClick: unit => unit) => {
    <button onClick={_ => onClick()}> {React.string(label)} </button>
  }
}

module UserCard = {
  @react.component
  let make = (~user: user) => {
    <div className="user-card">
      <h3> {React.string(user.name)} </h3>
      <p> {React.string(user.email)} </p>
      {user.isActive ? <span> {React.string("Active")} </span> : React.null}
    </div>
  }
}

// Hooks
module Counter = {
  @react.component
  let make = () => {
    let (count, setCount) = React.useState(() => 0)

    <div>
      <p> {React.string(`Count: ${count->Belt.Int.toString}`)} </p>
      <button onClick={_ => setCount(_ => count + 1)}>
        {React.string("Increment")}
      </button>
    </div>
  }
}

// Custom hooks
let useLocalStorage = (key: string, initialValue: 'a) => {
  let (storedValue, setStoredValue) = React.useState(() => initialValue)

  let setValue = newValue => {
    setStoredValue(_ => newValue)
  }

  (storedValue, setValue)
}

// Module with constants and utilities
module Constants = {
  let apiBaseUrl = "https://api.example.com"
  let defaultTimeout = 30000
  let maxRetries = 3
  let version = "1.0.0"
}

module Utils = {
  let debounce = (fn, delay) => {
    let timeoutId = ref(None)

    value => {
      switch timeoutId.contents {
      | Some(id) => clearTimeout(id)
      | None => ()
      }

      timeoutId := Some(setTimeout(() => fn(value), delay))
    }
  }

  let throttle = (fn, limit) => {
    let lastRun = ref(0.0)

    value => {
      let now = Js.Date.now()
      if now -. lastRun.contents >= limit {
        lastRun := now
        fn(value)
      }
    }
  }
}

// Decorator-style attributes
@deprecated("Use newFunction instead")
let oldFunction = x => x + 1

@warning("-27")  // Suppress unused variable warning
let helperFunction = (a, _b) => a

// Pipe operator usage
let processData = data =>
  data
  ->Belt.Array.map(x => x * 2)
  ->Belt.Array.keep(x => x > 10)
  ->Belt.Array.reduce(0, (acc, x) => acc + x)

// Type inference with generics
let identity = x => x

let compose = (f, g) => x => f(g(x))

let pipe = (x, f) => f(x)

// Module with type and functions
module Result = {
  type t<'ok, 'err> = Ok('ok) | Error('err)

  let map = (result, f) =>
    switch result {
    | Ok(value) => Ok(f(value))
    | Error(e) => Error(e)
    }

  let flatMap = (result, f) =>
    switch result {
    | Ok(value) => f(value)
    | Error(e) => Error(e)
    }

  let getWithDefault = (result, default) =>
    switch result {
    | Ok(value) => value
    | Error(_) => default
    }
}

// Constants
let maxConnections = 100
let poolSize = 10
let cacheTimeout = 300000
