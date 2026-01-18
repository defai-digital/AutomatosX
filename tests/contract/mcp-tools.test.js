import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { 
// Guard tool schemas
GuardCheckInputSchema, GuardCheckOutputSchema, GuardListInputSchema, GuardListOutputSchema, GuardApplyInputSchema, GuardApplyOutputSchema, GateResultSchema, PolicySummarySchema, GuardToolErrorCode, validateGuardCheckInput, safeValidateGuardCheckInput, 
// Agent tool schemas
AgentListInputSchema, AgentListOutputSchema, AgentRunInputSchema, AgentRunOutputSchema, AgentGetInputSchema, AgentGetOutputSchema, AgentRegisterInputSchema, AgentRegisterOutputSchema, AgentRemoveInputSchema, AgentRemoveOutputSchema, AgentSummarySchema, AgentStepResultSchema, AgentToolErrorCode, validateAgentListInput, validateAgentRunInput, validateAgentGetInput, safeValidateAgentRunInput, 
// Session tool schemas
SessionCreateInputSchema, SessionCreateOutputSchema, SessionStatusInputSchema, SessionStatusOutputSchema, SessionCompleteInputSchema, SessionCompleteOutputSchema, SessionListInputSchema, SessionListOutputSchema, SessionJoinInputSchema, SessionJoinOutputSchema, SessionLeaveInputSchema, SessionLeaveOutputSchema, SessionFailInputSchema, SessionFailOutputSchema, SessionSummarySchema, SessionParticipantSummarySchema, SessionToolErrorCode, validateSessionCreateInput, validateSessionStatusInput, safeValidateSessionCreateInput, safeValidateSessionStatusInput, 
// Memory tool schemas
MemoryStoreInputSchema, MemoryStoreOutputSchema, MemoryRetrieveInputSchema, MemoryRetrieveOutputSchema, MemorySearchInputSchema, MemorySearchOutputSchema, MemoryListInputSchema, MemoryListOutputSchema, MemoryDeleteInputSchema, MemoryDeleteOutputSchema, MemorySearchResultSchema, MemoryKeyInfoSchema, MemoryToolErrorCode, validateMemoryStoreInput, validateMemoryRetrieveInput, validateMemorySearchInput, validateMemoryListInput, validateMemoryDeleteInput, safeValidateMemoryStoreInput, } from '@defai.digital/contracts';
// ============================================================================
// Guard Tool Contract Tests
// ============================================================================
describe('MCP Tool Contracts - Guard', () => {
    describe('guard_check', () => {
        describe('input validation', () => {
            it('should validate valid guard_check input', () => {
                const input = {
                    policyId: 'default-policy',
                    changedPaths: ['src/main.ts', 'package.json'],
                    target: 'feature-branch',
                };
                const result = GuardCheckInputSchema.safeParse(input);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.policyId).toBe('default-policy');
                    expect(result.data.changedPaths).toHaveLength(2);
                }
            });
            it('should reject invalid policy ID format', () => {
                const input = {
                    policyId: 'Invalid_Policy',
                    changedPaths: ['src/main.ts'],
                };
                const result = GuardCheckInputSchema.safeParse(input);
                expect(result.success).toBe(false);
            });
            it('should reject empty changedPaths array', () => {
                const input = {
                    policyId: 'my-policy',
                    changedPaths: [],
                };
                const result = GuardCheckInputSchema.safeParse(input);
                expect(result.success).toBe(false);
            });
            it('should enforce policy ID length limit', () => {
                const input = {
                    policyId: 'a'.repeat(65),
                    changedPaths: ['src/main.ts'],
                };
                const result = GuardCheckInputSchema.safeParse(input);
                expect(result.success).toBe(false);
            });
            it('should use validateGuardCheckInput for throwing validation', () => {
                expect(() => validateGuardCheckInput({ policyId: 'INVALID', changedPaths: [] })).toThrow();
            });
            it('should use safeValidateGuardCheckInput for safe validation', () => {
                const result = safeValidateGuardCheckInput({
                    policyId: 'valid-policy',
                    changedPaths: ['file.ts'],
                });
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate valid guard_check output', () => {
                const output = {
                    status: 'PASS',
                    policyId: 'default-policy',
                    target: 'main',
                    gates: [
                        {
                            gate: 'path-allowlist',
                            status: 'PASS',
                            message: 'All paths allowed',
                        },
                    ],
                    summary: 'All gates passed',
                    suggestions: [],
                    timestamp: new Date().toISOString(),
                };
                const result = GuardCheckOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate gate results with details', () => {
                const gateResult = {
                    gate: 'change-radius',
                    status: 'WARN',
                    message: 'High change radius detected',
                    details: { filesChanged: 25, limit: 20 },
                };
                const result = GateResultSchema.safeParse(gateResult);
                expect(result.success).toBe(true);
            });
            it('should reject invalid status values', () => {
                const output = {
                    status: 'UNKNOWN',
                    policyId: 'policy',
                    target: '',
                    gates: [],
                    summary: '',
                    suggestions: [],
                    timestamp: new Date().toISOString(),
                };
                const result = GuardCheckOutputSchema.safeParse(output);
                expect(result.success).toBe(false);
            });
        });
    });
    describe('guard_list', () => {
        describe('input validation', () => {
            it('should validate empty input with defaults', () => {
                const result = GuardListInputSchema.safeParse({});
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(20);
                }
            });
            it('should validate custom limit', () => {
                const input = { limit: 50 };
                const result = GuardListInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject limit over 100', () => {
                const result = GuardListInputSchema.safeParse({ limit: 150 });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid guard_list output', () => {
                const output = {
                    policies: [
                        {
                            policyId: 'default',
                            allowedPaths: ['src/**', 'tests/**'],
                            forbiddenPaths: ['node_modules/**'],
                            gates: ['path-allowlist', 'change-radius'],
                            changeRadiusLimit: 20,
                        },
                    ],
                    total: 1,
                };
                const result = GuardListOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate policy summary schema', () => {
                const policy = {
                    policyId: 'strict',
                    allowedPaths: [],
                    forbiddenPaths: ['**/*.secret'],
                    gates: [],
                    changeRadiusLimit: 10,
                };
                const result = PolicySummarySchema.safeParse(policy);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('guard_apply', () => {
        describe('input validation', () => {
            it('should validate valid guard_apply input', () => {
                const input = {
                    sessionId: randomUUID(),
                    policyId: 'my-policy',
                };
                const result = GuardApplyInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject invalid session UUID', () => {
                const result = GuardApplyInputSchema.safeParse({
                    sessionId: 'not-a-uuid',
                    policyId: 'policy',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid guard_apply output', () => {
                const output = {
                    applied: true,
                    sessionId: randomUUID(),
                    policyId: 'my-policy',
                    message: 'Policy applied successfully',
                };
                const result = GuardApplyOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('error codes', () => {
        it('should have all expected guard error codes', () => {
            expect(GuardToolErrorCode.POLICY_NOT_FOUND).toBe('POLICY_NOT_FOUND');
            expect(GuardToolErrorCode.GATE_EXECUTION_FAILED).toBe('GATE_EXECUTION_FAILED');
            expect(GuardToolErrorCode.INVALID_PATH_PATTERN).toBe('INVALID_PATH_PATTERN');
            expect(GuardToolErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
            expect(GuardToolErrorCode.POLICY_ALREADY_APPLIED).toBe('POLICY_ALREADY_APPLIED');
        });
    });
});
// ============================================================================
// Agent Tool Contract Tests
// ============================================================================
describe('MCP Tool Contracts - Agent', () => {
    describe('agent_list', () => {
        describe('input validation', () => {
            it('should validate empty input with defaults', () => {
                const result = AgentListInputSchema.safeParse({});
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(50);
                }
            });
            it('should validate filtering by team', () => {
                const input = {
                    team: 'backend',
                    enabled: true,
                    limit: 10,
                };
                const result = AgentListInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate valid agent_list output', () => {
                const output = {
                    agents: [
                        {
                            agentId: 'code-reviewer',
                            displayName: 'Code Reviewer',
                            description: 'Reviews code for quality',
                            team: 'quality',
                            enabled: true,
                            capabilities: ['code-analysis', 'review'],
                        },
                    ],
                    total: 1,
                };
                const result = AgentListOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate agent summary schema', () => {
                const agent = {
                    agentId: 'test-agent',
                    description: 'Test agent',
                    enabled: false,
                };
                const result = AgentSummarySchema.safeParse(agent);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('agent_run', () => {
        describe('input validation', () => {
            it('should validate valid agent_run input', () => {
                const input = {
                    agentId: 'my-agent',
                    input: { query: 'test' },
                    sessionId: randomUUID(),
                };
                const result = AgentRunInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject invalid agent ID format', () => {
                const result = AgentRunInputSchema.safeParse({
                    agentId: '123-invalid',
                });
                expect(result.success).toBe(false);
            });
            it('should accept agent ID with underscores and dashes', () => {
                const result = AgentRunInputSchema.safeParse({
                    agentId: 'my_agent-v2',
                });
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate successful agent_run output', () => {
                const output = {
                    success: true,
                    agentId: 'my-agent',
                    sessionId: randomUUID(),
                    output: { result: 'completed' },
                    stepResults: [
                        { stepId: 'step-1', success: true, durationMs: 100 },
                    ],
                    totalDurationMs: 150,
                };
                const result = AgentRunOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate failed agent_run output with error', () => {
                const output = {
                    success: false,
                    agentId: 'my-agent',
                    totalDurationMs: 50,
                    error: {
                        code: 'AGENT_STAGE_FAILED',
                        message: 'Step execution failed',
                    },
                };
                const result = AgentRunOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate step result schema', () => {
                const step = {
                    stepId: 'analyze',
                    success: true,
                    durationMs: 500,
                };
                const result = AgentStepResultSchema.safeParse(step);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('agent_get', () => {
        describe('input validation', () => {
            it('should validate valid agent_get input', () => {
                const input = { agentId: 'code-reviewer' };
                const result = AgentGetInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate full agent_get output', () => {
                const output = {
                    agentId: 'code-reviewer',
                    displayName: 'Code Reviewer',
                    version: '1.0.0',
                    description: 'Reviews code for quality issues',
                    role: 'reviewer',
                    expertise: ['typescript', 'testing'],
                    capabilities: ['code-analysis'],
                    team: 'quality',
                    tags: ['core', 'automated'],
                    enabled: true,
                    workflow: [
                        { stepId: 'analyze', name: 'Analyze Code', type: 'tool' },
                        { stepId: 'report', name: 'Generate Report', type: 'llm' },
                    ],
                    orchestration: {
                        maxDelegationDepth: 2,
                        canReadWorkspaces: ['shared'],
                        canWriteToShared: false,
                    },
                };
                const result = AgentGetOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('agent_register', () => {
        describe('input validation', () => {
            it('should validate valid agent_register input', () => {
                const input = {
                    agentId: 'new-agent',
                    description: 'A new test agent',
                    displayName: 'New Agent',
                    team: 'test',
                    capabilities: ['testing'],
                    enabled: true,
                };
                const result = AgentRegisterInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should require description', () => {
                const result = AgentRegisterInputSchema.safeParse({
                    agentId: 'agent',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate agent_register output', () => {
                const output = {
                    registered: true,
                    agentId: 'new-agent',
                    message: 'Agent registered successfully',
                    createdAt: new Date().toISOString(),
                };
                const result = AgentRegisterOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('agent_remove', () => {
        describe('input validation', () => {
            it('should validate valid agent_remove input', () => {
                const input = { agentId: 'old-agent' };
                const result = AgentRemoveInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate agent_remove output', () => {
                const output = {
                    removed: true,
                    agentId: 'old-agent',
                    message: 'Agent removed successfully',
                };
                const result = AgentRemoveOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('error codes', () => {
        it('should have all expected agent error codes', () => {
            expect(AgentToolErrorCode.AGENT_NOT_FOUND).toBe('AGENT_NOT_FOUND');
            expect(AgentToolErrorCode.AGENT_PERMISSION_DENIED).toBe('AGENT_PERMISSION_DENIED');
            expect(AgentToolErrorCode.AGENT_STAGE_FAILED).toBe('AGENT_STAGE_FAILED');
            expect(AgentToolErrorCode.AGENT_DELEGATION_DEPTH_EXCEEDED).toBe('AGENT_DELEGATION_DEPTH_EXCEEDED');
            expect(AgentToolErrorCode.AGENT_ALREADY_EXISTS).toBe('AGENT_ALREADY_EXISTS');
            expect(AgentToolErrorCode.AGENT_REMOVE_FAILED).toBe('AGENT_REMOVE_FAILED');
        });
    });
    describe('validation functions', () => {
        it('should use validateAgentListInput', () => {
            const input = validateAgentListInput({});
            expect(input.limit).toBe(50);
        });
        it('should use validateAgentRunInput', () => {
            expect(() => validateAgentRunInput({ agentId: '123' })).toThrow();
        });
        it('should use validateAgentGetInput', () => {
            const input = validateAgentGetInput({ agentId: 'valid-agent' });
            expect(input.agentId).toBe('valid-agent');
        });
        it('should use safeValidateAgentRunInput', () => {
            const result = safeValidateAgentRunInput({ agentId: 'valid-agent' });
            expect(result.success).toBe(true);
        });
    });
});
// ============================================================================
// Session Tool Contract Tests
// ============================================================================
describe('MCP Tool Contracts - Session', () => {
    describe('session_create', () => {
        describe('input validation', () => {
            it('should validate valid session_create input', () => {
                const input = {
                    initiator: 'user-agent',
                    task: 'Implement feature X',
                    workspace: '/project/workspace',
                    metadata: { priority: 'high' },
                };
                const result = SessionCreateInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject empty initiator', () => {
                const result = SessionCreateInputSchema.safeParse({
                    initiator: '',
                    task: 'test',
                });
                expect(result.success).toBe(false);
            });
            it('should reject empty task', () => {
                const result = SessionCreateInputSchema.safeParse({
                    initiator: 'agent',
                    task: '',
                });
                expect(result.success).toBe(false);
            });
            it('should enforce task length limit', () => {
                const result = SessionCreateInputSchema.safeParse({
                    initiator: 'agent',
                    task: 'x'.repeat(5001),
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_create output', () => {
                const output = {
                    sessionId: randomUUID(),
                    initiator: 'user-agent',
                    task: 'Test task',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    workspace: '/project',
                };
                const result = SessionCreateOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should require status to be active', () => {
                const output = {
                    sessionId: randomUUID(),
                    initiator: 'agent',
                    task: 'task',
                    status: 'completed',
                    createdAt: new Date().toISOString(),
                };
                const result = SessionCreateOutputSchema.safeParse(output);
                expect(result.success).toBe(false);
            });
        });
    });
    describe('session_status', () => {
        describe('input validation', () => {
            it('should validate valid session_status input', () => {
                const input = { sessionId: randomUUID() };
                const result = SessionStatusInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject non-UUID sessionId', () => {
                const result = SessionStatusInputSchema.safeParse({
                    sessionId: 'invalid',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_status output', () => {
                const output = {
                    sessionId: randomUUID(),
                    status: 'active',
                    initiator: 'main-agent',
                    task: 'Running tests',
                    participants: [
                        {
                            agentId: 'test-runner',
                            role: 'collaborator',
                            joinedAt: new Date().toISOString(),
                            taskCount: 5,
                        },
                    ],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                const result = SessionStatusOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate participant summary schema', () => {
                const participant = {
                    agentId: 'helper',
                    role: 'delegate',
                    joinedAt: new Date().toISOString(),
                    taskCount: 0,
                };
                const result = SessionParticipantSummarySchema.safeParse(participant);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('session_complete', () => {
        describe('input validation', () => {
            it('should validate valid session_complete input', () => {
                const input = {
                    sessionId: randomUUID(),
                    summary: 'Task completed successfully',
                };
                const result = SessionCompleteInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should allow input without summary', () => {
                const result = SessionCompleteInputSchema.safeParse({
                    sessionId: randomUUID(),
                });
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_complete output', () => {
                const output = {
                    sessionId: randomUUID(),
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    summary: 'All tasks done',
                };
                const result = SessionCompleteOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('session_list', () => {
        describe('input validation', () => {
            it('should validate empty input with defaults', () => {
                const result = SessionListInputSchema.safeParse({});
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(20);
                }
            });
            it('should validate filtering by status', () => {
                const input = {
                    status: 'active',
                    initiator: 'main-agent',
                    limit: 10,
                };
                const result = SessionListInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject invalid status values', () => {
                const result = SessionListInputSchema.safeParse({
                    status: 'running',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_list output', () => {
                const output = {
                    sessions: [
                        {
                            sessionId: randomUUID(),
                            initiator: 'agent',
                            task: 'Test',
                            status: 'active',
                            participantCount: 2,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    total: 1,
                };
                const result = SessionListOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate session summary schema', () => {
                const session = {
                    sessionId: randomUUID(),
                    initiator: 'test',
                    task: 'Test task',
                    status: 'completed',
                    participantCount: 1,
                    createdAt: new Date().toISOString(),
                };
                const result = SessionSummarySchema.safeParse(session);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('session_join', () => {
        describe('input validation', () => {
            it('should validate valid session_join input', () => {
                const input = {
                    sessionId: randomUUID(),
                    agentId: 'helper-agent',
                    role: 'collaborator',
                };
                const result = SessionJoinInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should accept delegate role', () => {
                const input = {
                    sessionId: randomUUID(),
                    agentId: 'sub-agent',
                    role: 'delegate',
                };
                const result = SessionJoinInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject invalid role', () => {
                const result = SessionJoinInputSchema.safeParse({
                    sessionId: randomUUID(),
                    agentId: 'agent',
                    role: 'owner',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_join output', () => {
                const output = {
                    sessionId: randomUUID(),
                    agentId: 'helper',
                    role: 'collaborator',
                    joinedAt: new Date().toISOString(),
                    participantCount: 3,
                };
                const result = SessionJoinOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('session_leave', () => {
        describe('input validation', () => {
            it('should validate valid session_leave input', () => {
                const input = {
                    sessionId: randomUUID(),
                    agentId: 'leaving-agent',
                };
                const result = SessionLeaveInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_leave output', () => {
                const output = {
                    sessionId: randomUUID(),
                    agentId: 'left-agent',
                    leftAt: new Date().toISOString(),
                    remainingParticipants: 1,
                };
                const result = SessionLeaveOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('session_fail', () => {
        describe('input validation', () => {
            it('should validate valid session_fail input', () => {
                const input = {
                    sessionId: randomUUID(),
                    error: {
                        code: 'TASK_FAILED',
                        message: 'Unable to complete task',
                        taskId: 'task-123',
                        details: { reason: 'timeout' },
                    },
                };
                const result = SessionFailInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should require error code and message', () => {
                const result = SessionFailInputSchema.safeParse({
                    sessionId: randomUUID(),
                    error: { code: 'ERR' },
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid session_fail output', () => {
                const output = {
                    sessionId: randomUUID(),
                    status: 'failed',
                    failedAt: new Date().toISOString(),
                    error: {
                        code: 'TASK_FAILED',
                        message: 'Task failed',
                    },
                };
                const result = SessionFailOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('error codes', () => {
        it('should have all expected session error codes', () => {
            expect(SessionToolErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
            expect(SessionToolErrorCode.SESSION_ALREADY_COMPLETED).toBe('SESSION_ALREADY_COMPLETED');
            expect(SessionToolErrorCode.SESSION_INVALID_TRANSITION).toBe('SESSION_INVALID_TRANSITION');
            expect(SessionToolErrorCode.SESSION_MAX_PARTICIPANTS).toBe('SESSION_MAX_PARTICIPANTS');
            expect(SessionToolErrorCode.SESSION_AGENT_NOT_PARTICIPANT).toBe('SESSION_AGENT_NOT_PARTICIPANT');
            expect(SessionToolErrorCode.SESSION_INITIATOR_CANNOT_LEAVE).toBe('SESSION_INITIATOR_CANNOT_LEAVE');
        });
    });
    describe('validation functions', () => {
        it('should use validateSessionCreateInput', () => {
            const input = validateSessionCreateInput({
                initiator: 'agent',
                task: 'test task',
            });
            expect(input.initiator).toBe('agent');
        });
        it('should use safeValidateSessionCreateInput', () => {
            const result = safeValidateSessionCreateInput({
                initiator: '',
                task: '',
            });
            expect(result.success).toBe(false);
        });
        it('should use validateSessionStatusInput', () => {
            const sessionId = randomUUID();
            const input = validateSessionStatusInput({ sessionId });
            expect(input.sessionId).toBe(sessionId);
        });
        it('should use safeValidateSessionStatusInput', () => {
            const result = safeValidateSessionStatusInput({ sessionId: 'invalid' });
            expect(result.success).toBe(false);
        });
    });
});
// ============================================================================
// Memory Tool Contract Tests
// ============================================================================
describe('MCP Tool Contracts - Memory', () => {
    describe('memory_store', () => {
        describe('input validation', () => {
            it('should validate valid memory_store input', () => {
                const input = {
                    key: 'user-preferences',
                    value: { theme: 'dark', language: 'en' },
                    namespace: 'settings',
                };
                const result = MemoryStoreInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should reject empty key', () => {
                const result = MemoryStoreInputSchema.safeParse({
                    key: '',
                    value: {},
                });
                expect(result.success).toBe(false);
            });
            it('should enforce key length limit', () => {
                const result = MemoryStoreInputSchema.safeParse({
                    key: 'k'.repeat(501),
                    value: {},
                });
                expect(result.success).toBe(false);
            });
            it('should require value to be an object', () => {
                const result = MemoryStoreInputSchema.safeParse({
                    key: 'test',
                    value: 'string-value',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid memory_store output', () => {
                const output = {
                    success: true,
                    key: 'test-key',
                    namespace: 'default',
                    message: 'Stored successfully',
                };
                const result = MemoryStoreOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('memory_retrieve', () => {
        describe('input validation', () => {
            it('should validate valid memory_retrieve input', () => {
                const input = {
                    key: 'my-key',
                    namespace: 'app',
                };
                const result = MemoryRetrieveInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should allow input without namespace', () => {
                const result = MemoryRetrieveInputSchema.safeParse({
                    key: 'test',
                });
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate found memory_retrieve output', () => {
                const output = {
                    found: true,
                    key: 'test',
                    namespace: 'default',
                    value: { data: 'test' },
                    storedAt: new Date().toISOString(),
                };
                const result = MemoryRetrieveOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate not found memory_retrieve output', () => {
                const output = {
                    found: false,
                    key: 'missing',
                    namespace: 'default',
                    message: 'Key not found',
                };
                const result = MemoryRetrieveOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('memory_search', () => {
        describe('input validation', () => {
            it('should validate valid memory_search input', () => {
                const input = {
                    query: 'user settings',
                    namespace: 'app',
                    limit: 20,
                };
                const result = MemorySearchInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
            it('should apply default limit', () => {
                const result = MemorySearchInputSchema.safeParse({
                    query: 'test',
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(10);
                }
            });
            it('should reject empty query', () => {
                const result = MemorySearchInputSchema.safeParse({
                    query: '',
                });
                expect(result.success).toBe(false);
            });
        });
        describe('output validation', () => {
            it('should validate valid memory_search output', () => {
                const output = {
                    query: 'settings',
                    namespace: 'default',
                    count: 2,
                    results: [
                        {
                            key: 'user-settings',
                            namespace: 'default',
                            value: { theme: 'light' },
                            storedAt: new Date().toISOString(),
                        },
                        {
                            key: 'app-settings',
                            namespace: 'default',
                            value: { version: '1.0' },
                            storedAt: new Date().toISOString(),
                        },
                    ],
                };
                const result = MemorySearchOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate search result schema', () => {
                const searchResult = {
                    key: 'test',
                    namespace: 'ns',
                    value: {},
                    storedAt: new Date().toISOString(),
                };
                const result = MemorySearchResultSchema.safeParse(searchResult);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('memory_list', () => {
        describe('input validation', () => {
            it('should validate empty input with defaults', () => {
                const result = MemoryListInputSchema.safeParse({});
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(100);
                }
            });
            it('should validate filtering by prefix', () => {
                const input = {
                    namespace: 'app',
                    prefix: 'user-',
                    limit: 50,
                };
                const result = MemoryListInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate valid memory_list output', () => {
                const output = {
                    keys: [
                        {
                            key: 'key1',
                            namespace: 'default',
                            storedAt: new Date().toISOString(),
                        },
                        {
                            key: 'key2',
                            namespace: 'default',
                            storedAt: new Date().toISOString(),
                        },
                    ],
                    total: 2,
                    hasMore: false,
                };
                const result = MemoryListOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate key info schema', () => {
                const keyInfo = {
                    key: 'test-key',
                    namespace: 'ns',
                    storedAt: new Date().toISOString(),
                };
                const result = MemoryKeyInfoSchema.safeParse(keyInfo);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('memory_delete', () => {
        describe('input validation', () => {
            it('should validate valid memory_delete input', () => {
                const input = {
                    key: 'old-key',
                    namespace: 'temp',
                };
                const result = MemoryDeleteInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            });
        });
        describe('output validation', () => {
            it('should validate successful memory_delete output', () => {
                const output = {
                    deleted: true,
                    key: 'old-key',
                    namespace: 'temp',
                    message: 'Deleted successfully',
                };
                const result = MemoryDeleteOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
            it('should validate not found memory_delete output', () => {
                const output = {
                    deleted: false,
                    key: 'missing',
                    namespace: 'default',
                    message: 'Key not found',
                };
                const result = MemoryDeleteOutputSchema.safeParse(output);
                expect(result.success).toBe(true);
            });
        });
    });
    describe('error codes', () => {
        it('should have all expected memory error codes', () => {
            expect(MemoryToolErrorCode.KEY_NOT_FOUND).toBe('KEY_NOT_FOUND');
            expect(MemoryToolErrorCode.STORE_FAILED).toBe('STORE_FAILED');
            expect(MemoryToolErrorCode.DELETE_FAILED).toBe('DELETE_FAILED');
            expect(MemoryToolErrorCode.SEARCH_FAILED).toBe('SEARCH_FAILED');
            expect(MemoryToolErrorCode.NAMESPACE_NOT_FOUND).toBe('NAMESPACE_NOT_FOUND');
            expect(MemoryToolErrorCode.INVALID_KEY).toBe('INVALID_KEY');
        });
    });
    describe('validation functions', () => {
        it('should use validateMemoryStoreInput', () => {
            const input = validateMemoryStoreInput({
                key: 'test',
                value: { data: 1 },
            });
            expect(input.key).toBe('test');
        });
        it('should use safeValidateMemoryStoreInput', () => {
            const result = safeValidateMemoryStoreInput({
                key: '',
                value: {},
            });
            expect(result.success).toBe(false);
        });
        it('should use validateMemoryRetrieveInput', () => {
            const input = validateMemoryRetrieveInput({ key: 'my-key' });
            expect(input.key).toBe('my-key');
        });
        it('should use validateMemorySearchInput', () => {
            const input = validateMemorySearchInput({ query: 'test' });
            expect(input.query).toBe('test');
        });
        it('should use validateMemoryListInput', () => {
            const input = validateMemoryListInput({});
            expect(input.limit).toBe(100);
        });
        it('should use validateMemoryDeleteInput', () => {
            const input = validateMemoryDeleteInput({ key: 'delete-me' });
            expect(input.key).toBe('delete-me');
        });
    });
});
// ============================================================================
// Cross-Tool Contract Tests
// ============================================================================
describe('MCP Tool Contracts - Cross-Tool', () => {
    describe('UUID validation consistency', () => {
        it('should use consistent UUID validation across all tools', () => {
            const validUuid = randomUUID();
            const invalidUuid = 'not-a-uuid';
            // All tools should accept valid UUIDs
            expect(GuardApplyInputSchema.safeParse({ sessionId: validUuid, policyId: 'p' }).success).toBe(true);
            expect(AgentRunInputSchema.safeParse({ agentId: 'a', sessionId: validUuid }).success).toBe(true);
            expect(SessionStatusInputSchema.safeParse({ sessionId: validUuid }).success).toBe(true);
            // All tools should reject invalid UUIDs
            expect(GuardApplyInputSchema.safeParse({ sessionId: invalidUuid, policyId: 'p' }).success).toBe(false);
            expect(AgentRunInputSchema.safeParse({ agentId: 'a', sessionId: invalidUuid }).success).toBe(false);
            expect(SessionStatusInputSchema.safeParse({ sessionId: invalidUuid }).success).toBe(false);
        });
    });
    describe('datetime validation consistency', () => {
        it('should use consistent datetime format across all outputs', () => {
            const validDatetime = new Date().toISOString();
            // Guard output
            const guardOutput = {
                status: 'PASS',
                policyId: 'p',
                target: '',
                gates: [],
                summary: '',
                suggestions: [],
                timestamp: validDatetime,
            };
            expect(GuardCheckOutputSchema.safeParse(guardOutput).success).toBe(true);
            // Session output
            const sessionOutput = {
                sessionId: randomUUID(),
                initiator: 'a',
                task: 't',
                status: 'active',
                createdAt: validDatetime,
            };
            expect(SessionCreateOutputSchema.safeParse(sessionOutput).success).toBe(true);
            // Memory output
            const memoryOutput = {
                found: true,
                key: 'k',
                namespace: 'n',
                value: {},
                storedAt: validDatetime,
            };
            expect(MemoryRetrieveOutputSchema.safeParse(memoryOutput).success).toBe(true);
        });
    });
    describe('limit parameter consistency', () => {
        it('should enforce reasonable limits across list tools', () => {
            // All should accept reasonable limits
            expect(GuardListInputSchema.safeParse({ limit: 50 }).success).toBe(true);
            expect(AgentListInputSchema.safeParse({ limit: 50 }).success).toBe(true);
            expect(SessionListInputSchema.safeParse({ limit: 50 }).success).toBe(true);
            expect(MemoryListInputSchema.safeParse({ limit: 50 }).success).toBe(true);
            // All should reject negative limits
            expect(GuardListInputSchema.safeParse({ limit: -1 }).success).toBe(false);
            expect(AgentListInputSchema.safeParse({ limit: -1 }).success).toBe(false);
            expect(SessionListInputSchema.safeParse({ limit: -1 }).success).toBe(false);
            expect(MemoryListInputSchema.safeParse({ limit: -1 }).success).toBe(false);
        });
    });
});
//# sourceMappingURL=mcp-tools.test.js.map