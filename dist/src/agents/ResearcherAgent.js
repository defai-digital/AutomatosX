/**
 * ResearcherAgent.ts
 * Research and analysis specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class ResearcherAgent extends AgentBase {
    constructor() {
        super({
            type: 'researcher',
            name: 'Researcher (Rodman)',
            description: 'Expert in research methodologies, data analysis, and generating insights. Specializes in conducting thorough research and creating comprehensive reports.',
            capabilities: [
                { name: 'Research Methodology', description: 'Design research methodologies', keywords: ['research', 'methodology', 'study', 'investigation'] },
                { name: 'Data Analysis', description: 'Analyze data and extract insights', keywords: ['analysis', 'data', 'insights', 'findings'] },
                { name: 'Literature Review', description: 'Conduct literature reviews', keywords: ['literature', 'review', 'survey', 'existing work'] },
                { name: 'Report Writing', description: 'Write research reports', keywords: ['report', 'whitepaper', 'findings', 'conclusions'] },
                { name: 'Competitive Analysis', description: 'Analyze competitors and market', keywords: ['competitive', 'competitor', 'market research', 'analysis'] },
            ],
            specializations: ['Research Methods', 'Data Analysis', 'Literature Review', 'Report Writing', 'Competitive Analysis', 'Market Research', 'Statistical Analysis', 'Qualitative Research'],
            temperature: 0.6,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside research specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `Researcher agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('research analysis report findings');
            const pastSolutions = await context.memory.search('research analysis insights');
            const prompt = this.buildResearcherPrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseResearcherArtifacts(response);
            await context.memory.store({ type: 'researcher_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'research' } };
        }
        catch (error) {
            context.monitoring.log('error', `Researcher agent failed: ${error}`);
            throw error;
        }
    }
    buildResearcherPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide comprehensive research analysis with:\n1. Research methodology and approach\n2. Data sources and collection methods\n3. Analysis framework and techniques\n4. Key findings and insights\n5. Supporting data and evidence\n6. Limitations and considerations\n7. Conclusions and recommendations\n8. References and citations';
        return prompt;
    }
    parseResearcherArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'research-document';
            if (language === 'markdown' || language === 'md') {
                if (content.includes('# Research') || content.includes('# Study'))
                    name = 'research-report';
                else if (content.includes('# Literature Review') || content.includes('# Survey'))
                    name = 'literature-review';
                else if (content.includes('# Analysis') || content.includes('# Findings'))
                    name = 'analysis-report';
                else if (content.includes('# Competitive Analysis') || content.includes('# Market Research'))
                    name = 'competitive-analysis';
                else if (content.includes('# Whitepaper') || content.includes('# Technical Report'))
                    name = 'whitepaper';
            }
            else if (language === 'csv' || language === 'json') {
                name = 'research-data';
            }
            else if (language === 'python' || language === 'r') {
                if (content.includes('import pandas') || content.includes('library('))
                    name = 'analysis-script';
            }
            else if (language === 'mermaid') {
                name = 'research-diagram';
            }
            artifacts.push({ type: 'document', name, content, metadata: { language, category: 'research' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nResearch Context:\n- Use rigorous research methodologies\n- Cite sources and provide evidence for claims\n- Consider multiple perspectives and viewpoints\n- Analyze data objectively without bias\n- Acknowledge limitations and uncertainties\n- Present findings clearly with supporting data\n- Draw reasonable conclusions from evidence\n- Provide actionable recommendations\n- Follow academic and professional research standards';
    }
}
//# sourceMappingURL=ResearcherAgent.js.map