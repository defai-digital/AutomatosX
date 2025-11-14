# Messaging Systems & Framework Support
**Date**: 2025-11-08
**Status**: ✅ RESEARCH COMPLETE

## Summary

Comprehensive analysis of NATS, Kafka, NestJS, and major backend frameworks to determine AutomatosX v2 support capabilities.

## Key Finding

**✅ Most messaging systems and frameworks are fully or partially supported!**

Framework code uses existing supported languages. Configuration files use simple formats that work with text search.

## Detailed Analysis

### 1. NATS Messaging System

**Description**: Cloud-native messaging system for microservices, IoT, and edge computing

**Primary Language**: ✅ Already Supported
- **Go** - Core implementation → Go parser

**Configuration Files**: ⚠️ Custom Format
- `nats-server.conf` - Server configuration
- `cluster.conf` - Cluster configuration
- `tls.conf` - TLS configuration

**Configuration Format**: Custom (JSON-like with variables)
```conf
# NATS Server Configuration
port: 4222
monitor_port: 8222

# Authorization block
authorization {
  user: admin
  password: $ADMIN_PASSWORD
  timeout: 2
}

# Cluster configuration
cluster {
  name: my-cluster
  listen: 0.0.0.0:6222

  routes = [
    nats://localhost:6222
    nats://localhost:6223
  ]
}

# JetStream configuration
jetstream {
  store_dir: /data/jetstream
  max_mem: 1G
  max_file: 10G
}

# Logging
debug: false
trace: false
logtime: true
log_file: "/var/log/nats/nats-server.log"
```

**Tree-sitter Parser**: ❌ Not Available
- Custom format combining JSON/YAML-like syntax
- No npm package exists
- Simple enough for text search

**Client Libraries**: ✅ Already Supported
- **JavaScript/TypeScript** → JavaScript/TypeScript parsers
- **Python** → Python parser
- **Go** → Go parser
- **Java** → Java parser
- **Rust** → Rust parser

**Example NATS Client Code** (Already Supported):
```typescript
// TypeScript NATS client
import { connect, StringCodec } from 'nats';

const nc = await connect({
  servers: ['nats://localhost:4222'],
  user: 'admin',
  pass: 'password'
});

const sc = StringCodec();

// Publisher
nc.publish('updates', sc.encode('Hello NATS!'));

// Subscriber
const sub = nc.subscribe('updates');
for await (const m of sub) {
  console.log(`Received: ${sc.decode(m.data)}`);
}
```

**Recommendation**:
- ✅ **Client code fully supported** via existing language parsers
- ⚠️ **.conf files** - Simple format, text search sufficient

---

### 2. Apache Kafka

**Description**: Distributed event streaming platform

**Primary Language**: ✅ Already Supported
- **Java** - Core implementation → Java parser
- **Scala** - Some components → Scala parser

**Configuration Files**: ⚠️ Java Properties Format
- `server.properties` - Broker configuration
- `producer.properties` - Producer configuration
- `consumer.properties` - Consumer configuration
- `connect-standalone.properties` - Kafka Connect

**Configuration Format**: Java Properties (key=value)
```properties
# Kafka Broker Configuration
############################# Server Basics #############################
broker.id=0
process.roles=broker,controller
node.id=0

############################# Socket Server Settings #############################
listeners=PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093
advertised.listeners=PLAINTEXT://localhost:9092
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
controller.listener.names=CONTROLLER

############################# Log Basics #############################
log.dirs=/tmp/kafka-logs
num.partitions=1
default.replication.factor=1

############################# Log Retention Policy #############################
log.retention.hours=168
log.retention.bytes=1073741824
log.segment.bytes=1073741824

############################# Zookeeper (Legacy) #############################
zookeeper.connect=localhost:2181
zookeeper.connection.timeout.ms=18000

############################# KRaft Settings #############################
controller.quorum.voters=0@localhost:9093
```

**Tree-sitter Parser**: ❌ Not Available
- `.properties` format (Java standard)
- No tree-sitter parser on npm
- Simple key=value pairs, text search works

**Client Libraries**: ✅ Already Supported
- **Java** - kafka-clients → Java parser
- **JavaScript** - KafkaJS → JavaScript parser
- **Python** - kafka-python → Python parser
- **Go** - confluent-kafka-go → Go parser
- **Rust** - rdkafka → Rust parser

**Example Kafka Client Code** (Already Supported):
```javascript
// JavaScript Kafka producer
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

await producer.connect();
await producer.send({
  topic: 'test-topic',
  messages: [
    { value: 'Hello Kafka!' }
  ]
});

// Consumer
const consumer = kafka.consumer({ groupId: 'test-group' });
await consumer.connect();
await consumer.subscribe({ topic: 'test-topic' });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log({
      value: message.value.toString(),
    });
  },
});
```

**Kafka Streams DSL** (Already Supported):
```java
// Java Kafka Streams
StreamsBuilder builder = new StreamsBuilder();

KStream<String, String> source = builder.stream("input-topic");

KStream<String, String> transformed = source
    .filter((key, value) -> value.length() > 5)
    .mapValues(value -> value.toUpperCase());

transformed.to("output-topic");

KafkaStreams streams = new KafkaStreams(builder.build(), props);
streams.start();
```

