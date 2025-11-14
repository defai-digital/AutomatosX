/**
 * DataScienceAgent.ts
 * Data science and machine learning specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class DataScienceAgent extends AgentBase {
    constructor() {
        super({
            type: 'datascience',
            name: 'Data Science Specialist (Dana)',
            description: 'Expert in machine learning, AI, data analysis, and model development. Specializes in building ML pipelines and training models.',
            capabilities: [
                { name: 'Machine Learning', description: 'Design and train ML models', keywords: ['ml', 'machine learning', 'model', 'training', 'neural network'] },
                { name: 'Data Analysis', description: 'Analyze and visualize data', keywords: ['analysis', 'visualization', 'pandas', 'numpy', 'matplotlib'] },
                { name: 'Model Training', description: 'Train and optimize ML models', keywords: ['train', 'optimize', 'hyperparameter', 'cross-validation'] },
                { name: 'Feature Engineering', description: 'Create and select features', keywords: ['feature', 'engineering', 'selection', 'transformation'] },
                { name: 'Model Evaluation', description: 'Evaluate model performance', keywords: ['evaluate', 'metrics', 'accuracy', 'precision', 'recall', 'f1'] },
            ],
            specializations: ['TensorFlow', 'PyTorch', 'scikit-learn', 'Keras', 'Jupyter', 'pandas', 'NumPy', 'Deep Learning', 'NLP', 'Computer Vision'],
            temperature: 0.6,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside data science specialization. Consider @${this.suggestDelegation(task)} agent.` };
        }
        context.monitoring.log('info', `Data science agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('model training machine learning');
            const pastSolutions = await context.memory.search('machine learning model data science');
            const prompt = this.buildMLPrompt(task, context, relevantCode.slice(0, 3), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseMLArtifacts(response);
            await context.memory.store({ type: 'ml_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'data-science' } };
        }
        catch (error) {
            context.monitoring.log('error', `Data science agent failed: ${error}`);
            throw error;
        }
    }
    buildMLPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide complete ML solution with:\n1. Data preprocessing and feature engineering\n2. Model architecture (TensorFlow/PyTorch/scikit-learn)\n3. Training pipeline with hyperparameter tuning\n4. Evaluation metrics and validation strategy\n5. Model deployment considerations\n6. Performance optimization tips';
        return prompt;
    }
    parseMLArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = language === 'python' ? 'ml-training-script' : `${language}-code`;
            if (content.includes('tensorflow') || content.includes('keras'))
                name = 'tensorflow-model';
            if (content.includes('torch') || content.includes('pytorch'))
                name = 'pytorch-model';
            artifacts.push({ type: 'code', name, content, metadata: { language, category: 'ml' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nData Science Context:\n- Use appropriate ML framework (TensorFlow/PyTorch/scikit-learn)\n- Include data preprocessing and feature engineering\n- Provide training/validation split strategy\n- Specify evaluation metrics\n- Consider model interpretability and bias\n- Optimize for performance and scalability';
    }
}
//# sourceMappingURL=DataScienceAgent.js.map