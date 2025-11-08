// Sprint 1 Day 13: Rule Parser Module
// Parser for rule syntax (condition → action format)
//
// Provides:
// - Tokenization of rule expressions
// - Parsing of condition → action rules
// - Error reporting with helpful messages
// - Support for complex logical expressions
//
// Syntax:
//   RULE := "when" CONDITION "then" ACTION ("," ACTION)*
//   CONDITION := COMPARISON | LOGICAL_OP | "(" CONDITION ")" | "NOT" CONDITION | "ALWAYS" | "NEVER"
//   COMPARISON := VALUE COMPARE_OP VALUE
//   LOGICAL_OP := CONDITION "AND" CONDITION | CONDITION "OR" CONDITION
//   ACTION := "ExecuteEffect" | "SetContext" | "TransitionTo" | "EmitEvent" | "NoAction"

open Belt

// Token types for lexer
type token =
  | When
  | Then
  | And
  | Or
  | Not
  | Always
  | Never
  | Equals
  | NotEquals
  | GreaterThan
  | LessThan
  | GreaterThanOrEqual
  | LessThanOrEqual
  | Contains
  | Matches
  | LeftParen
  | RightParen
  | Comma
  | StringLiteral(string)
  | IntLiteral(int)
  | FloatLiteral(float)
  | BoolLiteral(bool)
  | Identifier(string)
  | ContextRef(string) // $variable
  | EOF

// Parse error type
type parseError = {
  message: string,
  position: option<int>,
  token: option<string>,
}