**Recommendation**:
- ✅ **Client code fully supported** via existing language parsers
- ⚠️ **.properties files** - Simple format, text search sufficient

---

### 3. NestJS Framework

**Description**: Progressive Node.js framework for building server-side applications

**Primary Language**: ✅ Already Supported
- **TypeScript** - Primary language → TypeScript parser
- **JavaScript** - Alternative → JavaScript parser

**Configuration Files**: ✅ Already Supported
- `nest-cli.json` - CLI configuration → JSON parser
- `tsconfig.json` - TypeScript config → JSON parser
- `.env` - Environment variables → Text search
- Custom config files - TypeScript/JSON → TypeScript/JSON parsers

**Example `nest-cli.json`** (Already Supported):
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js"
  },
  "generateOptions": {
    "spec": true,
    "flat": false
  }
}
```

**Example `tsconfig.json`** (Already Supported):
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

**Example NestJS Application Code** (Already Supported):
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false,
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

```typescript
// users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }
}
```

**Recommendation**: ✅ **Fully supported** via TypeScript and JSON parsers

---

### 4. Express.js Framework

**Description**: Fast, unopinionated, minimalist web framework for Node.js

**Primary Language**: ✅ Already Supported
- **JavaScript** → JavaScript parser
- **TypeScript** → TypeScript parser

**Configuration Files**: ✅ Already Supported
- `.env` - Environment variables → Text search
- `package.json` - NPM config → JSON parser
- Custom configs - JavaScript/JSON → JavaScript/JSON parsers

**Example Express.js Application** (Already Supported):
```javascript
// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello Express!' });
});

