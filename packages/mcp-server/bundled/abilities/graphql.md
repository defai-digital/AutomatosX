---
abilityId: graphql
displayName: GraphQL Best Practices
category: api
tags: [graphql, api, backend]
priority: 75
---

# GraphQL Best Practices

## Schema Design

### Type Definitions
```graphql
# Use clear, descriptive type names
type User {
  id: ID!
  email: String!
  displayName: String!
  createdAt: DateTime!
  posts(first: Int, after: String): PostConnection!
}

# Use connections for pagination
type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### Input Types
```graphql
# Use input types for mutations
input CreateUserInput {
  email: String!
  displayName: String!
  password: String!
}

input UpdateUserInput {
  displayName: String
  bio: String
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}

# Return payloads with user errors
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
}
```

### Enums and Unions
```graphql
enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

# Union for polymorphic types
union SearchResult = User | Post | Comment

type Query {
  search(query: String!): [SearchResult!]!
}
```

## Resolvers

### Basic Resolvers
```typescript
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      return context.dataSources.users.findById(id);
    },

    users: async (_, { first, after }, context) => {
      return context.dataSources.users.findMany({ first, after });
    },
  },

  User: {
    // Field resolver
    posts: async (user, { first, after }, context) => {
      return context.dataSources.posts.findByUserId(user.id, { first, after });
    },

    // Computed field
    fullName: (user) => `${user.firstName} ${user.lastName}`,
  },

  Mutation: {
    createUser: async (_, { input }, context) => {
      try {
        const user = await context.dataSources.users.create(input);
        return { user, errors: [] };
      } catch (error) {
        return {
          user: null,
          errors: [{ message: error.message }],
        };
      }
    },
  },
};
```

### DataLoader for N+1 Prevention
```typescript
import DataLoader from 'dataloader';

// Create loaders
const createLoaders = () => ({
  userLoader: new DataLoader(async (ids: string[]) => {
    const users = await db.users.findMany({ where: { id: { in: ids } } });
    const userMap = new Map(users.map(u => [u.id, u]));
    return ids.map(id => userMap.get(id) || null);
  }),

  postsByUserLoader: new DataLoader(async (userIds: string[]) => {
    const posts = await db.posts.findMany({
      where: { userId: { in: userIds } },
    });
    const grouped = groupBy(posts, 'userId');
    return userIds.map(id => grouped[id] || []);
  }),
});

// Use in resolvers
const resolvers = {
  Post: {
    author: (post, _, { loaders }) => {
      return loaders.userLoader.load(post.authorId);
    },
  },
};
```

## Authentication & Authorization

```typescript
// Context with auth
const context = async ({ req }) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? await verifyToken(token) : null;

  return {
    user,
    dataSources: createDataSources(),
    loaders: createLoaders(),
  };
};

// Auth directive
const authDirective = (next, _, { requires }, context) => {
  if (!context.user) {
    throw new AuthenticationError('Not authenticated');
  }

  if (requires && !context.user.roles.includes(requires)) {
    throw new ForbiddenError('Not authorized');
  }

  return next();
};

// Schema directive usage
type Query {
  me: User @auth
  adminData: AdminData @auth(requires: ADMIN)
}
```

## Error Handling

```typescript
import { ApolloError, UserInputError } from 'apollo-server';

// Custom error classes
class NotFoundError extends ApolloError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', { resource, id });
  }
}

// Resolver error handling
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      const user = await context.dataSources.users.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }
      return user;
    },
  },

  Mutation: {
    createUser: async (_, { input }) => {
      // Validation error
      if (!isValidEmail(input.email)) {
        throw new UserInputError('Invalid email', {
          argumentName: 'input.email',
        });
      }
    },
  },
};
```

## Performance

### Query Complexity
```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const complexityRule = createComplexityLimitRule(1000, {
  scalarCost: 1,
  objectCost: 10,
  listFactor: 10,
});

const server = new ApolloServer({
  validationRules: [complexityRule],
});
```

### Persisted Queries
```typescript
// Client sends hash instead of full query
const link = createPersistedQueryLink({ sha256 });

// Server
const server = new ApolloServer({
  persistedQueries: {
    cache: new RedisCache(),
  },
});
```

## Subscriptions

```graphql
type Subscription {
  messageAdded(channelId: ID!): Message!
  userStatusChanged(userId: ID!): UserStatus!
}
```

```typescript
const resolvers = {
  Subscription: {
    messageAdded: {
      subscribe: (_, { channelId }, { pubsub }) => {
        return pubsub.asyncIterator(`MESSAGE_ADDED.${channelId}`);
      },
    },
  },

  Mutation: {
    sendMessage: async (_, { input }, { pubsub }) => {
      const message = await createMessage(input);
      pubsub.publish(`MESSAGE_ADDED.${input.channelId}`, {
        messageAdded: message,
      });
      return message;
    },
  },
};
```

## Best Practices Summary

- Use connections for pagination
- Return payloads from mutations with errors
- Use DataLoader to prevent N+1
- Implement query complexity limits
- Version via schema evolution, not URLs
- Use input types for complex arguments
- Document with descriptions
- Handle errors gracefully
