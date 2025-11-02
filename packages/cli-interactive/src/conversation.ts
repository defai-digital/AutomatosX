/**
 * Conversation Manager
 *
 * Handles conversation persistence, context management, and auto-saving
 * Currently uses JSON file storage (SQLite planned for Phase 1)
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Conversation, Message } from './types.js';

export class ConversationManager {
  private conversation: Conversation;
  private autoSaveTimer?: NodeJS.Timeout;
  private autoSaveInterval: number;
  private maxMessages: number;
  private conversationsDir: string;

  constructor(options?: {
    autoSaveInterval?: number;
    maxMessages?: number;
    conversationsDir?: string;
  }) {
    this.autoSaveInterval = options?.autoSaveInterval || 30000; // 30 seconds
    this.maxMessages = options?.maxMessages || 100;
    this.conversationsDir = options?.conversationsDir ||
      join(process.cwd(), '.automatosx', 'cli-conversations');

    // Initialize new conversation
    this.conversation = {
      id: randomUUID(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    };

    // Ensure conversations directory exists
    this.ensureDirectoryExists();

    // Start auto-save
    this.startAutoSave();
  }

  /**
   * Add a message to the conversation
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: {
    tokens?: number;
    provider?: string;
  }): void {
    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
      tokens: metadata?.tokens,
      provider: metadata?.provider
    };

    this.conversation.messages.push(message);
    this.conversation.updatedAt = Date.now();

    // Update metadata
    if (metadata?.tokens) {
      this.conversation.metadata!.totalTokens =
        (this.conversation.metadata!.totalTokens || 0) + metadata.tokens;
    }

    // Trim if exceeds max messages
    if (this.conversation.messages.length > this.maxMessages) {
      this.conversation.messages = this.conversation.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Get conversation context (recent messages for AI)
   */
  getContext(maxMessages: number = 20): Message[] {
    return this.conversation.messages.slice(-maxMessages);
  }

  /**
   * Get full conversation
   */
  getConversation(): Conversation {
    return this.conversation;
  }

  /**
   * Set conversation name
   */
  setName(name: string): void {
    this.conversation.name = name;
    this.conversation.updatedAt = Date.now();
  }

  /**
   * Clear conversation (start fresh)
   */
  clear(): void {
    this.conversation = {
      id: randomUUID(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    };
  }

  /**
   * Load conversation from data
   */
  load(data: Conversation): void {
    this.conversation = data;
  }

  /**
   * Save conversation to persistent storage (JSON file)
   */
  async save(): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      const filename = this.conversation.name
        ? `${this.sanitizeFilename(this.conversation.name)}-${this.conversation.id.slice(0, 8)}.json`
        : `conversation-${this.conversation.id.slice(0, 8)}.json`;

      const filepath = join(this.conversationsDir, filename);

      await fs.writeFile(
        filepath,
        JSON.stringify(this.conversation, null, 2),
        'utf-8'
      );

      // Silent success (no console output during auto-save)
    } catch (error) {
      console.error('[ConversationManager] Save failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Save conversation with explicit name
   */
  async saveAs(name: string): Promise<string> {
    this.setName(name);
    await this.save();

    const filename = `${this.sanitizeFilename(name)}-${this.conversation.id.slice(0, 8)}.json`;
    return join(this.conversationsDir, filename);
  }

  /**
   * Load conversation from file
   */
  async loadFromFile(filepath: string): Promise<void> {
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const conversation = JSON.parse(data) as Conversation;
      this.load(conversation);
    } catch (error) {
      console.error('[ConversationManager] Load failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * List all saved conversations
   */
  async listConversations(): Promise<Array<{
    filename: string;
    name?: string;
    messageCount: number;
    createdAt: number;
    updatedAt: number;
  }>> {
    try {
      await this.ensureDirectoryExists();

      const files = await fs.readdir(this.conversationsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const conversations = await Promise.all(
        jsonFiles.map(async (filename) => {
          try {
            const filepath = join(this.conversationsDir, filename);
            const data = await fs.readFile(filepath, 'utf-8');
            const conv = JSON.parse(data) as Conversation;

            return {
              filename,
              name: conv.name,
              messageCount: conv.messages.length,
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt
            };
          } catch {
            return null;
          }
        })
      );

      return conversations.filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  /**
   * Ensure conversations directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.conversationsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's okay
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Sanitize filename for safe filesystem use
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.save().catch(error => {
        console.error('[ConversationManager] Auto-save failed:', error);
      });
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    messageCount: number;
    totalTokens: number;
    duration: number;
  } {
    return {
      messageCount: this.conversation.messages.length,
      totalTokens: this.conversation.metadata?.totalTokens || 0,
      duration: Date.now() - this.conversation.createdAt
    };
  }

  /**
   * Export conversation to Markdown
   */
  exportToMarkdown(): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${this.conversation.name || 'Conversation'}`);
    lines.push('');
    lines.push(`**ID:** ${this.conversation.id}`);
    lines.push(`**Created:** ${new Date(this.conversation.createdAt).toLocaleString()}`);
    lines.push(`**Updated:** ${new Date(this.conversation.updatedAt).toLocaleString()}`);
    lines.push(`**Messages:** ${this.conversation.messages.length}`);

    if (this.conversation.metadata?.totalTokens) {
      lines.push(`**Total Tokens:** ${this.conversation.metadata.totalTokens}`);
    }

    if (this.conversation.metadata?.provider) {
      lines.push(`**Provider:** ${this.conversation.metadata.provider}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const message of this.conversation.messages) {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);

      lines.push(`## ${role} (${timestamp})`);
      lines.push('');
      lines.push(message.content);
      lines.push('');

      if (message.tokens) {
        lines.push(`*Tokens: ${message.tokens}*`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export conversation to Markdown file
   */
  async exportToMarkdownFile(): Promise<string> {
    const markdown = this.exportToMarkdown();

    const filename = this.conversation.name
      ? `${this.sanitizeFilename(this.conversation.name)}-export.md`
      : `conversation-${this.conversation.id.slice(0, 8)}-export.md`;

    const filepath = join(this.conversationsDir, filename);

    await fs.writeFile(filepath, markdown, 'utf-8');

    return filepath;
  }

  /**
   * Delete conversation file
   */
  async deleteConversation(filename: string): Promise<void> {
    const filepath = join(this.conversationsDir, filename);

    try {
      await fs.unlink(filepath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's okay
    }
  }
}