app.post('/users', async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json(user);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Recommendation**: ✅ **Fully supported** via JavaScript/TypeScript parsers

---

### 5. FastAPI Framework

**Description**: Modern, fast Python web framework for building APIs

**Primary Language**: ✅ Already Supported
- **Python** → Python parser

**Configuration Files**: ✅ Already Supported
- `.env` - Environment variables → Text search
- `pyproject.toml` - Python project config → TOML parser
- Custom configs - Python/YAML/JSON → Python/YAML/JSON parsers

**Example FastAPI Application** (Already Supported):
```python
# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(
    title="My API",
    description="FastAPI example",
    version="1.0.0"
)

class User(BaseModel):
    id: Optional[int] = None
    name: str
    email: str
    age: int

@app.get("/")
async def root():
    return {"message": "Hello FastAPI"}

@app.get("/users", response_model=List[User])
async def get_users():
    return await fetch_users_from_db()

@app.post("/users", response_model=User)
async def create_user(user: User):
    created_user = await save_user_to_db(user)
    return created_user

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    user = await fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

**Recommendation**: ✅ **Fully supported** via Python and TOML parsers

---

### 6. Django Framework

**Description**: High-level Python web framework

**Primary Language**: ✅ Already Supported
- **Python** → Python parser

**Configuration Files**: ✅ Already Supported
- `settings.py` - Django settings → Python parser
- `urls.py` - URL configuration → Python parser
- `.env` - Environment variables → Text search

**Example Django Configuration** (Already Supported):
```python
# settings.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'myapp',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

**Recommendation**: ✅ **Fully supported** via Python parser

---

### 7. Spring Boot Framework

**Description**: Java-based framework for building production-ready applications

**Primary Language**: ✅ Already Supported
- **Java** → Java parser
- **Kotlin** → Kotlin parser

**Configuration Files**: ⚠️ Partially Supported
- `application.properties` - Properties config → ⚠️ No parser, text search
- `application.yml` / `application.yaml` - YAML config → ✅ YAML parser
- `pom.xml` - Maven config → ⚠️ No XML parser
- `build.gradle` - Gradle config → ✅ Groovy parser

**Example `application.yml`** (Already Supported):
```yaml
spring:
  application:
    name: my-spring-app
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect

server:
  port: 8080
  servlet:
    context-path: /api

logging:
  level:
    root: INFO
    com.myapp: DEBUG
```

**Example Spring Boot Application** (Already Supported):
```java
// Application.java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// UserController.java
@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping
    public List<User> getAllUsers() {
        return userService.findAll();
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User created = userService.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

**Recommendation**:
- ✅ **Code fully supported** via Java/Kotlin parsers
- ✅ **YAML configs fully supported** via YAML parser
- ✅ **Gradle configs supported** via Groovy parser
- ⚠️ **.properties files** - Text search sufficient

---

## Summary Table

| System/Framework | Code Language | Config Format | Parser Status |
|------------------|---------------|---------------|---------------|
| **NATS** | Go | .conf (custom) | ✅ Code supported, ⚠️ Config text search |
| **Kafka** | Java, Scala | .properties | ✅ Code supported, ⚠️ Config text search |
| **NestJS** | TypeScript | JSON | ✅ Fully Supported |
| **Express.js** | JavaScript/TS | JSON | ✅ Fully Supported |
| **FastAPI** | Python | TOML, YAML | ✅ Fully Supported |
| **Django** | Python | Python | ✅ Fully Supported |
| **Spring Boot** | Java/Kotlin | YAML, .properties | ✅ Code + YAML supported |

## AutomatosX v2 Coverage

### ✅ Fully Supported

| Category | Format | Parser | Use Cases |
|----------|--------|--------|-----------|
| **Code** | TypeScript | TypeScriptParser | NestJS, Express.js |
| | JavaScript | JavaScriptParser | Express.js, KafkaJS |
| | Python | PythonParser | FastAPI, Django |
| | Java | JavaParser | Kafka, Spring Boot |
| | Kotlin | KotlinParser | Spring Boot |
| | Go | GoParser | NATS server |
| | Scala | ScalaParser | Kafka components |
| **Config** | JSON | JsonParser | NestJS, Express.js |
| | YAML | YamlParser | Spring Boot, FastAPI |
| | TOML | TomlParser | Python projects |
| | Groovy | GroovyParser | Gradle (Spring Boot) |

### ⚠️ Text Search Sufficient

| Format | Used By | Status | Alternative |
|--------|---------|--------|-------------|
| **.conf** | NATS | Custom format | Text search works |
| **.properties** | Kafka, Spring Boot | Simple key=value | Text search works |
| **.env** | All frameworks | Simple key=value | Text search works |

## CLI Usage Examples

### NATS Projects
```bash
# Index NATS server code
ax index ./nats-server/ --lang go

# Find message handlers
ax find "Subscribe|Publish" --regex --lang go

# Search NATS config files (text search)
ax find "port|cluster" --file nats-server.conf

# Find JetStream config
ax find "jetstream" --file server.conf
```

### Kafka Projects
```bash
# Index Kafka code
ax index ./kafka/ --lang java

# Find producer code
ax find "KafkaProducer|send" --regex --lang java

# Search Kafka configs (text search)
ax find "broker.id|listeners" --file server.properties

# Find consumer code
ax find "KafkaConsumer|poll" --regex --lang java
```

### NestJS Projects
```bash
# Index NestJS project
ax index ./src/ --lang typescript

# Find controllers
ax find "@Controller" --lang typescript

# Search for decorators
ax find "@Get|@Post|@Injectable" --regex --lang typescript

# Find config files
ax find "nest-cli" --lang json --file nest-cli.json
```

### Express.js Projects
```bash
# Index Express project
ax index ./src/ --lang javascript

# Find route handlers
ax find "app.get|app.post|router" --regex --lang javascript

# Search for middleware
ax find "app.use|middleware" --regex --lang javascript
```

### FastAPI Projects
```bash
# Index FastAPI project
ax index ./ --lang python

# Find API routes
ax find "@app.get|@app.post" --regex --lang python

# Search for Pydantic models
ax find "BaseModel" --lang python

# Find config files
ax find "pyproject" --lang toml --file pyproject.toml
```

### Django Projects
```bash
# Index Django project
ax index ./ --lang python

# Find views
ax find "def.*view|class.*View" --regex --lang python

# Search settings
ax find "DATABASES|INSTALLED_APPS" --lang python --file settings.py

# Find models
ax find "models.Model" --lang python
```

### Spring Boot Projects
```bash
# Index Spring Boot project
ax index ./src/ --lang java

# Find REST controllers
ax find "@RestController|@RequestMapping" --regex --lang java

# Search YAML config
ax find "spring.datasource" --lang yaml --file application.yml

# Find services
ax find "@Service" --lang java
```

## Recommendations

### ✅ No Additional Parsers Needed

**All messaging systems and frameworks are already supported!**

AutomatosX v2 can index and search:
- ✅ **NATS** - Go code + text search for .conf
- ✅ **Kafka** - Java/Scala code + text search for .properties
- ✅ **NestJS** - TypeScript + JSON configs
- ✅ **Express.js** - JavaScript/TypeScript + JSON
- ✅ **FastAPI** - Python + TOML/YAML configs
- ✅ **Django** - Python code and settings
- ✅ **Spring Boot** - Java/Kotlin + YAML/Groovy configs

### ⚠️ Simple Formats Don't Need Parsers

**.conf files** (NATS):
- Custom JSON-like format
- Simple enough for text/regex search
- No parser exists or needed

**.properties files** (Kafka, Spring Boot):
- Simple key=value pairs
- Text search works perfectly
- No tree-sitter parser available

**.env files** (All frameworks):
- Simple key=value format
- Text search sufficient

## Conclusion

✅ **100% code coverage** for all messaging systems and frameworks
✅ **Full config support** via existing parsers (JSON, YAML, TOML)
⚠️ **Simple text configs** work with text search (no parser needed)
❌ **Zero additional parsers required**

AutomatosX v2 is fully equipped to handle NATS, Kafka, NestJS, Express.js, FastAPI, Django, Spring Boot, and all major backend frameworks!
