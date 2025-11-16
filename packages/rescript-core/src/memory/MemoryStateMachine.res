// Memory State Machine for AutomatosX
// Manages conversation and message lifecycle states

module State = {
  type t =
    | Idle
    | Active
    | Searching
    | Archived
    | Deleted

  let toString = (state: t): string => {
    switch state {
    | Idle => "idle"
    | Active => "active"
    | Searching => "searching"
    | Archived => "archived"
    | Deleted => "deleted"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "idle" => Some(Idle)
    | "active" => Some(Active)
    | "searching" => Some(Searching)
    | "archived" => Some(Archived)
    | "deleted" => Some(Deleted)
    | _ => None
    }
  }

  let isTerminal = (state: t): bool => {
    switch state {
    | Deleted => true
    | _ => false
    }
  }
}

module Event = {
  type createConversationPayload = {
    agentId: string,
    title: string,
    userId: option<string>,
  }

  type addMessagePayload = {
    role: string,
    content: string,
    tokens: option<int>,
  }

  type searchMessagesPayload = {query: string}

  type t =
    | CreateConversation(createConversationPayload)
    | AddMessage(addMessagePayload)
    | SearchMessages(searchMessagesPayload)
    | ArchiveConversation
    | DeleteConversation
    | RestoreConversation

  let toString = (event: t): string => {
    switch event {
    | CreateConversation(_) => "create_conversation"
    | AddMessage(_) => "add_message"
    | SearchMessages(_) => "search_messages"
    | ArchiveConversation => "archive_conversation"
    | DeleteConversation => "delete_conversation"
    | RestoreConversation => "restore_conversation"
    }
  }
}

module Transition = {
  type t = {
    from: State.t,
    event: Event.t,
    to: State.t,
  }

  let isValid = (transition: t): bool => {
    switch (transition.from, transition.event, transition.to) {
    | (Idle, CreateConversation(_), Active) => true
    | (Active, AddMessage(_), Active) => true
    | (Active, SearchMessages(_), Searching) => true
    | (Searching, SearchMessages(_), Searching) => true
    | (Searching, AddMessage(_), Active) => true
    | (Archived, SearchMessages(_), Searching) => true
    | (Active, ArchiveConversation, Archived) => true
    | (Searching, ArchiveConversation, Archived) => true
    | (Active, DeleteConversation, Deleted) => true
    | (Archived, DeleteConversation, Deleted) => true
    | (Searching, DeleteConversation, Deleted) => true
    | (Archived, RestoreConversation, Active) => true
    | (Deleted, RestoreConversation, Active) => true
    | _ => false
    }
  }

  let make = (from: State.t, event: Event.t, to: State.t): option<t> => {
    let transition = {from, event, to}
    if isValid(transition) {
      Some(transition)
    } else {
      None
    }
  }
}

module Context = {
  type t = {
    conversationId: string,
    agentId: string,
    userId: option<string>,
    messageCount: int,
    totalTokens: int,
    createdAt: float,
    updatedAt: float,
    metadata: Js.Dict.t<string>,
    history: array<State.t>,
  }

  let make = (~conversationId: string, ~agentId: string, ~userId: option<string>=?): t => {
    let now = Js.Date.now()
    {
      conversationId,
      agentId,
      userId,
      messageCount: 0,
      totalTokens: 0,
      createdAt: now,
      updatedAt: now,
      metadata: Js.Dict.empty(),
      history: [],
    }
  }

  let incrementMessageCount = (context: t): t => {
    {...context, messageCount: context.messageCount + 1, updatedAt: Js.Date.now()}
  }

  let addTokens = (context: t, tokens: int): t => {
    {...context, totalTokens: context.totalTokens + tokens, updatedAt: Js.Date.now()}
  }

  let setMetadata = (context: t, key: string, value: string): t => {
    let newMetadata = Js.Dict.fromArray(Js.Dict.entries(context.metadata))
    Js.Dict.set(newMetadata, key, value)
    {...context, metadata: newMetadata, updatedAt: Js.Date.now()}
  }

  let addToHistory = (context: t, state: State.t): t => {
    {...context, history: Js.Array2.concat(context.history, [state])}
  }

  let update = (context: t): t => {
    {...context, updatedAt: Js.Date.now()}
  }
}

module Machine = {
  type t = {
    currentState: State.t,
    context: Context.t,
  }

  let make = (~conversationId: string, ~agentId: string, ~userId: option<string>=?): t => {
    {
      currentState: Idle,
      context: Context.make(~conversationId, ~agentId, ~userId?),
    }
  }

  let transition = (machine: t, event: Event.t, targetState: State.t): result<t, string> => {
    let trans = {Transition.from: machine.currentState, event, to: targetState}

    switch Transition.make(trans.from, trans.event, trans.to) {
    | Some(_) => {
        let newContext = Context.addToHistory(machine.context, machine.currentState)
        Ok({
          currentState: targetState,
          context: Context.update(newContext),
        })
      }
    | None => {
        let from = State.toString(machine.currentState)
        let to = State.toString(targetState)
        let evt = Event.toString(event)
        Error(`Invalid memory transition: ${from} -[${evt}]-> ${to}`)
      }
    }
  }

  let getCurrentState = (machine: t): State.t => machine.currentState
  let getContext = (machine: t): Context.t => machine.context

