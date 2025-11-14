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
import CUDA from 'tree-sitter-cuda';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * CudaParserService - Extracts symbols from CUDA and HIP code
 */
export class CudaParserService extends BaseLanguageParser {
  readonly language = 'cuda';
  readonly extensions = [
    // NVIDIA CUDA
    '.cu',
    '.cuh',
    // AMD ROCm HIP
    '.hip',
    '.hip.cpp',
    '.hip.h',
    '.hip.hpp',
  ];

  constructor() {
    super(CUDA as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * CUDA extends C/C++, so we handle C++ constructs plus CUDA-specific ones
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_definition':
        return this.extractFunction(node);

      case 'declaration':
        return this.extractDeclaration(node);

      case 'class_specifier':
        return this.extractClass(node);

      case 'struct_specifier':
        return this.extractStruct(node);

      case 'enum_specifier':
        return this.extractEnum(node);

      default:
        return null;
    }
  }

  /**
   * Extract function definition (including CUDA/HIP kernels)
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const declarator = node.childForFieldName('declarator');
    if (!declarator) return null;

    // Handle function_declarator or pointer_declarator
    let funcDeclarator = declarator;
    if (declarator.type === 'pointer_declarator') {
      funcDeclarator = declarator.childForFieldName('declarator') || declarator;
    }

    const name = this.getFieldText(funcDeclarator, 'declarator') ||
                 funcDeclarator.descendantsOfType('identifier')[0]?.text;
    if (!name) return null;

    // Check if it's a GPU kernel
    // CUDA: __global__, __device__, __host__
    // HIP: __global__, __device__, __host__ (same as CUDA)
    const text = node.text;
    const isKernel = text.includes('__global__');
    const isDevice = text.includes('__device__');
    const isHost = text.includes('__host__');

    const metadata: Record<string, any> = {};
    if (isKernel) metadata.gpuKernel = true;
    if (isDevice) metadata.deviceFunction = true;
    if (isHost) metadata.hostFunction = true;

    return this.createSymbol(node, name, 'function', Object.keys(metadata).length > 0 ? metadata : undefined);
  }

  /**
   * Extract class definition
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract struct definition
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract enum definition
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract variable/constant declaration
   */
  private extractDeclaration(node: Parser.SyntaxNode): Symbol | null {
    const declarator = node.descendantsOfType('init_declarator')[0] ||
                       node.descendantsOfType('declarator')[0];
    if (!declarator) return null;

    const text = node.text;
    // CUDA/HIP memory qualifiers
    const isConst = text.includes('const') ||
                    text.includes('__constant__');  // GPU constant memory
    const isShared = text.includes('__shared__');   // GPU shared memory
    const isManaged = text.includes('__managed__'); // Unified memory

    const identifier = declarator.descendantsOfType('identifier')[0];
    if (!identifier) return null;

    const name = identifier.text;

    const metadata: Record<string, any> = {};
    if (isShared) metadata.sharedMemory = true;
    if (isManaged) metadata.managedMemory = true;

    return {
      name,
      kind: isConst ? 'constant' : 'variable',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }
}
