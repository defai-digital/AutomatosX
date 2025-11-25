# Software Architecture Ability

Expert knowledge of software architecture patterns, principles, and system design for building scalable, maintainable applications.

## Overview

Software architecture is the fundamental organization of a system, embodied in its components, their relationships, and the principles governing its design and evolution.

## Architectural Principles

### 1. Separation of Concerns

Divide application into distinct sections, each addressing a separate concern.

**Benefits**:
- Easier to understand and maintain
- Enables parallel development
- Facilitates testing and reuse

**Examples**:
- Presentation vs. Business Logic vs. Data Access
- Read models vs. Write models (CQRS)
- Frontend vs. Backend

### 2. Modularity and Encapsulation

Break system into independent, interchangeable modules with well-defined interfaces.

**Principles**:
- High cohesion: Related functionality together
- Low coupling: Minimal dependencies between modules
- Information hiding: Internal implementation details hidden

### 3. Abstraction

Hide complexity behind simpler interfaces.

**Levels**:
- Hardware → Operating System
- Operating System → Runtime
- Runtime → Framework
- Framework → Application

### 4. Layering

Organize system into horizontal layers with clear responsibilities.

**Rules**:
- Each layer depends only on layers below
- Higher layers use services of lower layers
- No circular dependencies

### 5. Don't Repeat Yourself (DRY)

Every piece of knowledge should have a single authoritative representation.

### 6. YAGNI (You Aren't Gonna Need It)

Don't add functionality until it's necessary.

## Common Architectural Patterns

### Layered Architecture

**Structure**: Organized into horizontal layers
**Layers** (typical):
1. Presentation Layer (UI)
2. Application Layer (Use Cases)
3. Domain Layer (Business Logic)
4. Infrastructure Layer (Data Access, External Services)

**When to use**:
- Traditional monolithic applications
- Clear separation of concerns needed
- Team organized by technical layers

**Pros**:
- Simple and well-understood
- Clear separation of concerns
- Easy to test layers independently

**Cons**:
- Can become tightly coupled
- Changes may ripple through layers
- Scalability limitations

```
┌─────────────────────────────┐
│   Presentation Layer        │
├─────────────────────────────┤
│   Application Layer         │
├─────────────────────────────┤
│   Domain Layer              │
├─────────────────────────────┤
│   Infrastructure Layer      │
└─────────────────────────────┘
```

### Hexagonal Architecture (Ports and Adapters)

**Structure**: Core business logic surrounded by adapters for external systems

**Components**:
- **Core**: Domain logic (pure, no dependencies)
- **Ports**: Interfaces defining how core interacts with outside
- **Adapters**: Implementations of ports (DB, HTTP, etc.)

**When to use**:
- Domain-driven design
- Need to swap implementations easily
- Comprehensive test coverage desired

**Pros**:
- Core is independent of frameworks
- Easy to test (mock adapters)
- Flexibility in implementation choices

**Cons**:
- More complex than layered
- Requires discipline to maintain boundaries
- More abstractions and interfaces

```
        ┌────────────────────┐
        │   Adapters (DB,    │
        │   HTTP, etc.)      │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │   Ports            │
        │   (Interfaces)     │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │   Domain           │
        │   (Business Logic) │
        └────────────────────┘
```

### Microservices Architecture

**Structure**: Application as collection of small, independent services

**Characteristics**:
- Each service is independently deployable
- Services communicate via APIs (HTTP, messaging)
- Each service has its own database
- Organized around business capabilities

**When to use**:
- Large, complex applications
- Need for independent scaling
- Multiple teams working independently
- Polyglot persistence needs

**Pros**:
- Independent deployment and scaling
- Technology diversity
- Fault isolation
- Team autonomy

**Cons**:
- Distributed system complexity
- Network latency
- Data consistency challenges
- Operational overhead

### Event-Driven Architecture

**Structure**: Components communicate through events

**Components**:
- **Event Producers**: Generate events
- **Event Channels**: Transport events
- **Event Consumers**: React to events

**Patterns**:
- Event Notification
- Event-Carried State Transfer
- Event Sourcing

**When to use**:
- Asynchronous processing needed
- Loose coupling desired
- Real-time updates required
- Complex workflows

**Pros**:
- Loose coupling
- Scalability
- Flexibility
- Asynchronous processing

**Cons**:
- Complexity in debugging
- Eventual consistency
- Event versioning challenges

### CQRS (Command Query Responsibility Segregation)

**Structure**: Separate models for reading and writing data

**Components**:
- **Command Model**: Handles writes (create, update, delete)
- **Query Model**: Handles reads (optimized for specific views)

