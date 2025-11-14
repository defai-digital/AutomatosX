# revamp_v1 Phase 1: Memory System - Architecture PRD

**Project:** AutomatosX Revamp v1
**Phase:** Phase 1 - Memory System
**Duration:** 4 weeks (November 10 - December 7, 2025)
**Architecture:** ReScript Core + TypeScript Layer + Zod Validation

---

## Executive Summary

This PRD defines the Memory System for revamp_v1 following the proven AutomatosX v2 architecture pattern:

1. **ReScript Core** - Deterministic state machines for conversation lifecycle
2. **TypeScript Layer** - Service orchestration and database operations
3. **Zod Validation** - Cross-boundary data validation and type safety

The Memory System provides conversation tracking, message storage, and full-text search for AI agent interactions, fully integrated with the existing v2 code intelligence infrastructure.

---

## Architecture Overview

### Three-Layer Design

```
┌────────────────────────────────────────────────────────────┐
│                    TypeScript CLI Layer                     │
│                 (src/cli/commands/memory.ts)                │
│                                                              │
│  Commands: ax memory search | list | show | export         │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│               TypeScript Service Layer                      │
│                  (src/memory/*.ts)                          │
│                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ MemoryService  │  │ConversationMgr  │  │ MemorySearch │ │
│  │                │  │                 │  │              │ │
│  │ - CRUD ops     │  │ - State mgmt    │  │ - FTS5 query │ │
│  │ - Orchestration│  │ - Session track │  │ - Caching    │ │
│  └────────┬───────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                   │                   │         │
│           └───────────────────┼───────────────────┘         │
│                               │                             │
│                    Uses ReScript State Machine              │
│                               │                             │
│           ┌───────────────────▼───────────────────┐         │
│           │  MemoryStateMachine.bs.js (compiled)  │         │
│           │                                        │         │
│           │  States: Idle → Active → Archived     │         │
│           │  Events: Create, AddMessage, Archive  │         │
│           │  Guards: Validate transitions         │         │
│           └────────────────────────────────────────┘         │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│           ReScript Core State Machine Layer                 │
│      (packages/rescript-core/src/memory/*.res)              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MemoryStateMachine.res                               │  │
│  │                                                        │  │
│  │ module State = {                                      │  │
│  │   type t = Idle | Active | Searching | Archived      │  │
│  │ }                                                      │  │
│  │                                                        │  │
│  │ module Event = {                                      │  │
│  │   type t = Create | AddMessage | Search | Archive    │  │
│  │ }                                                      │  │
│  │                                                        │  │
│  │ module Transition = {                                 │  │
│  │   let isValid = (from, event, to) => ...             │  │
│  │ }                                                      │  │
│  │                                                        │  │
│  │ module Context = {                                    │  │
│  │   type t = {                                          │  │
│  │     conversationId: string,                           │  │
│  │     messageCount: int,                                │  │
│  │     metadata: Js.Dict.t<string>,                      │  │
│  │   }                                                    │  │
│  │ }                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│               TypeScript Database Layer                     │
│              (src/database/dao/*.ts)                        │
│                                                              │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────┐│
│  │ConversationDAO  │  │  MessageDAO    │  │  AgentDAO    ││
│  │                 │  │                │  │              ││
│  │ - CRUD          │  │ - CRUD         │  │ - CRUD       ││
│  │ - Queries       │  │ - FTS5 search  │  │ - Queries    ││
│  └────────┬────────┘  └────────┬───────┘  └──────┬───────┘│
│           │                    │                  │        │
│           └────────────────────┼──────────────────┘        │
└────────────────────────────────┼───────────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │   SQLite    │
                          │             │
                          │ - conversations│
                          │ - messages     │
                          │ - messages_fts │
                          │ - agents       │
                          └─────────────┘
```

### Data Flow with Zod Validation

```typescript
User Input (CLI)
    ↓
Zod Validation (MemorySearchSchema)
    ↓
TypeScript Service (MemoryService)
    ↓
ReScript State Machine (validate transition)
    ↓
TypeScript DAO (ConversationDAO)
    ↓
Zod Validation (ConversationSchema)
    ↓
SQLite Database
    ↓
Zod Validation (ConversationSchema)
    ↓
Return to TypeScript Service
    ↓
Format Response
    ↓
User Output
```

---

## Component Specifications

### 1. ReScript Core: Memory State Machine

**File:** `packages/rescript-core/src/memory/MemoryStateMachine.res`

#### States

```rescript
module State = {
  type t =
    | Idle           // No active conversation
    | Active         // Conversation in progress
    | Searching      // Searching messages
    | Archived       // Conversation archived
    | Deleted        // Soft deleted

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
}
```