// Parse result
type parseResult<'a> =
  | Success('a)
  | Failure(parseError)

module Tokenizer = {
  // Simple tokenizer (lexer) for rule expressions
  type tokenizeState = {
    input: string,
    position: int,
    tokens: array<token>,
  }

  let isWhitespace = (c: string): bool => {
    c === " " || c === "\t" || c === "\n" || c === "\r"
  }

  let isDigit = (c: string): bool => {
    let code = Js.String2.charCodeAt(c, 0)
    code >= 48.0 && code <= 57.0 // '0' to '9'
  }

  let isAlpha = (c: string): bool => {
    let code = Js.String2.charCodeAt(c, 0)
    (code >= 65.0 && code <= 90.0) || (code >= 97.0 && code <= 122.0) // 'A'-'Z' or 'a'-'z'
  }

  let isAlphaNumeric = (c: string): bool => {
    isAlpha(c) || isDigit(c) || c === "_"
  }

  // Read a number (int or float)
  let readNumber = (input: string, start: int): (token, int) => {
    let rec readDigits = (pos: int, acc: string): (string, int) => {
      if pos >= String.length(input) {
        (acc, pos)
      } else {
        let c = Js.String2.charAt(input, pos)
        if isDigit(c) {
          readDigits(pos + 1, acc ++ c)
        } else {
          (acc, pos)
        }
      }
    }

    let (intPart, afterInt) = readDigits(start, "")

    // Check for decimal point
    if afterInt < String.length(input) && Js.String2.charAt(input, afterInt) === "." {
      let (fracPart, afterFrac) = readDigits(afterInt + 1, "")
      let floatStr = intPart ++ "." ++ fracPart
      (FloatLiteral(Float.fromString(floatStr)->Option.getWithDefault(0.0)), afterFrac)
    } else {
      (IntLiteral(Int.fromString(intPart)->Option.getWithDefault(0)), afterInt)
    }
  }

  // Read an identifier or keyword
  let readIdentifier = (input: string, start: int): (token, int) => {
    let rec readChars = (pos: int, acc: string): (string, int) => {
      if pos >= String.length(input) {
        (acc, pos)
      } else {
        let c = Js.String2.charAt(input, pos)
        if isAlphaNumeric(c) {
          readChars(pos + 1, acc ++ c)
        } else {
          (acc, pos)
        }
      }
    }

    let (ident, endPos) = readChars(start, "")

    // Check if it's a keyword
    let tok = switch ident {
    | "when" => When
    | "then" => Then
    | "AND" => And
    | "OR" => Or
    | "NOT" => Not
    | "ALWAYS" => Always
    | "NEVER" => Never
    | "contains" => Contains
    | "matches" => Matches
    | "true" => BoolLiteral(true)
    | "false" => BoolLiteral(false)
    | _ => Identifier(ident)
    }

    (tok, endPos)
  }

  // Read a string literal
  let readString = (input: string, start: int): (token, int) => {
    let rec readChars = (pos: int, acc: string): (string, int) => {
      if pos >= String.length(input) {
        (acc, pos) // Unclosed string, return what we have
      } else {
        let c = Js.String2.charAt(input, pos)
        if c === "\"" || c === "'" {
          (acc, pos + 1) // Found closing quote
        } else {
          readChars(pos + 1, acc ++ c)
        }
      }
    }

    let (str, endPos) = readChars(start + 1, "") // Skip opening quote
    (StringLiteral(str), endPos)
  }

  // Tokenize input string
  let tokenize = (input: string): parseResult<array<token>> => {
    let rec tokenizeLoop = (pos: int, tokens: array<token>): parseResult<array<token>> => {
      if pos >= String.length(input) {
        Success(tokens->Js.Array2.concat([EOF]))
      } else {
        let c = Js.String2.charAt(input, pos)

        // Skip whitespace
        if isWhitespace(c) {
          tokenizeLoop(pos + 1, tokens)
        } else if c === "(" {
          tokenizeLoop(pos + 1, tokens->Js.Array2.concat([LeftParen]))
        } else if c === ")" {
          tokenizeLoop(pos + 1, tokens->Js.Array2.concat([RightParen]))
        } else if c === "," {
          tokenizeLoop(pos + 1, tokens->Js.Array2.concat([Comma]))
        } else if c === "$" {
          // Context reference
          let (ident, endPos) = readIdentifier(input, pos + 1)
          switch ident {
          | Identifier(name) => tokenizeLoop(endPos, tokens->Js.Array2.concat([ContextRef(name)]))
          | _ =>
            Failure({
              message: "Invalid context reference after $",
              position: Some(pos),
              token: Some("$"),
            })
          }
        } else if c === "=" {
          // Check for ==
          if pos + 1 < String.length(input) && Js.String2.charAt(input, pos + 1) === "=" {
            tokenizeLoop(pos + 2, tokens->Js.Array2.concat([Equals]))
          } else {
            Failure({
              message: "Expected '==' for equality",
              position: Some(pos),
              token: Some("="),
            })
          }
        } else if c === "!" {
          // Check for !=
          if pos + 1 < String.length(input) && Js.String2.charAt(input, pos + 1) === "=" {
            tokenizeLoop(pos + 2, tokens->Js.Array2.concat([NotEquals]))
          } else {
            Failure({
              message: "Expected '!=' for inequality",
              position: Some(pos),
              token: Some("!"),
            })
          }
        } else if c === ">" {
          // Check for >=
          if pos + 1 < String.length(input) && Js.String2.charAt(input, pos + 1) === "=" {
            tokenizeLoop(pos + 2, tokens->Js.Array2.concat([GreaterThanOrEqual]))
          } else {
            tokenizeLoop(pos + 1, tokens->Js.Array2.concat([GreaterThan]))
          }
        } else if c === "<" {
          // Check for <=
          if pos + 1 < String.length(input) && Js.String2.charAt(input, pos + 1) === "=" {
            tokenizeLoop(pos + 2, tokens->Js.Array2.concat([LessThanOrEqual]))
          } else {
            tokenizeLoop(pos + 1, tokens->Js.Array2.concat([LessThan]))
          }
        } else if c === "\"" || c === "'" {
          let (tok, endPos) = readString(input, pos)
          tokenizeLoop(endPos, tokens->Js.Array2.concat([tok]))
        } else if isDigit(c) {
          let (tok, endPos) = readNumber(input, pos)
          tokenizeLoop(endPos, tokens->Js.Array2.concat([tok]))
        } else if isAlpha(c) {
          let (tok, endPos) = readIdentifier(input, pos)
          tokenizeLoop(endPos, tokens->Js.Array2.concat([tok]))
        } else {
          Failure({
            message: `Unexpected character: ${c}`,
            position: Some(pos),
            token: Some(c),
          })
        }
      }
    }

    tokenizeLoop(0, [])
  }
}

module Parser = {
  // Parser state
  type parserState = {
    tokens: array<token>,
    position: int,
  }

  let peek = (state: parserState): token => {
    state.tokens->Array.get(state.position)->Option.getWithDefault(EOF)
  }

  let advance = (state: parserState): parserState => {
    {...state, position: state.position + 1}
  }

  let expect = (state: parserState, expected: token): parseResult<parserState> => {
    let current = peek(state)
    if current === expected {
      Success(advance(state))
    } else {
      Failure({
        message: `Expected ${expected->Obj.magic}, got ${current->Obj.magic}`,
        position: Some(state.position),
        token: None,
      })
    }
  }

  // Parse a value (literal or context reference)
  let parseValue = (state: parserState): parseResult<(RuleAST.value, parserState)> => {
    let current = peek(state)
    switch current {
    | StringLiteral(s) => Success((RuleAST.StringValue(s), advance(state)))
    | IntLiteral(i) => Success((RuleAST.IntValue(i), advance(state)))
    | FloatLiteral(f) => Success((RuleAST.FloatValue(f), advance(state)))
    | BoolLiteral(b) => Success((RuleAST.BoolValue(b), advance(state)))
    | ContextRef(ref) => Success((RuleAST.ContextRef(ref), advance(state)))
    | _ =>
      Failure({
        message: `Expected value, got ${current->Obj.magic}`,
        position: Some(state.position),
        token: None,
      })
    }
  }

  // Parse comparison operator
  let parseCompareOp = (state: parserState): parseResult<(RuleAST.compareOp, parserState)> => {
    let current = peek(state)
    switch current {
    | Equals => Success((RuleAST.Equal, advance(state)))
    | NotEquals => Success((RuleAST.NotEqual, advance(state)))
    | GreaterThan => Success((RuleAST.GreaterThan, advance(state)))
    | LessThan => Success((RuleAST.LessThan, advance(state)))
    | GreaterThanOrEqual => Success((RuleAST.GreaterThanOrEqual, advance(state)))
    | LessThanOrEqual => Success((RuleAST.LessThanOrEqual, advance(state)))
    | Contains => Success((RuleAST.Contains, advance(state)))
    | Matches => Success((RuleAST.Matches, advance(state)))
    | _ =>
      Failure({
        message: `Expected comparison operator, got ${current->Obj.magic}`,
        position: Some(state.position),
        token: None,
      })
    }
  }

  // Parse a primary condition (comparison, parenthesized, NOT, ALWAYS, NEVER)
  let rec parsePrimaryCondition = (state: parserState): parseResult<(RuleAST.condition, parserState)> => {
    let current = peek(state)
    switch current {
    | Always => Success((RuleAST.Always, advance(state)))
    | Never => Success((RuleAST.Never, advance(state)))
    | Not => {
        let state1 = advance(state)
        switch parsePrimaryCondition(state1) {
        | Success((cond, state2)) => Success((RuleAST.Not(cond), state2))
        | Failure(err) => Failure(err)
        }
      }
    | LeftParen => {
        let state1 = advance(state)
        switch parseCondition(state1) {
        | Success((cond, state2)) =>
          switch expect(state2, RightParen) {
          | Success(state3) => Success((cond, state3))
          | Failure(err) => Failure(err)
          }
        | Failure(err) => Failure(err)
        }
      }
    | _ => {
        // Try to parse comparison
        switch parseValue(state) {
        | Success((left, state1)) =>
          switch parseCompareOp(state1) {
          | Success((op, state2)) =>
            switch parseValue(state2) {
            | Success((right, state3)) => Success((RuleAST.Comparison(left, op, right), state3))
            | Failure(err) => Failure(err)
            }
          | Failure(err) => Failure(err)
          }
        | Failure(err) => Failure(err)
        }
      }
    }
  }

  // Parse condition with AND/OR operators
  and parseCondition = (state: parserState): parseResult<(RuleAST.condition, parserState)> => {
    switch parsePrimaryCondition(state) {
    | Success((left, state1)) => {
        let current = peek(state1)
        switch current {
        | And => {
            let state2 = advance(state1)
            switch parseCondition(state2) {
            | Success((right, state3)) =>
              Success((RuleAST.LogicalOp(RuleAST.And, left, right), state3))
            | Failure(err) => Failure(err)
            }
          }
        | Or => {
            let state2 = advance(state1)
            switch parseCondition(state2) {
            | Success((right, state3)) =>
              Success((RuleAST.LogicalOp(RuleAST.Or, left, right), state3))
            | Failure(err) => Failure(err)
            }
          }
        | _ => Success((left, state1)) // No logical operator, return as is
        }
      }
    | Failure(err) => Failure(err)
    }
  }

  // Parse a simple action (stub for now - would need to be extended)
  let parseAction = (state: parserState): parseResult<(RuleAST.action, parserState)> => {
    // For now, just recognize NoAction as an identifier
    let current = peek(state)
    switch current {
    | Identifier("NoAction") => Success((RuleAST.NoAction, advance(state)))
    | Identifier("ScheduleRetry") =>
      Success((RuleAST.ExecuteEffect(StateMachine.Effect.ScheduleRetry), advance(state)))
    | _ =>
      Failure({
        message: `Expected action, got ${current->Obj.magic}`,
        position: Some(state.position),
        token: None,
      })
    }
  }

  // Parse complete rule: "when CONDITION then ACTION"
  let parseRule = (state: parserState): parseResult<RuleAST.rule> => {
    // Expect "when"
    switch expect(state, When) {
    | Success(state1) =>
      // Parse condition
      switch parseCondition(state1) {
      | Success((condition, state2)) =>
        // Expect "then"
        switch expect(state2, Then) {
        | Success(state3) =>
          // Parse action
          switch parseAction(state3) {
          | Success((action, state4)) => {
              // Check for EOF
              let current = peek(state4)
              if current === EOF {
                Success({
                  metadata: {
                    name: "parsed-rule",
                    description: None,
                    tags: [],
                    enabled: true,
                    createdAt: Some(Js.Date.now()),
                    updatedAt: None,
                  },
                  priority: RuleAST.Medium,
                  condition: condition,
                  actions: [action],
                })
              } else {
                Failure({
                  message: `Expected EOF, got ${current->Obj.magic}`,
                  position: Some(state4.position),
                  token: None,
                })
              }
            }
          | Failure(err) => Failure(err)
          }
        | Failure(err) => Failure(err)
        }
      | Failure(err) => Failure(err)
      }
    | Failure(err) => Failure(err)
    }
  }
}

// Public API
let parseRuleString = (input: string): parseResult<RuleAST.rule> => {
  switch Tokenizer.tokenize(input) {
  | Success(tokens) => {
      let state: Parser.parserState = {tokens: tokens, position: 0}
      Parser.parseRule(state)
    }
  | Failure(err) => Failure(err)
  }
}

// Helper to get error message
let getErrorMessage = (result: parseResult<'a>): option<string> => {
  switch result {
  | Success(_) => None
  | Failure(err) => Some(err.message)
  }
}
