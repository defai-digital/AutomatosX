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
    this.autoSaveInterval = options?.autoSaveInterval ?? 30000; // 30 seconds (use ?? to allow 0)
    this.maxMessages = options?.maxMessages ?? 100;
    this.conversationsDir = options?.conversationsDir ??
      join(process.cwd(), '.automatosx', 'cli-conversations');

    // Initialize new conversation
    this.conversation = {
      id: randomUUID(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    };

    // Ensure conversations directory exists (fire-and-forget with error handling)
    void this.ensureDirectoryExists().catch(err => {
      console.error('Failed to create conversations directory:', err);
    });

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
    // Bug #3 fix: Validate role parameter
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      throw new Error(`Invalid role: ${role}. Must be 'user', 'assistant', or 'system'.`);
    }

    // Bug #3 fix: Validate content parameter
    if (typeof content !== 'string') {
      throw new Error(`Invalid content: must be a string, got ${typeof content}`);
    }

    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
      tokens: metadata?.tokens,
      provider: metadata?.provider
    };

    this.conversation.messages.push(message);
    this.conversation.updatedAt = Date.now();

    // Update metadata - validate tokens is a positive number
    if (metadata?.tokens !== undefined) {
      if (typeof metadata.tokens !== 'number' || !Number.isFinite(metadata.tokens) || metadata.tokens < 0) {
        throw new Error(`Invalid tokens value: ${metadata.tokens}. Must be a non-negative finite number.`);
      }
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
    // Bug #4 fix: Comprehensive validation for maxMessages
    if (typeof maxMessages !== 'number') {
      throw new Error(`Invalid maxMessages: must be a number, got ${typeof maxMessages}`);
    }
    if (!Number.isFinite(maxMessages)) {
      throw new Error(`Invalid maxMessages: ${maxMessages}. Must be a finite number (not NaN or Infinity).`);
    }
    if (!Number.isInteger(maxMessages)) {
      throw new Error(`Invalid maxMessages: ${maxMessages}. Must be an integer.`);
    }
    if (maxMessages <= 0) {
      throw new Error(`Invalid maxMessages: ${maxMessages}. Must be a positive number.`);
    }

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
    // Validate name parameter
    if (typeof name !== 'string') {
      throw new Error('Invalid name: must be a string');
    }
    if (name.trim().length === 0) {
      throw new Error('Invalid name: cannot be empty or whitespace-only');
    }

    this.conversation.name = name;
    this.conversation.updatedAt = Date.now();
  }

  /**
   * Clear conversation (start fresh)
   */
  clear(): void {
    // Stop auto-save for old conversation to prevent memory leak
    this.stopAutoSave();

    this.conversation = {
      id: randomUUID(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    };

    // Restart auto-save for new conversation
    this.startAutoSave();
  }

  /**
   * Load conversation from data
   */
  load(data: Conversation): void {
    // Validate required fields to prevent runtime crashes
    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Invalid conversation data: missing or invalid id');
    }
    if (!Array.isArray(data.messages)) {
      throw new Error('Invalid conversation data: messages must be an array');
    }
    if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') {
      throw new Error('Invalid conversation data: createdAt and updatedAt must be numbers');
    }

    // Stop auto-save for old conversation to prevent memory leak
    this.stopAutoSave();

    // Ensure metadata object exists to prevent crashes in addMessage()
    this.conversation = {
      ...data,
      metadata: data.metadata || {}
    };

    // Restart auto-save for new conversation
    this.startAutoSave();
  }

  /**
   * Save conversation to persistent storage (JSON file)
   */
  async save(): Promise<void> {
    // Bug #4 fix: Deep copy to prevent race conditions
    // Shallow copy ({ ...obj }) only copies top-level properties
    // Nested objects (messages array, metadata object) remain as shared references
    // During async operations (await), other code can modify these shared objects
    // Solution: Use JSON parse/stringify for deep copy or structuredClone
    let conversationSnapshot: Conversation;

    try {
      // Deep copy using JSON (handles all nested structures)
      // Note: This is safe because Conversation only contains JSON-serializable data
      conversationSnapshot = JSON.parse(JSON.stringify(this.conversation));
    } catch (error) {
      // If deep copy fails, fall back to snapshot (better than crash)
      console.error('[ConversationManager] Deep copy failed, using shallow copy:', error);
      conversationSnapshot = { ...this.conversation };
    }

    const nameSnapshot = conversationSnapshot.name;
    const idSnapshot = conversationSnapshot.id;

    try {
      await this.ensureDirectoryExists();

      // Use captured values instead of this.conversation to prevent race conditions
      const filename = nameSnapshot
        ? `${this.sanitizeFilename(nameSnapshot)}-${idSnapshot.slice(0, 8)}.json`
        : `conversation-${idSnapshot.slice(0, 8)}.json`;

      const filepath = join(this.conversationsDir, filename);

      // Serialize the deep copied snapshot (race-condition safe)
      let jsonData: string;
      try {
        jsonData = JSON.stringify(conversationSnapshot, null, 2);
      } catch (serializationError) {
        // Handle circular references, BigInt, and other JSON.stringify errors
        throw new Error(
          `Failed to serialize conversation data: ${(serializationError as Error).message}`
        );
      }

      // Write snapshot to disk (atomic write)
      await fs.writeFile(
        filepath,
        jsonData,
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
   * Returns just the filename (not full path)
   */
  async saveAs(name: string): Promise<string> {
    // Validate name before modifying state
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid name: must be a non-empty string');
    }

    // Capture old name in case save fails and we need to rollback
    const oldName = this.conversation.name;

    try {
      // Set name and attempt save
      this.setName(name);
      await this.save();

      // Success - return filename
      const filename = `${this.sanitizeFilename(name)}-${this.conversation.id.slice(0, 8)}.json`;
      return filename; // Return just filename, not full path
    } catch (error) {
      // Rollback name change if save failed to maintain state consistency
      this.conversation.name = oldName;
      this.conversation.updatedAt = Date.now();
      throw error;
    }
  }

  /**
   * Load conversation from file
   */
  async loadFromFile(filepath: string): Promise<void> {
    // Bug #2 fix: Enhanced security validation to prevent path traversal attacks
    if (!filepath || typeof filepath !== 'string') {
      throw new Error('Invalid filepath: must be a non-empty string');
    }
    if (filepath.trim().length === 0) {
      throw new Error('Invalid filepath: cannot be empty or whitespace-only');
    }

    // Bug #2 fix: Prevent path traversal attacks
    // Only allow loading from conversationsDir (no absolute paths or parent directory references)
    if (
      filepath.includes('..') ||
      filepath.startsWith('/') ||
      filepath.startsWith('\\') ||
      (filepath.length > 1 && filepath[1] === ':')  // Windows drive letter (C:\)
    ) {
      throw new Error(
        `Invalid filepath: ${filepath}. Path traversal detected. ` +
        `Only filenames within the conversations directory are allowed.`
      );
    }

    try {
      // Resolve filepath relative to conversationsDir for safety
      const safeFilepath = join(this.conversationsDir, filepath);

      // Bug #13 fix: Resolve symlinks and verify path is still within conversationsDir
      // This prevents symlink attacks where a malicious symlink points outside the sandbox
      let resolvedPath: string;
      try {
        resolvedPath = await fs.realpath(safeFilepath);

        // Normalize both paths to absolute for comparison
        const { resolve } = await import('path');
        const normalizedConversationsDir = resolve(this.conversationsDir);
        const normalizedResolvedPath = resolve(resolvedPath);

        // Verify resolved path is still within conversationsDir
        if (!normalizedResolvedPath.startsWith(normalizedConversationsDir)) {
          throw new Error(
            `Security: Path traversal detected via symlink. ` +
            `Resolved path "${resolvedPath}" is outside conversations directory.`
          );
        }
      } catch (realpathError) {
        // If realpath fails (file doesn't exist or broken symlink), use original path
        // readFile will fail with appropriate error if file truly doesn't exist
        resolvedPath = safeFilepath;
      }

      const data = await fs.readFile(resolvedPath, 'utf-8');

      // Validate JSON structure before parsing
      let conversation: Conversation;
      try {
        conversation = JSON.parse(data) as Conversation;
      } catch (parseError) {
        throw new Error(`Invalid JSON in file: ${(parseError as Error).message}`);
      }

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
   * Ensures result never starts/ends with dash and is never empty
   */
  private sanitizeFilename(name: string): string {
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')  // Remove leading/trailing dashes
      .slice(0, 50);

    // Ensure non-empty (fallback to "conversation" if empty)
    return sanitized || 'conversation';
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Only start timer if interval is > 0 (0 means disabled)
    if (this.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.save().catch(error => {
          console.error('[ConversationManager] Auto-save failed:', error);
        });
      }, this.autoSaveInterval);
    }
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
    lines.push(`**Created:** ${new Date(this.conversation.createdAt).toISOString().split('T')[0]}`);
    lines.push(`**Updated:** ${new Date(this.conversation.updatedAt).toISOString().split('T')[0]}`);
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
    if (this.conversation.messages.length === 0) {
      lines.push('No messages');
      lines.push('');
    } else {
      for (const message of this.conversation.messages) {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);

        lines.push(`**${role}:**`);
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

    return filename; // Return just filename, not full path
  }

  /**
   * Delete conversation file
   */
  async deleteConversation(filename: string): Promise<void> {
    // Security: Validate filename to prevent path traversal attacks
    // Reject filenames with path separators or parent directory references
    if (
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..') ||
      filename.startsWith('.') ||
      filename.length === 0
    ) {
      throw new Error(`Invalid filename: ${filename}. Filename must not contain path separators or parent directory references.`);
    }

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
