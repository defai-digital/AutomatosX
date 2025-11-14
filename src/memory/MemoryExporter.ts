/**
 * MemoryExporter - Export and import memory data
 * Supports JSON, CSV, and Markdown formats
 */

import { writeFileSync, readFileSync } from 'fs';
import type { MemoryService } from './MemoryService.js';
import type {
  Conversation,
  ConversationWithMessages,
  Message,
  MemoryExport,
  MemoryExportOptions,
} from '../types/schemas/memory.schema.js';

export interface ExportResult {
  filePath: string;
  format: 'json' | 'csv' | 'markdown';
  conversationCount: number;
  messageCount: number;
  exportedAt: number;
  sizeBytes: number;
}

export interface ImportResult {
  conversationsImported: number;
  messagesImported: number;
  errors: string[];
}

export class MemoryExporter {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  // ============================================================================
  // Export Operations
  // ============================================================================

  /**
   * Export conversations to JSON
   */
  async exportToJSON(
    filePath: string,
    options: MemoryExportOptions = {}
  ): Promise<ExportResult> {
    const exportData = await this.prepareExportData(options);

    const json = JSON.stringify(exportData, null, 2);
    writeFileSync(filePath, json, 'utf-8');

    return {
      filePath,
      format: 'json',
      conversationCount: exportData.conversations.length,
      messageCount: exportData.conversations.reduce(
        (sum, c) => sum + (c.messages?.length || 0),
        0
      ),
      exportedAt: exportData.exportedAt,
      sizeBytes: Buffer.byteLength(json, 'utf-8'),
    };
  }

  /**
   * Export conversations to CSV
   */
  async exportToCSV(
    filePath: string,
    options: MemoryExportOptions = {}
  ): Promise<ExportResult> {
    const exportData = await this.prepareExportData(options);

    // Create CSV header
    const csvLines: string[] = [
      'ConversationID,AgentID,UserID,Title,State,MessageCount,TotalTokens,CreatedAt,UpdatedAt,MessageRole,MessageContent,MessageTokens,MessageCreatedAt',
    ];

    let messageCount = 0;

    // Add conversation and message rows
    for (const conv of exportData.conversations) {
      for (const msg of conv.messages || []) {
        const row = [
          this.escapeCsv(conv.id),
          this.escapeCsv(conv.agentId),
          this.escapeCsv(conv.userId || ''),
          this.escapeCsv(conv.title),
          this.escapeCsv(conv.state),
          conv.messageCount.toString(),
          conv.totalTokens.toString(),
          new Date(conv.createdAt).toISOString(),
          new Date(conv.updatedAt).toISOString(),
          this.escapeCsv(msg.role),
          this.escapeCsv(msg.content),
          (msg.tokens || 0).toString(),
          new Date(msg.createdAt).toISOString(),
        ];
        csvLines.push(row.join(','));
        messageCount++;
      }
    }

    const csv = csvLines.join('\n');
    writeFileSync(filePath, csv, 'utf-8');

    return {
      filePath,
      format: 'csv',
      conversationCount: exportData.conversations.length,
      messageCount,
      exportedAt: exportData.exportedAt,
      sizeBytes: Buffer.byteLength(csv, 'utf-8'),
    };
  }

  /**
   * Export conversations to Markdown
   */
  async exportToMarkdown(
    filePath: string,
    options: MemoryExportOptions = {}
  ): Promise<ExportResult> {
    const exportData = await this.prepareExportData(options);

    const mdLines: string[] = [
      '# Memory Export',
      '',
      `**Exported At:** ${new Date(exportData.exportedAt).toLocaleString()}`,
      `**Conversations:** ${exportData.conversations.length}`,
      `**Total Tokens:** ${exportData.stats.totalTokens}`,
      '',
      '---',
      '',
    ];

    let messageCount = 0;

    for (const conv of exportData.conversations) {
      mdLines.push(`## ${conv.title}`);
      mdLines.push('');
      mdLines.push(`**Conversation ID:** ${conv.id}`);
      mdLines.push(`**Agent:** ${conv.agentId}`);
      if (conv.userId) {
        mdLines.push(`**User:** ${conv.userId}`);
      }
      mdLines.push(`**State:** ${conv.state}`);
      mdLines.push(`**Messages:** ${conv.messageCount}`);
      mdLines.push(`**Tokens:** ${conv.totalTokens}`);
      mdLines.push(`**Created:** ${new Date(conv.createdAt).toLocaleString()}`);
      mdLines.push(`**Updated:** ${new Date(conv.updatedAt).toLocaleString()}`);
      mdLines.push('');

      if (conv.messages && conv.messages.length > 0) {
        mdLines.push('### Messages');
        mdLines.push('');

        for (const msg of conv.messages) {
          const timestamp = new Date(msg.createdAt).toLocaleString();
          mdLines.push(`#### ${msg.role.toUpperCase()} - ${timestamp}`);
          mdLines.push('');
          mdLines.push(msg.content);
          mdLines.push('');
          if (msg.tokens) {
            mdLines.push(`*Tokens: ${msg.tokens}*`);
            mdLines.push('');
          }
          messageCount++;
        }
      }

      mdLines.push('---');
      mdLines.push('');
    }

    const markdown = mdLines.join('\n');
    writeFileSync(filePath, markdown, 'utf-8');

    return {
      filePath,
      format: 'markdown',
      conversationCount: exportData.conversations.length,
      messageCount,
      exportedAt: exportData.exportedAt,
      sizeBytes: Buffer.byteLength(markdown, 'utf-8'),
    };
  }

