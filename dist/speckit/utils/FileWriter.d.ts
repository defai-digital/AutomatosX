/**
 * File Writer
 *
 * Week 3-4 Implementation - Day 4
 * Writes scaffold files to disk with safety checks
 */
import type { RenderedFile, ScaffoldOptions, ScaffoldResult, ProjectStructure } from '../types/speckit.types.js';
/**
 * File Writer
 *
 * Responsible for writing files and creating directories with proper permissions and safety checks.
 */
export declare class FileWriter {
    /**
     * Write files and directories to disk
     */
    write(structure: ProjectStructure, files: RenderedFile[], options: ScaffoldOptions): Promise<ScaffoldResult>;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Build summary message
     */
    private buildSummary;
}
//# sourceMappingURL=FileWriter.d.ts.map