#### Events

```rescript
module Event = {
  type t =
    | CreateConversation({agentId: string, title: string})
    | AddMessage({role: string, content: string, tokens: option<int>})
    | SearchMessages({query: string})
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
```

#### Transitions

```rescript
module Transition = {
  type t = {
    from: State.t,
    event: Event.t,
    to: State.t,
  }

  let isValid = (transition: t): bool => {
    switch (transition.from, transition.event, transition.to) {
    // Create conversation
    | (Idle, CreateConversation(_), Active) => true

    // Add messages
    | (Active, AddMessage(_), Active) => true

    // Search
    | (Active, SearchMessages(_), Searching) => true
    | (Searching, SearchMessages(_), Searching) => true
    | (Archived, SearchMessages(_), Searching) => true

    // Archive
    | (Active, ArchiveConversation, Archived) => true
    | (Searching, ArchiveConversation, Archived) => true

    // Delete
    | (Active, DeleteConversation, Deleted) => true
    | (Archived, DeleteConversation, Deleted) => true

    // Restore
    | (Archived, RestoreConversation, Active) => true
    | (Deleted, RestoreConversation, Active) => true

    | _ => false
    }
  }
}
```

#### Context

```rescript
module Context = {
  type t = {
    conversationId: string,
    agentId: string,
    messageCount: int,
    totalTokens: int,
    createdAt: float,
    updatedAt: float,
    metadata: Js.Dict.t<string>,
    history: array<State.t>,
  }

  let make = (~conversationId: string, ~agentId: string): t => {
    let now = Js.Date.now()
    {
      conversationId,
      agentId,
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
}
```

#### Machine

```rescript
module Machine = {
  type t = {
    currentState: State.t,
    context: Context.t,
  }

  let make = (~conversationId: string, ~agentId: string): t => {
    {
      currentState: Idle,
      context: Context.make(~conversationId, ~agentId),
    }
  }

  let transition = (machine: t, event: Event.t, targetState: State.t): result<t, string> => {
    let trans = {Transition.from: machine.currentState, event, to: targetState}

    if Transition.isValid(trans) {
      let newContext = Context.addToHistory(machine.context, machine.currentState)
      Ok({
        currentState: targetState,
        context: newContext,
      })
    } else {
      let from = State.toString(machine.currentState)
      let to = State.toString(targetState)
      let evt = Event.toString(event)
      Error(`Invalid memory transition: ${from} -[${evt}]-> ${to}`)
    }
  }

  let getCurrentState = (machine: t): State.t => machine.currentState
  let getContext = (machine: t): Context.t => machine.context

  let updateContext = (machine: t, updater: Context.t => Context.t): t => {
    {...machine, context: updater(machine.context)}
  }
}
```

#### JavaScript Interop

```rescript
// Export for TypeScript consumption
let make = (conversationId: string, agentId: string): Machine.t => {
  Machine.make(~conversationId, ~agentId)
}

let transition = (
  machine: Machine.t,
  event: string,
  eventData: Js.Dict.t<string>,
  targetState: string,
): result<Machine.t, string> => {
  let eventObj = switch event {
  | "create_conversation" => {
      let agentId = Js.Dict.get(eventData, "agentId")->Belt.Option.getWithDefault("")
      let title = Js.Dict.get(eventData, "title")->Belt.Option.getWithDefault("Untitled")
      Event.CreateConversation({agentId, title})
    }
  | "add_message" => {
      let role = Js.Dict.get(eventData, "role")->Belt.Option.getWithDefault("user")
      let content = Js.Dict.get(eventData, "content")->Belt.Option.getWithDefault("")
      let tokens = Js.Dict.get(eventData, "tokens")->Belt.Option.flatMap(Belt.Int.fromString)
      Event.AddMessage({role, content, tokens})
    }
  | "search_messages" => {
      let query = Js.Dict.get(eventData, "query")->Belt.Option.getWithDefault("")
      Event.SearchMessages({query})
    }
  | "archive_conversation" => Event.ArchiveConversation
  | "delete_conversation" => Event.DeleteConversation
  | "restore_conversation" => Event.RestoreConversation
  | _ => Event.AddMessage({role: "system", content: "Unknown event", tokens: None})
  }

  let stateObj = State.fromString(targetState)

  switch stateObj {
  | Some(state) => Machine.transition(machine, eventObj, state)
  | None => Error(`Invalid target state: ${targetState}`)
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

let incrementMessageCount = (machine: Machine.t): Machine.t => {
  Machine.updateContext(machine, Context.incrementMessageCount)
}

let addTokens = (machine: Machine.t, tokens: int): Machine.t => {
  Machine.updateContext(machine, context => Context.addTokens(context, tokens))
}
```