  let updateContext = (machine: t, updater: Context.t => Context.t): t => {
    {...machine, context: updater(machine.context)}
  }

  let canTransition = (machine: t, event: Event.t, targetState: State.t): bool => {
    let trans = {Transition.from: machine.currentState, event, to: targetState}
    Transition.isValid(trans)
  }
}

// JavaScript Interop Exports
let make = (conversationId: string, agentId: string, userId: option<string>): Machine.t => {
  Machine.make(~conversationId, ~agentId, ~userId?)
}

let makeSimple = (conversationId: string, agentId: string): Machine.t => {
  Machine.make(~conversationId, ~agentId)
}

let transition = (
  machine: Machine.t,
  eventType: string,
  eventData: Js.Json.t,
  targetState: string,
): result<Machine.t, string> => {
  // Parse target state
  let targetStateOpt = State.fromString(targetState)

  switch targetStateOpt {
  | None => Error(`Invalid target state: ${targetState}`)
  | Some(target) => {
      // Parse event based on type
      let eventOpt = switch eventType {
      | "create_conversation" => {
          // Extract payload from JSON
          let obj = Js.Json.decodeObject(eventData)
          switch obj {
          | Some(dict) => {
              let agentId = Js.Dict.get(dict, "agentId")->Belt.Option.flatMap(Js.Json.decodeString)
              let title = Js.Dict.get(dict, "title")->Belt.Option.flatMap(Js.Json.decodeString)
              let userId = Js.Dict.get(dict, "userId")->Belt.Option.flatMap(Js.Json.decodeString)

              switch (agentId, title) {
              | (Some(aid), Some(t)) =>
                Some(
                  Event.CreateConversation({agentId: aid, title: t, userId: userId}),
                )
              | _ => None
              }
            }
          | None => None
          }
        }
      | "add_message" => {
          let obj = Js.Json.decodeObject(eventData)
          switch obj {
          | Some(dict) => {
              let role = Js.Dict.get(dict, "role")->Belt.Option.flatMap(Js.Json.decodeString)
              let content = Js.Dict.get(dict, "content")->Belt.Option.flatMap(Js.Json.decodeString)
              let tokens = Js.Dict.get(dict, "tokens")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Belt.Float.toInt)

              switch (role, content) {
              | (Some(r), Some(c)) => Some(Event.AddMessage({role: r, content: c, tokens: tokens}))
              | _ => None
              }
            }
          | None => None
          }
        }
      | "search_messages" => {
          let obj = Js.Json.decodeObject(eventData)
          switch obj {
          | Some(dict) => {
              let query = Js.Dict.get(dict, "query")->Belt.Option.flatMap(Js.Json.decodeString)
              switch query {
              | Some(q) => Some(Event.SearchMessages({query: q}))
              | None => None
              }
            }
          | None => None
          }
        }
      | "archive_conversation" => Some(Event.ArchiveConversation)
      | "delete_conversation" => Some(Event.DeleteConversation)
      | "restore_conversation" => Some(Event.RestoreConversation)
      | _ => None
      }

      switch eventOpt {
      | None => Error(`Invalid event type: ${eventType}`)
      | Some(event) => Machine.transition(machine, event, target)
      }
    }
  }
}

let getCurrentState = (machine: Machine.t): string => {
  State.toString(Machine.getCurrentState(machine))
}

let getMessageCount = (machine: Machine.t): int => {
  Machine.getContext(machine).messageCount
}

let getTotalTokens = (machine: Machine.t): int => {
  Machine.getContext(machine).totalTokens
}

let getConversationId = (machine: Machine.t): string => {
  Machine.getContext(machine).conversationId
}

let getAgentId = (machine: Machine.t): string => {
  Machine.getContext(machine).agentId
}

let getUserId = (machine: Machine.t): option<string> => {
  Machine.getContext(machine).userId
}

let incrementMessageCount = (machine: Machine.t): Machine.t => {
  Machine.updateContext(machine, Context.incrementMessageCount)
}

let addTokens = (machine: Machine.t, tokens: int): Machine.t => {
  Machine.updateContext(machine, context => Context.addTokens(context, tokens))
}

let setMetadata = (machine: Machine.t, key: string, value: string): Machine.t => {
  Machine.updateContext(machine, context => Context.setMetadata(context, key, value))
}

let canTransition = (machine: Machine.t, eventType: string, targetState: string): bool => {
  let targetStateOpt = State.fromString(targetState)
  let eventOpt = switch eventType {
  | "create_conversation" =>
    Some(
      Event.CreateConversation({agentId: "", title: "", userId: None}),
    )
  | "add_message" => Some(Event.AddMessage({role: "", content: "", tokens: None}))
  | "search_messages" => Some(Event.SearchMessages({query: ""}))
  | "archive_conversation" => Some(Event.ArchiveConversation)
  | "delete_conversation" => Some(Event.DeleteConversation)
  | "restore_conversation" => Some(Event.RestoreConversation)
  | _ => None
  }

  switch (eventOpt, targetStateOpt) {
  | (Some(event), Some(target)) => Machine.canTransition(machine, event, target)
  | _ => false
  }
}

let getHistory = (machine: Machine.t): array<string> => {
  let history = Machine.getContext(machine).history
  Js.Array2.map(history, State.toString)
}