  /**
   * Export conversations based on format
   */
  async export(
    filePath: string,
    format: 'json' | 'csv' | 'markdown' = 'json',
    options: MemoryExportOptions = {}
  ): Promise<ExportResult> {
    switch (format) {
      case 'json':
        return this.exportToJSON(filePath, options);
      case 'csv':
        return this.exportToCSV(filePath, options);
      case 'markdown':
        return this.exportToMarkdown(filePath, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ============================================================================
  // Import Operations
  // ============================================================================

  /**
   * Import conversations from JSON
   */
  async importFromJSON(filePath: string): Promise<ImportResult> {
    const json = readFileSync(filePath, 'utf-8');
    const exportData: MemoryExport = JSON.parse(json);

    let conversationsImported = 0;
    let messagesImported = 0;
    const errors: string[] = [];

    for (const conv of exportData.conversations) {
      try {
        // Create conversation (without messages field)
        const { messages, ...conversationData } = conv;
        await this.memoryService.createConversation({
          agentId: conversationData.agentId,
          userId: conversationData.userId,
          title: conversationData.title,
          metadata: conversationData.metadata,
        });
        conversationsImported++;

        // Import messages
        if (messages) {
          for (const msg of messages) {
            try {
              await this.memoryService.addMessage({
                conversationId: conv.id,
                role: msg.role,
                content: msg.content,
                tokens: msg.tokens,
                metadata: msg.metadata,
              });
              messagesImported++;
            } catch (err) {
              errors.push(`Failed to import message ${msg.id}: ${err}`);
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to import conversation ${conv.id}: ${err}`);
      }
    }

    return {
      conversationsImported,
      messagesImported,
      errors,
    };
  }

  /**
   * Import conversations (auto-detect format)
   */
  async import(filePath: string): Promise<ImportResult> {
    // Currently only JSON import is supported
    // CSV and Markdown import can be added in future iterations
    return this.importFromJSON(filePath);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Prepare export data based on options
   */
  private async prepareExportData(
    options: MemoryExportOptions
  ): Promise<MemoryExport> {
    const {
      conversationId,
      agentId,
      userId,
      startDate,
      endDate,
      includeArchived = false,
      includeDeleted = false,
    } = options;

    let conversations: ConversationWithMessages[] = [];

    // Export specific conversation
    if (conversationId) {
      const conv = await this.memoryService.getConversationWithMessages(conversationId);
      if (conv) {
        conversations.push(conv);
      }
    }
    // Export by filters
    else {
      const listResult = await this.memoryService.listConversations({
        agentId,
        userId,
        limit: 100,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeArchived,
        includeDeleted,
      });

      // Load messages for each conversation
      for (const conv of listResult.conversations) {
        // Filter by date range
        if (startDate && conv.createdAt < startDate) continue;
        if (endDate && conv.createdAt > endDate) continue;

        const convWithMessages = await this.memoryService.getConversationWithMessages(
          conv.id
        );
        if (convWithMessages) {
          conversations.push(convWithMessages);
        }
      }
    }

    // Get stats
    const stats = await this.memoryService.getMemoryStats();

    return {
      conversations,
      exportedAt: Date.now(),
      exportOptions: options,
      stats,
    };
  }

  /**
   * Escape CSV value
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ============================================================================
  // Backup and Restore
  // ============================================================================

  /**
   * Create full backup of all conversations
   */
  async createBackup(filePath: string): Promise<ExportResult> {
    return this.exportToJSON(filePath, {
      includeArchived: true,
      includeDeleted: true,
    });
  }

  /**
   * Restore from backup
   */
  async restoreBackup(filePath: string): Promise<ImportResult> {
    return this.importFromJSON(filePath);
  }

  /**
   * Export single conversation
   */
  async exportConversation(
    conversationId: string,
    filePath: string,
    format: 'json' | 'markdown' = 'json'
  ): Promise<ExportResult> {
    return this.export(filePath, format, { conversationId });
  }

  /**
   * Export agent conversations
   */
  async exportAgentConversations(
    agentId: string,
    filePath: string,
    format: 'json' | 'markdown' = 'json'
  ): Promise<ExportResult> {
    return this.export(filePath, format, { agentId });
  }

  /**
   * Export user conversations
   */
  async exportUserConversations(
    userId: string,
    filePath: string,
    format: 'json' | 'markdown' = 'json'
  ): Promise<ExportResult> {
    return this.export(filePath, format, { userId });
  }

  /**
   * Export conversations by date range
   */
  async exportByDateRange(
    startDate: number,
    endDate: number,
    filePath: string,
    format: 'json' | 'markdown' = 'json'
  ): Promise<ExportResult> {
    return this.export(filePath, format, { startDate, endDate });
  }
}
