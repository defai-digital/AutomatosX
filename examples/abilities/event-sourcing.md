---
abilityId: event-sourcing
displayName: Event Sourcing
category: architecture
tags: [event-sourcing, cqrs, ddd]
priority: 75
---

# Event Sourcing

## Core Concepts

### Events as Source of Truth
Instead of storing current state, store the sequence of events that led to the current state.

```typescript
// Event types
interface Event {
  eventId: string;
  aggregateId: string;
  type: string;
  timestamp: Date;
  version: number;
  payload: unknown;
}

// Domain events
interface AccountCreated {
  type: 'AccountCreated';
  payload: {
    accountId: string;
    ownerId: string;
    initialBalance: number;
  };
}

interface MoneyDeposited {
  type: 'MoneyDeposited';
  payload: {
    amount: number;
    transactionId: string;
  };
}

interface MoneyWithdrawn {
  type: 'MoneyWithdrawn';
  payload: {
    amount: number;
    transactionId: string;
  };
}

type AccountEvent = AccountCreated | MoneyDeposited | MoneyWithdrawn;
```

## Aggregate

```typescript
class BankAccount {
  private balance: number = 0;
  private version: number = 0;
  private uncommittedEvents: AccountEvent[] = [];

  constructor(
    private readonly accountId: string,
    events: AccountEvent[] = []
  ) {
    // Replay events to build current state
    for (const event of events) {
      this.apply(event, false);
    }
  }

  // Commands
  deposit(amount: number, transactionId: string): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const event: MoneyDeposited = {
      type: 'MoneyDeposited',
      payload: { amount, transactionId },
    };

    this.apply(event, true);
  }

  withdraw(amount: number, transactionId: string): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (amount > this.balance) {
      throw new Error('Insufficient funds');
    }

    const event: MoneyWithdrawn = {
      type: 'MoneyWithdrawn',
      payload: { amount, transactionId },
    };

    this.apply(event, true);
  }

  // Event handler
  private apply(event: AccountEvent, isNew: boolean): void {
    switch (event.type) {
      case 'AccountCreated':
        this.balance = event.payload.initialBalance;
        break;
      case 'MoneyDeposited':
        this.balance += event.payload.amount;
        break;
      case 'MoneyWithdrawn':
        this.balance -= event.payload.amount;
        break;
    }

    this.version++;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  getUncommittedEvents(): AccountEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  getBalance(): number {
    return this.balance;
  }
}
```

## Event Store

```typescript
interface EventStore {
  append(
    aggregateId: string,
    events: Event[],
    expectedVersion: number
  ): Promise<void>;

  getEvents(aggregateId: string, fromVersion?: number): Promise<Event[]>;

  getAllEvents(fromPosition?: number): Promise<Event[]>;
}

class PostgresEventStore implements EventStore {
  async append(
    aggregateId: string,
    events: Event[],
    expectedVersion: number
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Optimistic concurrency check
      const currentVersion = await tx.query(
        'SELECT MAX(version) FROM events WHERE aggregate_id = $1',
        [aggregateId]
      );

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, got ${currentVersion}`
        );
      }

      // Append events
      for (const event of events) {
        await tx.query(
          `INSERT INTO events (event_id, aggregate_id, type, payload, version, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.eventId,
            aggregateId,
            event.type,
            JSON.stringify(event.payload),
            event.version,
            event.timestamp,
          ]
        );
      }
    });
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<Event[]> {
    const rows = await this.db.query(
      `SELECT * FROM events
       WHERE aggregate_id = $1 AND version > $2
       ORDER BY version`,
      [aggregateId, fromVersion]
    );

    return rows.map(this.rowToEvent);
  }
}
```

## Repository

```typescript
class BankAccountRepository {
  constructor(private eventStore: EventStore) {}

  async getById(accountId: string): Promise<BankAccount | null> {
    const events = await this.eventStore.getEvents(accountId);

    if (events.length === 0) {
      return null;
    }

    return new BankAccount(accountId, events as AccountEvent[]);
  }

  async save(account: BankAccount): Promise<void> {
    const uncommittedEvents = account.getUncommittedEvents();

    if (uncommittedEvents.length === 0) {
      return;
    }

    await this.eventStore.append(
      account.accountId,
      uncommittedEvents.map((event, index) => ({
        eventId: generateId(),
        aggregateId: account.accountId,
        type: event.type,
        payload: event.payload,
        version: account.version - uncommittedEvents.length + index + 1,
        timestamp: new Date(),
      })),
      account.version - uncommittedEvents.length
    );

    account.markEventsAsCommitted();
  }
}
```

## CQRS (Command Query Responsibility Segregation)

```typescript
// Command side (write model)
class DepositCommand {
  constructor(
    public readonly accountId: string,
    public readonly amount: number,
    public readonly transactionId: string
  ) {}
}

class DepositCommandHandler {
  constructor(private repository: BankAccountRepository) {}

  async handle(command: DepositCommand): Promise<void> {
    const account = await this.repository.getById(command.accountId);

    if (!account) {
      throw new NotFoundError('Account', command.accountId);
    }

    account.deposit(command.amount, command.transactionId);

    await this.repository.save(account);
  }
}

// Query side (read model)
interface AccountSummary {
  accountId: string;
  balance: number;
  lastTransaction: Date;
  transactionCount: number;
}

class AccountSummaryProjection {
  constructor(private db: Database) {}

  async project(event: Event): Promise<void> {
    switch (event.type) {
      case 'AccountCreated':
        await this.db.query(
          `INSERT INTO account_summaries (account_id, balance, transaction_count)
           VALUES ($1, $2, 0)`,
          [event.aggregateId, event.payload.initialBalance]
        );
        break;

      case 'MoneyDeposited':
      case 'MoneyWithdrawn':
        const delta = event.type === 'MoneyDeposited'
          ? event.payload.amount
          : -event.payload.amount;

        await this.db.query(
          `UPDATE account_summaries
           SET balance = balance + $1,
               transaction_count = transaction_count + 1,
               last_transaction = $2
           WHERE account_id = $3`,
          [delta, event.timestamp, event.aggregateId]
        );
        break;
    }
  }
}
```

## Snapshots

```typescript
interface Snapshot<T> {
  aggregateId: string;
  version: number;
  state: T;
  timestamp: Date;
}

class SnapshotStore {
  async save<T>(snapshot: Snapshot<T>): Promise<void> {
    await this.db.query(
      `INSERT INTO snapshots (aggregate_id, version, state, timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (aggregate_id) DO UPDATE
       SET version = $2, state = $3, timestamp = $4`,
      [snapshot.aggregateId, snapshot.version, snapshot.state, snapshot.timestamp]
    );
  }

  async get<T>(aggregateId: string): Promise<Snapshot<T> | null> {
    // Return latest snapshot
  }
}

// Usage in repository
async getById(accountId: string): Promise<BankAccount | null> {
  // Try to load from snapshot first
  const snapshot = await this.snapshotStore.get(accountId);

  const fromVersion = snapshot?.version ?? 0;
  const events = await this.eventStore.getEvents(accountId, fromVersion);

  if (!snapshot && events.length === 0) {
    return null;
  }

  // Rebuild from snapshot + new events
  return new BankAccount(accountId, events, snapshot?.state);
}
```

## Benefits and Trade-offs

### Benefits
- Complete audit trail
- Temporal queries (state at any point)
- Event replay for debugging
- Decoupled read/write models
- Natural fit for distributed systems

### Trade-offs
- Increased complexity
- Eventual consistency
- Schema evolution challenges
- Storage requirements
- Learning curve
