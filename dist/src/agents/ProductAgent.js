/**
 * ProductAgent.ts
 *
 * Product management specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
/**
 * ProductAgent - Product management specialist
 *
 * Specializes in:
 * - Product requirements (PRDs)
 * - Feature specifications
 * - User stories and acceptance criteria
 * - Product strategy and roadmap
 * - Stakeholder communication
 */
export class ProductAgent extends AgentBase {
    constructor() {
        super({
            type: 'product',
            name: 'Product Manager (Paris)',
            description: 'Expert in product management, PRDs, feature specs, user stories, and product strategy. Specializes in defining clear product requirements.',
            capabilities: [
                {
                    name: 'PRDs',
                    description: 'Write Product Requirements Documents',
                    keywords: ['prd', 'product requirements', 'requirements', 'specification', 'spec'],
                },
                {
                    name: 'User Stories',
                    description: 'Create user stories with acceptance criteria',
                    keywords: ['user story', 'acceptance', 'criteria', 'epic', 'feature'],
                },
                {
                    name: 'Feature Design',
                    description: 'Design and specify product features',
                    keywords: ['feature', 'functionality', 'capability', 'use case'],
                },
                {
                    name: 'Product Strategy',
                    description: 'Define product vision and roadmap',
                    keywords: ['strategy', 'roadmap', 'vision', 'goals', 'objectives', 'okr'],
                },
                {
                    name: 'Stakeholder Communication',
                    description: 'Communicate with stakeholders',
                    keywords: ['stakeholder', 'communication', 'presentation', 'alignment'],
                },
            ],
            specializations: [
                'PRDs',
                'User Stories',
                'Feature Specs',
                'Product Strategy',
                'Roadmapping',
                'Stakeholder Management',
                'Agile/Scrum',
                'Product Analytics',
            ],
            temperature: 0.7,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            const suggestion = this.suggestDelegation(task);
            return {
                success: false,
                message: `This task is outside my product management specialization. Consider @${suggestion} agent.`,
                metadata: { capabilityScore: capability, suggestedAgent: suggestion },
            };
        }
        context.monitoring.log('info', `Product agent handling: ${task.description}`);
        try {
            // Search for existing PRDs and specs
            const existingDocs = await context.codeIntelligence.searchCode('prd feature specification');
            // Check past product decisions
            const pastDecisions = await context.memory.search('product feature prd roadmap');
            const prompt = this.buildProductPrompt(task, context, existingDocs.slice(0, 3), pastDecisions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseProductArtifacts(response);
            await context.memory.store({
                type: 'product_document',
                agent: this.metadata.type,
                task: task.description,
                response,
                artifacts: artifacts.map((a) => ({ type: a.type, name: a.name })),
                timestamp: Date.now(),
            });
            return {
                success: true,
                data: response,
                artifacts,
                metadata: {
                    agent: this.metadata.type,
                    capabilityScore: capability,
                    category: 'product-management',
                },
            };
        }
        catch (error) {
            context.monitoring.log('error', `Product agent failed: ${error}`);
            throw error;
        }
    }
    buildProductPrompt(task, context, existingDocs, pastDecisions) {
        let prompt = this.buildPrompt(task, context);
        if (existingDocs.length > 0) {
            prompt += '\n\nExisting product documents:\n';
            existingDocs.forEach((doc, idx) => {
                prompt += `${idx + 1}. ${JSON.stringify(doc).slice(0, 200)}...\n`;
            });
        }
        if (pastDecisions.length > 0) {
            prompt += '\n\nPast product decisions:\n';
            pastDecisions.forEach((decision, idx) => {
                prompt += `${idx + 1}. ${JSON.stringify(decision).slice(0, 150)}...\n`;
            });
        }
        prompt += '\n\nProvide comprehensive product documentation with:';
        prompt += '\n1. Problem statement and context';
        prompt += '\n2. Goals and success metrics (OKRs/KPIs)';
        prompt += '\n3. User personas and use cases';
        prompt += '\n4. Feature requirements and specifications';
        prompt += '\n5. User stories with acceptance criteria';
        prompt += '\n6. Technical requirements and constraints';
        prompt += '\n7. Timeline and prioritization';
        prompt += '\n8. Dependencies and risks';
        return prompt;
    }
    parseProductArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            artifacts.push({
                type: 'document',
                name: language === 'markdown' || language === 'md' ? 'prd-document' : `${language}-spec`,
                content,
                metadata: { language, category: 'product-management' },
            });
        }
        // Check for user stories
        const userStoryRegex = /As a .+?, I want .+?, so that .+?\./gi;
        const userStories = response.match(userStoryRegex) || [];
        if (userStories.length > 0) {
            artifacts.push({
                type: 'document',
                name: 'user-stories',
                content: userStories.join('\n\n'),
                metadata: { count: userStories.length, format: 'user-story' },
            });
        }
        // Check for PRD structure
        if ((response.includes('# PRD') || response.includes('# Product Requirements')) &&
            (response.includes('## Problem') || response.includes('## Goals'))) {
            artifacts.push({
                type: 'document',
                name: 'product-requirements-document',
                content: response,
                metadata: { format: 'prd' },
            });
        }
        return artifacts;
    }
    getContextPrompt(context) {
        return `
Product Management Context:
- Focus on user needs and business value
- Define clear, measurable goals and success metrics
- Write user stories in format: "As a [persona], I want [capability], so that [benefit]"
- Include acceptance criteria for each story
- Consider technical feasibility and constraints
- Prioritize features (must-have, should-have, nice-to-have)
- Document assumptions, dependencies, and risks
- Use data and insights to support decisions
`;
    }
}
//# sourceMappingURL=ProductAgent.js.map