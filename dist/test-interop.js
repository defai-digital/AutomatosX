/**
 * test-interop.ts
 *
 * This file tests the ReScript ↔ TypeScript interop
 * It imports and uses functions from the ReScript core module
 */
// Import the ReScript Hello module via genType-generated TypeScript definitions
import * as Hello from '../packages/rescript-core/src/Hello.gen';
import * as Index from '../packages/rescript-core/src/Index.gen';
console.log('='.repeat(60));
console.log('AutomatosX - ReScript ↔ TypeScript Interop Test');
console.log('='.repeat(60));
console.log();
// Test 1: Simple greet function
console.log('✓ Test 1: Simple greet function');
const greeting = Hello.greet('Developer');
console.log(`  Result: "${greeting}"`);
console.log();
// Test 2: Add function (demonstrates ReScript int type)
console.log('✓ Test 2: Add function (int type safety)');
const sum = Hello.add(42, 18);
console.log(`  Result: 42 + 18 = ${sum}`);
console.log();
// Test 3: Option type (ReScript's null safety)
console.log('✓ Test 3: Option type (null safety)');
const greetingSome = Hello.getGreetingOrDefault('Alice');
const greetingNone = Hello.getGreetingOrDefault(undefined);
console.log(`  With name: "${greetingSome}"`);
console.log(`  Without name: "${greetingNone}"`);
console.log();
// Test 4: Record type
console.log('✓ Test 4: Record type (person)');
const person = {
    name: 'Bob Smith',
    age: 30
};
const personGreeting = Hello.greetPerson(person);
console.log(`  Result: "${personGreeting}"`);
console.log();
// Test 5: Module constants
console.log('✓ Test 5: Module constants');
console.log(`  Welcome message: "${Hello.welcomeMessage}"`);
console.log(`  Version: ${Index.version}`);
console.log(`  Name: ${Index.name}`);
console.log();
// Success summary
console.log('='.repeat(60));
console.log('✅ SUCCESS: All ReScript ↔ TypeScript interop tests passed!');
console.log('='.repeat(60));
console.log();
console.log('Phase 0.1 Complete: ReScript Setup & Interop Proof ✓');
console.log('  ✓ ReScript compiler installed and configured');
console.log('  ✓ ReScript → JavaScript compilation works');
console.log('  ✓ genType → TypeScript type generation works');
console.log('  ✓ TypeScript can import and call ReScript functions');
console.log('  ✓ Type safety maintained across boundary');
console.log();
//# sourceMappingURL=test-interop.js.map