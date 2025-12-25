# Session Contract

## Purpose

The Session domain manages collaboration sessions between agents and users. Sessions track participants, state, and enable coordinated multi-agent workflows.

## Key Concepts

- **Session**: A collaboration context with participants
- **Participant**: An agent or user in the session
- **SessionStatus**: Lifecycle state (active, completed, failed)
- **SessionEvent**: State changes in the session

## Schemas

| Schema | Purpose |
|--------|---------|
| `SessionSchema` | Complete session definition |
| `ParticipantSchema` | Session participant info |
| `SessionStatusSchema` | Session lifecycle states |
| `SessionEventSchema` | Session state change events |

## Usage Example

```typescript
import {
  SessionSchema,
  validateSession,
  type Session,
  type SessionStatus,
} from '@defai.digital/contracts/session/v1';

// Create a session
const session: Session = validateSession({
  sessionId: crypto.randomUUID(),
  initiator: 'orchestrator-agent',
  task: 'Review and refactor authentication module',
  status: 'active',
  participants: [
    { agentId: 'orchestrator-agent', role: 'initiator' },
    { agentId: 'code-reviewer', role: 'collaborator' },
  ],
  createdAt: new Date().toISOString(),
});

// Join session
await sessionManager.join(session.sessionId, 'security-auditor');

// Complete session
await sessionManager.complete(session.sessionId, {
  summary: 'Refactoring completed with security review',
});
```

## Related Domains

- `agent`: Agents participate in sessions
- `memory`: Stores session state
- `trace`: Records session events
- `mcp`: Exposes session tools

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-SESS-001: Sessions have unique IDs
- INV-SESS-002: Only active sessions can be joined
- INV-SESS-003: Completed sessions are immutable