**Deliverable:** `packages/rescript-core/src/memory/MemoryStateMachine.res` (~300 lines)

---

### 2. Zod Schemas

**File:** `src/types/schemas/memory.schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Memory State Machine Schemas
// ============================================================================

export const MemoryStateSchema = z.enum([
  'idle',
  'active',
  'searching',
  'archived',
  'deleted',
]);

export type MemoryState = z.infer<typeof MemoryStateSchema>;

export const MemoryEventSchema = z.enum([
  'create_conversation',
  'add_message',
  'search_messages',
  'archive_conversation',
  'delete_conversation',
  'restore_conversation',
]);

export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

// ============================================================================
// Message Schemas
// ============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1).max(100000), // Max 100K chars per message
  tokens: z.number().int().positive().optional(),
  provider: z.enum(['claude', 'gemini', 'openai']).optional(),
  createdAt: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Validation for creating a new message
export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  createdAt: true,
});

export type CreateMessage = z.infer<typeof CreateMessageSchema>;

// ============================================================================
// Conversation Schemas
// ============================================================================

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  userId: z.string().optional(),
  title: z.string().min(1).max(200),
  state: MemoryStateSchema,
  messageCount: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

// Validation for creating a new conversation
export const CreateConversationSchema = z.object({
  agentId: z.string().min(1).max(50),
  userId: z.string().optional(),
  title: z.string().min(1).max(200).default('New Conversation'),
});

export type CreateConversation = z.infer<typeof CreateConversationSchema>;

// Validation for updating a conversation
export const UpdateConversationSchema = ConversationSchema.partial().required({
  id: true,
});

export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;

// ============================================================================
// Agent Schemas
// ============================================================================

export const AgentCategorySchema = z.enum([
  'development',
  'operations',
  'leadership',
  'creative',
  'science',
]);

export type AgentCategory = z.infer<typeof AgentCategorySchema>;

export const AgentSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  category: AgentCategorySchema,
  capabilities: z.array(z.string()).min(1).max(20),
  systemPrompt: z.string().min(1).max(10000),
  tools: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
  createdAt: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

// ============================================================================
// Memory Search Schemas
// ============================================================================

export const MemorySearchOptionsSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  agentId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  dateFrom: z.number().int().positive().optional(),
  dateTo: z.number().int().positive().optional(),
  role: MessageRoleSchema.optional(),
  provider: z.enum(['claude', 'gemini', 'openai']).optional(),
});

export type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;

export const MemorySearchResultSchema = z.object({
  message: MessageSchema,
  conversation: ConversationSchema,
  relevanceScore: z.number().min(0).max(1),
  snippet: z.string().max(200),
});

export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

// ============================================================================
// Memory Statistics Schemas
// ============================================================================

export const MemoryStatsSchema = z.object({
  totalConversations: z.number().int().nonnegative(),
  totalMessages: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  activeConversations: z.number().int().nonnegative(),
  archivedConversations: z.number().int().nonnegative(),
  agentBreakdown: z.record(z.string(), z.number().int().nonnegative()),
  averageMessagesPerConversation: z.number().nonnegative(),
  averageTokensPerMessage: z.number().nonnegative(),
});

export type MemoryStats = z.infer<typeof MemoryStatsSchema>;

// ============================================================================
// Conversation with Messages (for full retrieval)
// ============================================================================

export const ConversationWithMessagesSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});

export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
```

**Deliverable:** `src/types/schemas/memory.schema.ts` (~250 lines)

---

### 3. TypeScript Service Layer

#### 3.1 MemoryService

