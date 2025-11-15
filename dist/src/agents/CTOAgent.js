/**
 * CTOAgent.ts
 * Technical leadership and strategy specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class CTOAgent extends AgentBase {
    constructor() {
        super({
            type: 'cto',
            name: 'CTO (Tony)',
            description: 'Expert in technical leadership, strategy, and architecture decisions. Provides high-level technical guidance and long-term technology vision.',
            capabilities: [
                { name: 'Technical Strategy', description: 'Define technical vision and strategy', keywords: ['strategy', 'technical vision', 'roadmap', 'technology stack'] },
                { name: 'Architecture Decisions', description: 'Make high-level architecture decisions', keywords: ['architecture', 'system design', 'scalability', 'technical debt'] },
                { name: 'Team Leadership', description: 'Lead engineering teams', keywords: ['team', 'leadership', 'engineering culture', 'hiring'] },
                { name: 'Technology Evaluation', description: 'Evaluate and select technologies', keywords: ['technology', 'evaluation', 'vendor', 'tool selection'] },
                { name: 'Innovation', description: 'Drive technical innovation', keywords: ['innovation', 'research', 'emerging tech', 'competitive advantage'] },
            ],
            specializations: ['Technical Strategy', 'System Architecture', 'Team Building', 'Technology Evaluation', 'Engineering Culture', 'Technical Roadmaps', 'Innovation', 'Risk Management'],
            temperature: 0.7,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside CTO specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `CTO agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('architecture strategy roadmap');
            const pastSolutions = await context.memory.search('technical strategy architecture decision');
            const prompt = this.buildCTOPrompt(task, context, relevantCode.slice(0, 3), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseCTOArtifacts(response);
            await context.memory.store({ type: 'cto_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'leadership' } };
        }
        catch (error) {
            context.monitoring.log('error', `CTO agent failed: ${error}`);
            throw error;
        }
    }
    buildCTOPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide comprehensive technical leadership guidance with:\n1. Technical vision and strategic direction\n2. Architecture decisions with trade-off analysis\n3. Technology stack recommendations\n4. Team structure and hiring needs\n5. Technical roadmap with milestones\n6. Risk assessment and mitigation strategies\n7. Innovation opportunities and R&D priorities\n8. Engineering culture and best practices\n9. Metrics and KPIs for technical success';
        return prompt;
    }
    parseCTOArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'technical-document';
            if (language === 'markdown' || language === 'md') {
                if (content.includes('# Technical Strategy') || content.includes('# Roadmap'))
                    name = 'technical-strategy';
                else if (content.includes('# Architecture Decision Record') || content.includes('# ADR'))
                    name = 'adr-document';
                else if (content.includes('# Team Structure') || content.includes('# Hiring'))
                    name = 'team-plan';
                else if (content.includes('# Technology Evaluation') || content.includes('# Vendor'))
                    name = 'tech-evaluation';
            }
            else if (language === 'mermaid') {
                name = 'technical-diagram';
            }
            artifacts.push({ type: 'document', name, content, metadata: { language, category: 'leadership' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nCTO Leadership Context:\n- Balance innovation with stability and technical debt management\n- Make decisions considering long-term scalability and maintainability\n- Foster engineering excellence and continuous improvement\n- Align technical strategy with business objectives\n- Build strong engineering culture and teams\n- Evaluate technologies for strategic fit, not just features\n- Communicate technical vision clearly to stakeholders\n- Manage technical risk and ensure system reliability\n- Drive innovation while maintaining operational excellence';
    }
}
//# sourceMappingURL=CTOAgent.js.map