**When to use**:
- Read and write patterns differ significantly
- Need to scale reads and writes independently
- Complex domain logic
- Event sourcing

**Pros**:
- Optimized for different access patterns
- Independent scaling
- Clear command/query separation

**Cons**:
- Increased complexity
- Eventual consistency
- Synchronization overhead

## Architectural Decision Making

### Architecture Trade-offs

**Performance vs. Maintainability**:
- Optimize critical paths
- Keep non-critical code clean and simple

**Flexibility vs. Simplicity**:
- Don't over-engineer for future needs
- Refactor when patterns emerge

**Consistency vs. Availability (CAP Theorem)**:
- Can't have all three: Consistency, Availability, Partition Tolerance
- Choose based on business requirements

### Evaluating Architectures

**Quality Attributes**:
- **Performance**: Response time, throughput
- **Scalability**: Handle increasing load
- **Availability**: Uptime, fault tolerance
- **Security**: Authentication, authorization, data protection
- **Maintainability**: Easy to modify and extend
- **Testability**: Easy to verify correctness
- **Deployability**: Easy to deploy and operate

**Architecture Review Checklist**:
- [ ] Clear separation of concerns
- [ ] Appropriate abstraction levels
- [ ] Well-defined component boundaries
- [ ] Explicit dependencies
- [ ] Scalability considerations
- [ ] Security considerations
- [ ] Testability built in
- [ ] Operational concerns addressed

## System Design Patterns

### Database Patterns

**Repository Pattern**:
- Abstract data access logic
- Decouple domain from persistence

**Unit of Work**:
- Maintain list of objects affected by transaction
- Coordinate writing changes

**Database per Service** (Microservices):
- Each service owns its database
- No shared databases

### Communication Patterns

**API Gateway**:
- Single entry point for clients
- Request routing and composition
- Cross-cutting concerns (auth, logging)

**Service Mesh**:
- Infrastructure layer for service-to-service communication
- Handles retries, timeouts, circuit breaking

**Message Queue**:
- Asynchronous communication
- Decoupling producers and consumers
- Load leveling

### Resilience Patterns

**Circuit Breaker**:
- Prevent cascading failures
- Fail fast when service unavailable
- Automatic recovery attempts

**Retry with Backoff**:
- Retry failed operations
- Exponential backoff to avoid overwhelming
- Maximum retry limit

**Bulkhead**:
- Isolate resources to prevent total failure
- Similar to ship compartments
- Limit impact of failures

**Timeout**:
- Set maximum wait time
- Prevent hanging operations
- Graceful degradation

## Architecture Documentation

### C4 Model

**Context Diagram**: System and its users
**Container Diagram**: High-level components
**Component Diagram**: Internal structure
**Code Diagram**: Class-level details (optional)

### Architecture Decision Records (ADR)

**Template**:
```
# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a database that supports complex queries, transactions, and scales to millions of records.

## Decision
We will use PostgreSQL as our primary relational database.

## Consequences
**Positive**:
- ACID compliance
- Rich query capabilities
- Proven scalability
- Strong ecosystem

**Negative**:
- Requires specialized knowledge
- Vertical scaling limitations
- Operational overhead

## Alternatives Considered
- MySQL: Less feature-rich
- MongoDB: Consistency concerns
- DynamoDB: Vendor lock-in
```

## Anti-patterns to Avoid

### Big Ball of Mud
- No clear architecture
- Everything depends on everything
- **Solution**: Gradual refactoring, introduce boundaries

### Monolithic Database
- All services share one database
- Tight coupling
- **Solution**: Database per service, API composition

### Distributed Monolith
- Microservices that must be deployed together
- Worst of both worlds
- **Solution**: True service independence or consolidate

### God Object
- Single class/service knows/does everything
- **Solution**: Single Responsibility Principle

## Best Practices

1. **Start Simple**: Don't over-engineer early
2. **Evolve Architecture**: Refactor as you learn
3. **Document Decisions**: Use ADRs
4. **Define Boundaries**: Clear contracts between components
5. **Test Architecture**: Fitness functions, architecture tests
6. **Monitor**: Metrics, logging, tracing
7. **Security by Design**: Not bolted on later
8. **Operational Concerns**: Deployment, monitoring, debugging

## Further Reading

- "Software Architecture: The Hard Parts" by Neal Ford et al.
- "Building Microservices" by Sam Newman
- "Domain-Driven Design" by Eric Evans
- "Clean Architecture" by Robert C. Martin
- "Fundamentals of Software Architecture" by Mark Richards and Neal Ford