**File:** `src/memory/MemoryService.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Database } from 'better-sqlite3';
import { ConversationDAO } from '../database/dao/ConversationDAO.js';
import { MessageDAO } from '../database/dao/MessageDAO.js';
import { AgentDAO } from '../database/dao/AgentDAO.js';
import * as MemoryStateMachine from '../../packages/rescript-core/lib/js/src/memory/MemoryStateMachine.bs.js';
import {
  type Conversation,
  type Message,
  type CreateConversation,
  type CreateMessage,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryStats,
  ConversationSchema,
  MessageSchema,
  CreateConversationSchema,
  CreateMessageSchema,
  MemorySearchOptionsSchema,
} from '../types/schemas/memory.schema.js';

export class MemoryService {
  private conversationDAO: ConversationDAO;
  private messageDAO: MessageDAO;
  private agentDAO: AgentDAO;
  private stateMachines: Map<string, any> = new Map();

  constructor(db: Database) {
    this.conversationDAO = new ConversationDAO(db);
    this.messageDAO = new MessageDAO(db);
    this.agentDAO = new AgentDAO(db);
  }

  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversation): Promise<Conversation> {
    // Validate input
    const validated = CreateConversationSchema.parse(input);

    // Create conversation ID
    const conversationId = uuidv4();

    // Initialize state machine
    const machine = MemoryStateMachine.make(conversationId, validated.agentId);

    // Transition to Active state
    const transitionResult = MemoryStateMachine.transition(
      machine,
      'create_conversation',
      { agentId: validated.agentId, title: validated.title },
      'active'
    );

    if (transitionResult.TAG !== 0) { // Result is Error
      throw new Error(transitionResult._0);
    }

    const updatedMachine = transitionResult._0; // Result is Ok

    // Store state machine
    this.stateMachines.set(conversationId, updatedMachine);

    // Create conversation record
    const conversation: Conversation = {
      id: conversationId,
      agentId: validated.agentId,
      userId: validated.userId,
      title: validated.title,
      state: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Validate and save
    const validatedConversation = ConversationSchema.parse(conversation);
    this.conversationDAO.create(validatedConversation);

    return validatedConversation;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, input: CreateMessage): Promise<Message> {
    // Validate input
    const validated = CreateMessageSchema.parse(input);

    // Get or create state machine
    let machine = this.stateMachines.get(conversationId);
    if (!machine) {
      const conversation = this.conversationDAO.findById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      machine = MemoryStateMachine.make(conversationId, conversation.agentId);
      this.stateMachines.set(conversationId, machine);
    }

    // Transition (adding message keeps state as Active)
    const transitionResult = MemoryStateMachine.transition(
      machine,
      'add_message',
      {
        role: validated.role,
        content: validated.content,
        tokens: validated.tokens?.toString() || '0',
      },
      'active'
    );

    if (transitionResult.TAG !== 0) {
      throw new Error(transitionResult._0);
    }

    // Increment message count and add tokens
    let updatedMachine = MemoryStateMachine.incrementMessageCount(transitionResult._0);
    if (validated.tokens) {
      updatedMachine = MemoryStateMachine.addTokens(updatedMachine, validated.tokens);
    }

    this.stateMachines.set(conversationId, updatedMachine);

    // Create message record
    const message: Message = {
      id: uuidv4(),
      conversationId,
      role: validated.role,
      content: validated.content,
      tokens: validated.tokens,
      provider: validated.provider,
      createdAt: Date.now(),
      metadata: validated.metadata,
    };

    // Validate and save
    const validatedMessage = MessageSchema.parse(message);
    this.messageDAO.create(validatedMessage);

    // Update conversation stats
    this.conversationDAO.incrementMessageCount(conversationId);
    if (validated.tokens) {
      this.conversationDAO.addTokens(conversationId, validated.tokens);
    }

    return validatedMessage;
  }

  /**
   * Search messages using FTS5
   */
  async searchMessages(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    // Validate input
    const validated = MemorySearchOptionsSchema.parse(options);

    // Perform FTS5 search
    const messages = this.messageDAO.search(
      validated.query,
      validated.limit,
      validated.offset,
      {
        agentId: validated.agentId,
        conversationId: validated.conversationId,
        dateFrom: validated.dateFrom,
        dateTo: validated.dateTo,
        role: validated.role,
        provider: validated.provider,
      }
    );

    // Enrich with conversation data and create search results
    const results: MemorySearchResult[] = messages.map(message => {
      const conversation = this.conversationDAO.findById(message.conversationId)!;

      // Calculate relevance score (BM25 from FTS5)
      const relevanceScore = 0.8; // Placeholder - would come from FTS5 rank

      // Create snippet
      const queryWords = validated.query.toLowerCase().split(/\s+/);
      let snippet = message.content;
      for (const word of queryWords) {
        const regex = new RegExp(`(${word})`, 'gi');
        snippet = snippet.replace(regex, '**$1**');
      }
      snippet = snippet.substring(0, 200);

      return {
        message,
        conversation,
        relevanceScore,
        snippet,
      };
    });

    return results;
  }

  /**
   * Get a conversation with all messages
   */
  async getConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    const conversation = this.conversationDAO.findById(conversationId);
    if (!conversation) return null;

    const messages = this.messageDAO.findByConversationId(conversationId);

    return {
      ...conversation,
      messages,
    };
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    let machine = this.stateMachines.get(conversationId);
    if (!machine) {
      const conversation = this.conversationDAO.findById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      machine = MemoryStateMachine.make(conversationId, conversation.agentId);
    }

    const transitionResult = MemoryStateMachine.transition(
      machine,
      'archive_conversation',
      {},
      'archived'
    );

    if (transitionResult.TAG !== 0) {
      throw new Error(transitionResult._0);
    }

    this.stateMachines.set(conversationId, transitionResult._0);
    this.conversationDAO.updateState(conversationId, 'archived');
  }

  /**
   * Get memory statistics
   */
  async getStatistics(): Promise<MemoryStats> {
    return this.conversationDAO.getStatistics();
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(limit = 10, agentId?: string): Promise<Conversation[]> {
    return this.conversationDAO.findRecent(limit, agentId);
  }

  /**
   * Clear state machine cache (for memory management)
   */
  clearStateMachineCache(): void {
    this.stateMachines.clear();
  }
}
```

