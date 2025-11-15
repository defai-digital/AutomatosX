/**
 * CudaParserService.ts
 *
 * CUDA/HIP language parser using Tree-sitter
 * Extracts symbols from NVIDIA CUDA and AMD ROCm HIP source code
 *
 * Supports:
 * - NVIDIA CUDA (.cu, .cuh)
 * - AMD ROCm HIP (.hip, .hip.cpp, .hip.h, .hip.hpp)
 *
 * HIP is AMD's CUDA-compatible GPU programming interface.
 * Since HIP maintains API compatibility with CUDA, we can use
 * the same tree-sitter grammar for both.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * CudaParserService - Extracts symbols from CUDA and HIP code
 */
export declare class CudaParserService extends BaseLanguageParser {
    readonly language = "cuda";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * CUDA extends C/C++, so we handle C++ constructs plus CUDA-specific ones
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function definition (including CUDA/HIP kernels)
     */
    private extractFunction;
    /**
     * Extract class definition
     */
    private extractClass;
    /**
     * Extract struct definition
     */
    private extractStruct;
    /**
     * Extract enum definition
     */
    private extractEnum;
    /**
     * Extract variable/constant declaration
     */
    private extractDeclaration;
}
//# sourceMappingURL=CudaParserService.d.ts.map