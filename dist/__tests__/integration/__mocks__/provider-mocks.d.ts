/**
 * Mock implementations for provider SDKs
 * Used by integration tests to simulate provider responses
 */
/**
 * Mock Anthropic SDK
 */
export declare class MockAnthropic {
    messages: {
        create: import("vitest").Mock<any, any>;
    };
}
/**
 * Mock Google Generative AI
 */
export declare class MockGoogleGenerativeAI {
    getGenerativeModel(): {
        generateContent: import("vitest").Mock<any, any>;
    };
}
/**
 * Mock OpenAI SDK
 */
export declare class MockOpenAI {
    chat: {
        completions: {
            create: import("vitest").Mock<any, any>;
        };
    };
}
/**
 * Set up all provider mocks
 */
export declare function setupProviderMocks(): void;
//# sourceMappingURL=provider-mocks.d.ts.map