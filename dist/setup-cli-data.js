/**
 * test-cli-data.ts
 *
 * Script to create test data for Phase 0.4 CLI validation
 * Indexes sample TypeScript files and tests ax find command
 */
import { FileService } from './services/FileService.js';
import { runMigrations } from './database/migrations.js';
import { closeDatabase } from './database/connection.js';
// Sample TypeScript files to index
const sampleFiles = [
    {
        path: 'src/utils/calculator.ts',
        content: `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export const PI = 3.14159;
export const E = 2.71828;
`,
        language: 'typescript',
    },
    {
        path: 'src/models/User.ts',
        content: `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

export class UserManager {
  private users: Map<string, User> = new Map();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  removeUser(id: string): boolean {
    return this.users.delete(id);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
}

export function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}
`,
        language: 'typescript',
    },
    {
        path: 'src/services/AuthService.ts',
        content: `
export interface AuthToken {
  token: string;
  expiresAt: Date;
}

export class AuthService {
  private tokens: Map<string, AuthToken> = new Map();

  login(userId: string): AuthToken {
    const token = this.generateToken();
    const authToken: AuthToken = {
      token,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };
    this.tokens.set(userId, authToken);
    return authToken;
  }

  logout(userId: string): void {
    this.tokens.delete(userId);
  }

  validateToken(userId: string, token: string): boolean {
    const authToken = this.tokens.get(userId);
    if (!authToken) return false;
    if (authToken.expiresAt < new Date()) return false;
    return authToken.token === token;
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}
`,
        language: 'typescript',
    },
];
async function main() {
    console.log('=== Phase 0.5 FTS5 Test Data Setup ===\n');
    // Step 1: Run migrations
    console.log('1. Running migrations...');
    const migrationsApplied = runMigrations();
    console.log(`   ✓ ${migrationsApplied} migrations applied\n`);
    // Step 2: Index sample files
    console.log('2. Indexing sample files...');
    const fileService = new FileService();
    for (const file of sampleFiles) {
        console.log(`   Indexing: ${file.path}`);
        // Try to reindex if file exists, otherwise index new
        try {
            const result = fileService.reindexFile(file.path, file.content);
            console.log(`   ✓ Re-indexed: File ID ${result.fileId}, Symbols: ${result.symbolCount}, Chunks: ${result.chunkCount}, Time: ${result.totalTime.toFixed(2)}ms`);
        }
        catch (error) {
            // File doesn't exist, index as new (language auto-detected from path)
            const result = fileService.indexFile(file.path, file.content);
            console.log(`   ✓ Indexed: File ID ${result.fileId}, Symbols: ${result.symbolCount}, Chunks: ${result.chunkCount}, Time: ${result.totalTime.toFixed(2)}ms`);
        }
    }
    // Step 3: Display statistics
    console.log('\n3. Database Statistics:');
    const stats = fileService.getStats();
    console.log(`   Total Files: ${stats.totalFiles}`);
    console.log(`   Total Symbols: ${stats.totalSymbols}`);
    console.log(`   Total Chunks: ${stats.totalChunks}`);
    console.log('   Symbols by Kind:');
    for (const [kind, count] of Object.entries(stats.symbolsByKind)) {
        console.log(`     - ${kind}: ${count}`);
    }
    console.log('   Chunks by Type:');
    for (const [type, count] of Object.entries(stats.chunksByType)) {
        console.log(`     - ${type}: ${count}`);
    }
    // Step 4: Test symbol search functionality
    console.log('\n4. Testing symbol search:');
    const testQueries = [
        'Calculator',
        'User',
        'AuthService',
        'login',
        'validateEmail',
    ];
    for (const query of testQueries) {
        const results = fileService.searchSymbols(query);
        console.log(`   Symbol "${query}": ${results.length} result(s)`);
        for (const result of results) {
            console.log(`     - ${result.kind} ${result.name} at ${result.file_path}:${result.line}`);
        }
    }
    // Step 5: Test natural language search (FTS5)
    console.log('\n5. Testing natural language search (FTS5):');
    const nlQueries = [
        'authentication',
        'user AND email',
        'calculate OR math',
        'token',
    ];
    for (const query of nlQueries) {
        const results = fileService.searchNaturalLanguage(query, 5);
        console.log(`   FTS5 "${query}": ${results.length} result(s)`);
        for (const result of results) {
            const snippet = result.content.substring(0, 60).replace(/\n/g, ' ');
            console.log(`     - ${result.chunk_type} at ${result.file_path}:${result.start_line} [rank: ${result.rank.toFixed(2)}]`);
            console.log(`       "${snippet}..."`);
        }
    }
    console.log('\n✓ Test data created successfully!');
    console.log('\nNext steps (Symbol Search):');
    console.log('  1. npm run cli find Calculator');
    console.log('  2. npm run cli find User');
    console.log('  3. npm run cli find login --kind method');
    console.log('\nNext steps (Natural Language Search):');
    console.log('  4. npm run cli find "authentication" --natural');
    console.log('  5. npm run cli find "user AND email" --natural');
    console.log('  6. npm run cli find "calculate math" --natural');
    // Clean up
    closeDatabase();
}
main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
//# sourceMappingURL=setup-cli-data.js.map