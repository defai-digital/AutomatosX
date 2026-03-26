type FlagApplyResult = void | boolean | string;

export interface ParsedCommandArgs<T> {
  value: T;
  positionals: string[];
  error?: string;
}

interface BooleanFlagSpec<T> {
  kind: 'boolean';
  aliases?: string[];
  apply: (state: T) => FlagApplyResult;
}

interface StringFlagSpec<T> {
  kind: 'string';
  aliases?: string[];
  apply: (state: T, value: string) => FlagApplyResult;
}

export type CommandFlagSpec<T> = BooleanFlagSpec<T> | StringFlagSpec<T>;

interface ParseCommandArgsOptions<T> {
  args: string[];
  initial: T;
  flags: Record<string, CommandFlagSpec<T>>;
  allowPositionals?: boolean;
  onPositional?: (state: T, value: string, positionals: readonly string[]) => FlagApplyResult;
  unknownFlagMessage?: (token: string) => string;
  unexpectedPositionalMessage?: (token: string) => string;
  missingValueMessage?: (canonicalName: string, token: string) => string;
  booleanValueMessage?: (token: string) => string;
}

export interface NormalizedFlagToken {
  name: string;
  inlineValue?: string;
}

interface FlagRegistryEntry<T> {
  canonicalName: string;
  spec: CommandFlagSpec<T>;
}

export function parseCommandArgs<T>(options: ParseCommandArgsOptions<T>): ParsedCommandArgs<T> {
  const registry = createFlagRegistry(options.flags);
  const positionals: string[] = [];
  const value = options.initial;
  const allowPositionals = options.allowPositionals ?? true;

  for (let index = 0; index < options.args.length; index += 1) {
    const token = options.args[index];
    if (token === undefined) {
      continue;
    }

    const normalized = normalizeFlagToken(token);
    if (normalized === undefined) {
      if (!allowPositionals) {
        return {
          value,
          positionals,
          error: options.unexpectedPositionalMessage?.(token) ?? `Unexpected positional argument: ${token}`,
        };
      }

      const result = options.onPositional?.(value, token, positionals);
      if (typeof result === 'string') {
        return { value, positionals, error: result };
      }
      if (result !== false) {
        positionals.push(token);
      }
      continue;
    }

    const entry = registry.get(normalized.name);
    if (entry === undefined) {
      return {
        value,
        positionals,
        error: options.unknownFlagMessage?.(token) ?? `Unknown flag: ${token}.`,
      };
    }

    if (entry.spec.kind === 'boolean') {
      if (normalized.inlineValue !== undefined) {
        return {
          value,
          positionals,
          error: options.booleanValueMessage?.(token) ?? `Flag ${token} does not accept a value.`,
        };
      }

      const result = entry.spec.apply(value);
      if (typeof result === 'string') {
        return { value, positionals, error: result };
      }
      continue;
    }

    let flagValue = normalized.inlineValue;
    if (flagValue === undefined) {
      const nextToken = options.args[index + 1];
      if (nextToken === undefined || normalizeFlagToken(nextToken) !== undefined) {
        return {
          value,
          positionals,
          error: options.missingValueMessage?.(entry.canonicalName, token) ?? `Missing value for --${entry.canonicalName}.`,
        };
      }
      flagValue = nextToken;
      index += 1;
    }

    const result = entry.spec.apply(value, flagValue);
    if (typeof result === 'string') {
      return { value, positionals, error: result };
    }
  }

  return { value, positionals };
}

function createFlagRegistry<T>(flags: Record<string, CommandFlagSpec<T>>): Map<string, FlagRegistryEntry<T>> {
  const registry = new Map<string, FlagRegistryEntry<T>>();

  for (const [canonicalName, spec] of Object.entries(flags)) {
    registry.set(canonicalName, { canonicalName, spec });
    for (const alias of spec.aliases ?? []) {
      registry.set(alias, { canonicalName, spec });
    }
  }

  return registry;
}

export function normalizeFlagToken(token: string): NormalizedFlagToken | undefined {
  if (token === '--') {
    return undefined;
  }
  if (token.startsWith('--')) {
    return splitFlagToken(token.slice(2));
  }
  if (token.startsWith('-') && token.length > 1) {
    return splitFlagToken(token.slice(1));
  }
  return undefined;
}

function splitFlagToken(token: string): NormalizedFlagToken {
  const separatorIndex = token.indexOf('=');
  if (separatorIndex === -1) {
    return { name: token };
  }

  return {
    name: token.slice(0, separatorIndex),
    inlineValue: token.slice(separatorIndex + 1),
  };
}
