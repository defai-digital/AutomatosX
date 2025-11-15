/**
 * WriterAgent.ts
 * Technical writing and documentation specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class WriterAgent extends AgentBase {
    constructor() {
        super({
            type: 'writer',
            name: 'Technical Writer (Wendy)',
            description: 'Expert in technical writing, documentation, API docs, and user guides. Specializes in creating clear, comprehensive documentation.',
            capabilities: [
                { name: 'Technical Documentation', description: 'Write comprehensive technical docs', keywords: ['documentation', 'docs', 'technical writing', 'readme'] },
                { name: 'API Documentation', description: 'Create API documentation', keywords: ['api docs', 'api documentation', 'openapi', 'swagger'] },
                { name: 'User Guides', description: 'Write user guides and tutorials', keywords: ['user guide', 'tutorial', 'how-to', 'quickstart'] },
                { name: 'Code Comments', description: 'Write clear code documentation', keywords: ['comments', 'jsdoc', 'docstring', 'inline documentation'] },
                { name: 'Release Notes', description: 'Write release notes and changelogs', keywords: ['release notes', 'changelog', 'version', 'release'] },
            ],
            specializations: ['Technical Writing', 'API Documentation', 'User Guides', 'Tutorials', 'README', 'JSDoc', 'Markdown', 'DocBook', 'Sphinx'],
            temperature: 0.6,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside technical writing specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `Writer agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('readme documentation guide tutorial');
            const pastSolutions = await context.memory.search('documentation writing guide');
            const prompt = this.buildWriterPrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseWriterArtifacts(response);
            await context.memory.store({ type: 'writer_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'documentation' } };
        }
        catch (error) {
            context.monitoring.log('error', `Writer agent failed: ${error}`);
            throw error;
        }
    }
    buildWriterPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide complete documentation with:\n1. Clear, concise writing appropriate for target audience\n2. Well-structured content with headings and sections\n3. Code examples with explanations\n4. Installation and setup instructions\n5. Usage examples and common scenarios\n6. Troubleshooting and FAQ sections\n7. API reference if applicable\n8. Visual aids (diagrams, screenshots) where helpful';
        return prompt;
    }
    parseWriterArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'documentation';
            if (language === 'markdown' || language === 'md') {
                if (content.includes('# README') || content.toUpperCase().includes('README'))
                    name = 'readme';
                else if (content.includes('# API') || content.includes('## Endpoints'))
                    name = 'api-documentation';
                else if (content.includes('# Tutorial') || content.includes('# Guide'))
                    name = 'tutorial';
                else if (content.includes('# Installation') || content.includes('# Setup'))
                    name = 'installation-guide';
                else if (content.includes('# Changelog') || content.includes('# Release Notes'))
                    name = 'changelog';
                else if (content.includes('# FAQ') || content.includes('# Troubleshooting'))
                    name = 'troubleshooting';
            }
            else if (language === 'yaml' || language === 'yml') {
                if (content.includes('openapi') || content.includes('swagger'))
                    name = 'openapi-spec';
            }
            artifacts.push({ type: 'document', name, content, metadata: { language, category: 'documentation' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nTechnical Writing Context:\n- Write for your target audience (developers, end-users, etc.)\n- Use clear, concise language avoiding jargon when possible\n- Structure content logically with clear headings\n- Provide concrete examples and code snippets\n- Include visual aids where they improve understanding\n- Keep documentation up-to-date with code changes\n- Follow documentation style guides (e.g., Google Developer Style)\n- Make documentation searchable and easy to navigate\n- Include troubleshooting and common issues';
    }
}
//# sourceMappingURL=WriterAgent.js.map