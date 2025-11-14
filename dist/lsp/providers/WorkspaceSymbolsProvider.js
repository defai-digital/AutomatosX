/**
 * Workspace Symbols Provider
 *
 * Provides workspace-wide symbol search.
 * Uses SymbolDAO for database queries with fuzzy matching.
 * Returns SymbolInformation[] sorted by relevance.
 */
import { filePathToUri } from '../utils/lsp-utils.js';
import { mapSymbolKind } from '../types/lsp-types.js';
/**
 * Workspace Symbols Provider
 * Searches symbols across entire workspace
 */
export class WorkspaceSymbolsProvider {
    integrationService;
    MAX_RESULTS = 100;
    constructor(integrationService) {
        this.integrationService = integrationService;
    }
    /**
     * Provide workspace symbols matching query
     */
    async provideWorkspaceSymbols(query) {
        try {
            if (!query || query.trim() === '') {
                return [];
            }
            // Get all symbols from database
            const symbolDAO = this.integrationService.getSymbolDAO();
            const allSymbols = symbolDAO.findAll();
            // Filter and rank symbols by query
            const matchingSymbols = this.filterAndRankSymbols(allSymbols, query);
            // Limit results
            const limitedSymbols = matchingSymbols.slice(0, this.MAX_RESULTS);
            // Convert to LSP format
            const symbolInformation = limitedSymbols.map((symbol) => this.convertToSymbolInformation(symbol));
            return symbolInformation;
        }
        catch (error) {
            console.error(`Error providing workspace symbols for query "${query}":`, error);
            return [];
        }
    }
    /**
     * Filter and rank symbols by query
     */
    filterAndRankSymbols(symbols, query) {
        const queryLower = query.toLowerCase();
        // Score each symbol
        const scored = symbols
            .map((symbol) => {
            const score = this.calculateMatchScore(symbol.name, queryLower);
            return { symbol, score };
        })
            .filter(({ score }) => score > 0);
        // Sort by score (descending)
        scored.sort((a, b) => b.score - a.score);
        return scored.map(({ symbol }) => symbol);
    }
    /**
     * Calculate match score for fuzzy matching
     */
    calculateMatchScore(name, query) {
        const nameLower = name.toLowerCase();
        // Exact match (case-insensitive)
        if (nameLower === query) {
            return 1000;
        }
        // Exact match (case-sensitive)
        if (name === query) {
            return 1100;
        }
        // Starts with query (case-insensitive)
        if (nameLower.startsWith(query)) {
            return 900;
        }
        // Starts with query (case-sensitive)
        if (name.startsWith(query)) {
            return 950;
        }
        // Contains query (case-insensitive)
        if (nameLower.includes(query)) {
            return 500;
        }
        // Fuzzy match (check if all query chars appear in order)
        const fuzzyScore = this.fuzzyMatch(nameLower, query);
        if (fuzzyScore > 0) {
            return fuzzyScore;
        }
        // No match
        return 0;
    }
    /**
     * Fuzzy match scoring
     * Returns score based on how well query matches name
     */
    fuzzyMatch(name, query) {
        let nameIndex = 0;
        let queryIndex = 0;
        let score = 0;
        let consecutiveMatches = 0;
        while (nameIndex < name.length && queryIndex < query.length) {
            if (name[nameIndex] === query[queryIndex]) {
                queryIndex++;
                consecutiveMatches++;
                score += 10 + consecutiveMatches * 5; // Bonus for consecutive matches
            }
            else {
                consecutiveMatches = 0;
            }
            nameIndex++;
        }
        // Check if all query characters were matched
        if (queryIndex === query.length) {
            // Bonus for shorter names (more precise matches)
            const lengthBonus = Math.max(0, 100 - (name.length - query.length) * 2);
            return score + lengthBonus;
        }
        return 0;
    }
    /**
     * Convert SymbolInfo to LSP SymbolInformation
     */
    convertToSymbolInformation(symbol) {
        const uri = filePathToUri(symbol.filePath);
        return {
            name: symbol.name,
            kind: mapSymbolKind(symbol.kind),
            location: {
                uri,
                range: {
                    start: {
                        line: symbol.startLine,
                        character: symbol.startColumn,
                    },
                    end: {
                        line: symbol.endLine,
                        character: symbol.endColumn,
                    },
                },
            },
            containerName: this.getContainerName(symbol),
        };
    }
    /**
     * Get container name for symbol
     */
    getContainerName(symbol) {
        if (symbol.scope && symbol.scope !== 'global') {
            return symbol.scope;
        }
        // Extract filename as container
        const fileName = symbol.filePath.split('/').pop() || symbol.filePath;
        return fileName;
    }
    /**
     * Search symbols by kind
     */
    async searchSymbolsByKind(kind) {
        try {
            const symbolDAO = this.integrationService.getSymbolDAO();
            const symbols = symbolDAO.findByKind(kind);
            const symbolInformation = symbols.map((symbol) => this.convertToSymbolInformation(symbol));
            return symbolInformation.slice(0, this.MAX_RESULTS);
        }
        catch (error) {
            console.error(`Error searching symbols by kind "${kind}":`, error);
            return [];
        }
    }
    /**
     * Get all symbols in a file
     */
    async getFileSymbols(filePath) {
        try {
            const symbols = await this.integrationService.getFileSymbols(filePath);
            const symbolInformation = symbols.map((symbol) => this.convertToSymbolInformation(symbol));
            return symbolInformation;
        }
        catch (error) {
            console.error(`Error getting file symbols for ${filePath}:`, error);
            return [];
        }
    }
}
//# sourceMappingURL=WorkspaceSymbolsProvider.js.map