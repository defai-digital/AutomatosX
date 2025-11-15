/**
 * MemoryExporter - Export and import memory data
 * Supports JSON, CSV, and Markdown formats
 */
import type { MemoryService } from './MemoryService.js';
import type { MemoryExportOptions } from '../types/schemas/memory.schema.js';
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
export declare class MemoryExporter {
    private memoryService;
    constructor(memoryService: MemoryService);
    /**
     * Export conversations to JSON
     */
    exportToJSON(filePath: string, options?: Partial<MemoryExportOptions>): Promise<ExportResult>;
    /**
     * Export conversations to CSV
     */
    exportToCSV(filePath: string, options?: Partial<MemoryExportOptions>): Promise<ExportResult>;
    /**
     * Export conversations to Markdown
     */
    exportToMarkdown(filePath: string, options?: Partial<MemoryExportOptions>): Promise<ExportResult>;
    /**
     * Export conversations based on format
     */
    export(filePath: string, format?: 'json' | 'csv' | 'markdown', options?: Partial<MemoryExportOptions>): Promise<ExportResult>;
    /**
     * Import conversations from JSON
     */
    importFromJSON(filePath: string): Promise<ImportResult>;
    /**
     * Import conversations (auto-detect format)
     */
    import(filePath: string): Promise<ImportResult>;
    /**
     * Prepare export data based on options
     */
    private prepareExportData;
    /**
     * Escape CSV value
     */
    private escapeCsv;
    /**
     * Create full backup of all conversations
     */
    createBackup(filePath: string): Promise<ExportResult>;
    /**
     * Restore from backup
     */
    restoreBackup(filePath: string): Promise<ImportResult>;
    /**
     * Export single conversation
     */
    exportConversation(conversationId: string, filePath: string, format?: 'json' | 'markdown'): Promise<ExportResult>;
    /**
     * Export agent conversations
     */
    exportAgentConversations(agentId: string, filePath: string, format?: 'json' | 'markdown'): Promise<ExportResult>;
    /**
     * Export user conversations
     */
    exportUserConversations(userId: string, filePath: string, format?: 'json' | 'markdown'): Promise<ExportResult>;
    /**
     * Export conversations by date range
     */
    exportByDateRange(startDate: number, endDate: number, filePath: string, format?: 'json' | 'markdown'): Promise<ExportResult>;
}
//# sourceMappingURL=MemoryExporter.d.ts.map