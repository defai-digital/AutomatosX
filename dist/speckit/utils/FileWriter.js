/**
 * File Writer
 *
 * Week 3-4 Implementation - Day 4
 * Writes scaffold files to disk with safety checks
 */
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * File Writer
 *
 * Responsible for writing files and creating directories with proper permissions and safety checks.
 */
export class FileWriter {
    /**
     * Write files and directories to disk
     */
    async write(structure, files, options) {
        const outputPath = options.outputPath || './project';
        const createdFiles = [];
        const createdDirectories = [];
        // Dry run mode - just return what would be created
        if (options.dryRun) {
            return {
                outputPath,
                createdFiles: files.map(f => f.path),
                createdDirectories: structure.directories,
                summary: this.buildSummary(files.map(f => f.path), structure.directories, true),
            };
        }
        // Create output directory
        await fs.mkdir(outputPath, { recursive: true });
        // Create directories
        for (const dir of structure.directories) {
            const fullPath = path.join(outputPath, dir);
            await fs.mkdir(fullPath, { recursive: true });
            createdDirectories.push(dir);
        }
        // Write files
        for (const file of files) {
            const fullPath = path.join(outputPath, file.path);
            // Check for existing file
            if (await this.fileExists(fullPath)) {
                if (!options.overwrite) {
                    // Skip existing files if not overwriting
                    continue;
                }
            }
            // Ensure parent directory exists
            const parentDir = path.dirname(fullPath);
            await fs.mkdir(parentDir, { recursive: true });
            // Write file
            await fs.writeFile(fullPath, file.content, 'utf-8');
            // Set executable permission if needed
            if (file.executable) {
                await fs.chmod(fullPath, 0o755);
            }
            createdFiles.push(file.path);
        }
        return {
            outputPath,
            createdFiles,
            createdDirectories,
            summary: this.buildSummary(createdFiles, createdDirectories),
        };
    }
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Build summary message
     */
    buildSummary(files, directories, dryRun = false) {
        const prefix = dryRun ? 'Would create' : 'Created';
        return `${prefix} ${files.length} files and ${directories.length} directories`;
    }
}
//# sourceMappingURL=FileWriter.js.map