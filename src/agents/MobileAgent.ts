/**
 * MobileAgent.ts
 * Mobile development specialist (iOS, Android, cross-platform)
 * Phase 7: Agent System Implementation - Day 3
 */

import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions, TaskArtifact } from '../types/agents.types.js';

export class MobileAgent extends AgentBase {
  constructor() {
    super({
      type: 'mobile',
      name: 'Mobile Specialist (Maya)',
      description: 'Expert in iOS, Android, Flutter, and React Native development. Specializes in building native and cross-platform mobile applications.',
      capabilities: [
        { name: 'iOS Development', description: 'Build iOS apps with Swift/SwiftUI', keywords: ['ios', 'swift', 'swiftui', 'xcode', 'uikit'] },
        { name: 'Android Development', description: 'Build Android apps with Kotlin', keywords: ['android', 'kotlin', 'jetpack compose', 'android studio'] },
        { name: 'Cross-Platform', description: 'Build cross-platform apps', keywords: ['flutter', 'react native', 'cross-platform', 'dart'] },
        { name: 'Mobile UX', description: 'Design mobile user experiences', keywords: ['mobile ux', 'touch', 'gestures', 'navigation'] },
        { name: 'App Store', description: 'App store optimization and deployment', keywords: ['app store', 'play store', 'deployment', 'release'] },
      ],
      specializations: ['Swift', 'SwiftUI', 'Kotlin', 'Jetpack Compose', 'Flutter', 'React Native', 'Dart', 'iOS', 'Android', 'Mobile UX'],
      temperature: 0.7,
      maxTokens: 4000,
    });
  }

  protected async executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      return { success: false, message: `Outside mobile specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
    }

    context.monitoring.log('info', `Mobile agent handling: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode('mobile ios android flutter react native');
      const pastSolutions = await context.memory.search('mobile app ios android');
      const prompt = this.buildMobilePrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseMobileArtifacts(response);

      await context.memory.store({ type: 'mobile_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });

      return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'mobile' } };
    } catch (error) {
      context.monitoring.log('error', `Mobile agent failed: ${error}`);
      throw error;
    }
  }

  private buildMobilePrompt(task: Task, context: AgentContext, codeContext: any[], pastSolutions: any[]): string {
    let prompt = this.buildPrompt(task, context);
    prompt += '\n\nProvide complete mobile solution with:\n1. Platform-specific implementation (iOS/Android/Flutter/React Native)\n2. UI components with platform design guidelines\n3. State management approach\n4. Navigation structure\n5. API integration and data persistence\n6. Platform-specific features (camera, location, notifications)\n7. App store deployment considerations';
    return prompt;
  }

  private parseMobileArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();
      let name = 'mobile-code';

      if (language === 'swift') {
        if (content.includes('SwiftUI') || content.includes('View')) name = 'swiftui-view';
        else if (content.includes('UIKit') || content.includes('UIViewController')) name = 'uikit-controller';
      } else if (language === 'kotlin') {
        if (content.includes('@Composable') || content.includes('Compose')) name = 'jetpack-compose';
        else if (content.includes('Activity') || content.includes('Fragment')) name = 'android-component';
      } else if (language === 'dart') {
        name = 'flutter-widget';
      } else if (language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx') {
        if (content.includes('React Native') || content.includes('react-native')) name = 'react-native-component';
      } else if (language === 'xml') {
        name = 'android-layout';
      }

      artifacts.push({ type: 'code', name, content, metadata: { language, category: 'mobile' } });
    }
    return artifacts;
  }

  protected getContextPrompt(): string {
    return '\nMobile Development Context:\n- Follow platform design guidelines (Human Interface Guidelines for iOS, Material Design for Android)\n- Optimize for touch interactions and gestures\n- Consider device capabilities and permissions\n- Handle different screen sizes and orientations\n- Implement offline-first architecture when appropriate\n- Use platform-specific APIs for native features\n- Optimize performance and battery usage\n- Follow app store submission guidelines';
  }
}
