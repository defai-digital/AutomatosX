/**
 * AX.MD Parser - Extract structured data from existing AX.MD
 *
 * Enables intelligent updates by understanding current content
 * @since v8.5.0
 */

export interface ParsedAXMD {
  version?: string;
  projectName?: string;
  description?: string;
  architecture?: string;
  stack?: string;
  team?: string;
  dependencies: string[];
  scripts: Record<string, string>;
  linter?: string;
  formatter?: string;
  testFramework?: string;
  hasCustomContent: boolean;
  customSections: string[];
}

/**
 * Parse existing AX.MD file to extract current state
 */
export function parseAXMD(content: string): ParsedAXMD {
  const result: ParsedAXMD = {
    dependencies: [],
    scripts: {},
    hasCustomContent: false,
    customSections: []
  };

  // Extract version
  const versionMatch = content.match(/Project:.*?\(v([\d.]+)\)/);
  if (versionMatch) {
    result.version = versionMatch[1];
  }

  // Extract project name
  const nameMatch = content.match(/# Project Context for (.+)/);
  if (nameMatch) {
    result.projectName = nameMatch[1];
  }

  // Extract description
  const descMatch = content.match(/## Project Overview\n\n\*\*(.+?)\*\*/);
  if (descMatch) {
    result.description = descMatch[1];
  }

  // Extract architecture
  const archMatch = content.match(/\*\*Architecture:\*\* (.+)/);
  if (archMatch) {
    result.architecture = archMatch[1];
  }

  // Extract stack
  const stackMatch = content.match(/\*\*Stack:\*\* (.+)/);
  if (stackMatch && stackMatch[1]) {
    result.stack = stackMatch[1];
    // Parse dependencies from stack
    result.dependencies = stackMatch[1]
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);
  }

  // Extract team
  const teamMatch = content.match(/\*\*Team:\*\* (.+)/);
  if (teamMatch) {
    result.team = teamMatch[1];
  }

  // Extract test framework
  const testMatch = content.match(/- Framework: (.+)/);
  if (testMatch) {
    result.testFramework = testMatch[1];
  }

  // Extract linter
  const linterMatch = content.match(/- Linter: (.+)/);
  if (linterMatch) {
    result.linter = linterMatch[1];
  }

  // Extract formatter
  const formatterMatch = content.match(/- Formatter: (.+)/);
  if (formatterMatch) {
    result.formatter = formatterMatch[1];
  }

  // Extract scripts from canonical commands section
  const commandsMatch = content.match(/## Canonical Commands\n\n```bash\n([\s\S]*?)```/);
  if (commandsMatch && commandsMatch[1]) {
    const commandsSection = commandsMatch[1];
    const lines = commandsSection.split('\n');

    for (const line of lines) {
      // Parse: "npm run dev                 # Start dev server"
      const cmdMatch = line.match(/^([^\s#]+(?:\s+[^\s#]+)*)\s*#/);
      if (cmdMatch && cmdMatch[1]) {
        const cmd = cmdMatch[1].trim();
        result.scripts[cmd] = cmd;
      }
    }
  }

  // Detect custom content (sections not typically auto-generated)
  const customMarkers = [
    /<!-- USER-EDITED -->/,
    /## Our Custom/,
    /## Notes/,
    /## Team Guidelines/
  ];

  for (const marker of customMarkers) {
    if (marker.test(content)) {
      result.hasCustomContent = true;
      break;
    }
  }

  // Extract custom sections
  const sections = content.split(/^## /m);
  const standardSections = [
    'Project Overview',
    'Agent Delegation Rules',
    'Coding Conventions',
    'Critical Guardrails',
    'Canonical Commands',
    'Useful Links'
  ];

  for (const section of sections) {
    const sectionName = section.split('\n')[0];
    if (sectionName && !standardSections.includes(sectionName)) {
      result.customSections.push(sectionName);
    }
  }

  return result;
}

/**
 * Compare parsed AX.MD with current project info to detect changes
 */
export interface DetectedChange {
  type: 'version' | 'dependency-added' | 'dependency-removed' | 'script-added' |
        'script-removed' | 'framework' | 'architecture' | 'tool-added' | 'tool-removed';
  field: string;
  oldValue?: string;
  newValue?: string;
  items?: string[];
}

export function detectDetailedChanges(
  parsed: ParsedAXMD,
  current: {
    version?: string;
    dependencies: string[];
    scripts: Record<string, string>;
    framework?: string;
    architecture: string;
    linter?: string;
    formatter?: string;
    testFramework?: string;
  }
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  // Version change
  if (parsed.version !== current.version && current.version) {
    changes.push({
      type: 'version',
      field: 'version',
      oldValue: parsed.version,
      newValue: current.version
    });
  }

  // Dependencies added
  const currentDeps = current.dependencies.map(d => d.toLowerCase());
  const addedDeps = currentDeps.filter(d => !parsed.dependencies.includes(d));
  if (addedDeps.length > 0) {
    changes.push({
      type: 'dependency-added',
      field: 'dependencies',
      items: addedDeps
    });
  }

  // Dependencies removed
  const removedDeps = parsed.dependencies.filter(d => !currentDeps.includes(d));
  if (removedDeps.length > 0) {
    changes.push({
      type: 'dependency-removed',
      field: 'dependencies',
      items: removedDeps
    });
  }

  // Scripts added
  const currentScriptKeys = Object.keys(current.scripts);
  const parsedScriptKeys = Object.keys(parsed.scripts);
  const addedScripts = currentScriptKeys.filter(s => !parsedScriptKeys.includes(s));
  if (addedScripts.length > 0) {
    changes.push({
      type: 'script-added',
      field: 'scripts',
      items: addedScripts
    });
  }

  // Scripts removed
  const removedScripts = parsedScriptKeys.filter(s => !currentScriptKeys.includes(s));
  if (removedScripts.length > 0) {
    changes.push({
      type: 'script-removed',
      field: 'scripts',
      items: removedScripts
    });
  }

  // Tools added
  if (current.linter && !parsed.linter) {
    changes.push({
      type: 'tool-added',
      field: 'linter',
      newValue: current.linter
    });
  }
  if (current.formatter && !parsed.formatter) {
    changes.push({
      type: 'tool-added',
      field: 'formatter',
      newValue: current.formatter
    });
  }
  if (current.testFramework && !parsed.testFramework) {
    changes.push({
      type: 'tool-added',
      field: 'test framework',
      newValue: current.testFramework
    });
  }

  // Architecture change
  if (parsed.architecture && parsed.architecture !== current.architecture) {
    changes.push({
      type: 'architecture',
      field: 'architecture',
      oldValue: parsed.architecture,
      newValue: current.architecture
    });
  }

  return changes;
}

/**
 * Format changes for user-friendly display
 */
export function formatChangeSummary(changes: DetectedChange[]): string {
  if (changes.length === 0) return '';

  const summaries: string[] = [];

  for (const change of changes) {
    switch (change.type) {
      case 'version':
        summaries.push(`version ${change.oldValue} → ${change.newValue}`);
        break;
      case 'dependency-added':
        summaries.push(`+${change.items!.length} dep${change.items!.length > 1 ? 's' : ''}`);
        break;
      case 'dependency-removed':
        summaries.push(`-${change.items!.length} dep${change.items!.length > 1 ? 's' : ''}`);
        break;
      case 'script-added':
        summaries.push(`+${change.items!.length} script${change.items!.length > 1 ? 's' : ''}`);
        break;
      case 'tool-added':
        summaries.push(`+${change.field}`);
        break;
      case 'architecture':
        summaries.push('architecture');
        break;
    }
  }

  if (summaries.length === 0) return '';
  if (summaries.length === 1) return `(${summaries[0]})`;
  if (summaries.length === 2) return `(${summaries[0]}, ${summaries[1]})`;
  return `(${summaries.length} changes)`;
}