**Deliverable:** `src/memory/MemoryService.ts` (~400 lines)

---

## Database Schema

**File:** `src/migrations/008_create_memory_system.sql`

```sql
-- ============================================================================
-- Migration 008: Memory System Tables
-- ============================================================================
-- Phase: revamp_v1-phase1
-- Created: November 10, 2025
-- Purpose: Create tables for AI agent memory and conversation tracking
-- ============================================================================

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT,

  CHECK (state IN ('idle', 'active', 'searching', 'archived', 'deleted')),
  CHECK (message_count >= 0),
  CHECK (total_tokens >= 0)
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER,
  provider TEXT,
  created_at INTEGER NOT NULL,
  metadata TEXT,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CHECK (role IN ('user', 'assistant', 'system')),
  CHECK (provider IS NULL OR provider IN ('claude', 'gemini', 'openai')),
  CHECK (tokens IS NULL OR tokens > 0)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_provider ON messages(provider);

-- Messages FTS5 table (full-text search)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE rowid = new.rowid;
END;

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tools TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  metadata TEXT,

  CHECK (category IN ('development', 'operations', 'leadership', 'creative', 'science')),
  CHECK (enabled IN (0, 1)),
  CHECK (priority >= 0 AND priority <= 100)
);

CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
CREATE INDEX IF NOT EXISTS idx_agents_priority ON agents(priority DESC);

-- Agent state table (runtime state tracking)
CREATE TABLE IF NOT EXISTS agent_state (
  agent_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  current_task_id TEXT,
  task_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  last_active INTEGER,
  metadata TEXT,

  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CHECK (state IN ('idle', 'running', 'paused', 'failed')),
  CHECK (task_count >= 0),
  CHECK (total_tokens >= 0)
);

-- Workflows table (multi-agent task orchestration)
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tasks TEXT NOT NULL,
  dependencies TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  metadata TEXT,

  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused'))
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
```

**Deliverable:** `src/migrations/008_create_memory_system.sql` (~150 lines)

---

## Testing Strategy

### Test Structure

All tests follow v2 patterns with Vitest:

1. **ReScript Tests** - State machine logic
2. **Zod Schema Tests** - Validation rules
3. **DAO Tests** - Database operations
4. **Service Tests** - Integration with state machines
5. **E2E Tests** - Full workflows

### Test Files

1. `packages/rescript-core/src/__tests__/MemoryStateMachine.test.ts`
2. `src/__tests__/schemas/memory.schema.test.ts`
3. `src/database/dao/__tests__/ConversationDAO.test.ts`
4. `src/database/dao/__tests__/MessageDAO.test.ts`
5. `src/memory/__tests__/MemoryService.test.ts`
6. `src/__tests__/integration/memory-e2e.test.ts`

**Total:** 30+ tests across all layers

---

## Success Criteria

### Phase 1 Completion Requirements

- [ ] MemoryStateMachine.res implemented and compiled
- [ ] All Zod schemas defined with validation
- [ ] Migration 008 applied successfully
- [ ] ConversationDAO, MessageDAO, AgentDAO implemented
- [ ] MemoryService implemented with state machine integration
- [ ] FTS5 search working (<5ms uncached, <1ms cached)
- [ ] 30+ tests passing (100%)
- [ ] CLI commands operational (ax memory search/list/show/export)
- [ ] Documentation complete
- [ ] No regressions in v2 tests (245+ still passing)

---

**Document Version:** 1.0
**Created:** November 10, 2025
**Status:** ✅ READY FOR IMPLEMENTATION
**Next:** Detailed action plan with day-by-day tasks
