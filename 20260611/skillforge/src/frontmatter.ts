/**
 * Minimal YAML frontmatter parser — zero dependencies.
 *
 * Supports the subset of YAML actually used by the Agent Skills spec:
 *   - scalar values:        key: value   (quoted or bare)
 *   - block scalars:        key: >- / > / |- / |  followed by indented lines
 *   - inline arrays:        key: [a, b, c]
 *   - block arrays:         key:\n  - a\n  - b
 *   - nested maps (1 level): metadata:\n  version: 1.0
 * Anything more exotic is reported as a parse warning rather than crashing.
 */

export type FrontmatterValue = string | string[] | Record<string, string>;

export interface FrontmatterResult {
  /** Parsed key/value pairs from the frontmatter block. */
  data: Record<string, FrontmatterValue>;
  /** Markdown body below the closing `---`. */
  body: string;
  /** True when an opening/closing `---` pair was found. */
  hasFrontmatter: boolean;
  /** Non-fatal problems encountered while parsing. */
  warnings: string[];
}

function unquote(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseInlineArray(raw: string): string[] {
  const inner = raw.trim().slice(1, -1);
  if (inner.trim() === '') return [];
  return inner.split(',').map((item) => unquote(item));
}

export function parseFrontmatter(source: string): FrontmatterResult {
  const result: FrontmatterResult = { data: {}, body: source, hasFrontmatter: false, warnings: [] };

  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return result;

  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closing = i;
      break;
    }
  }
  if (closing === -1) {
    result.warnings.push('frontmatter opened with `---` but never closed');
    return result;
  }

  result.hasFrontmatter = true;
  result.body = lines.slice(closing + 1).join('\n');

  let currentKey: string | null = null;
  let mode: 'none' | 'array' | 'map' | 'block' = 'none';
  let blockFold = false; // true for `>` (fold newlines to spaces), false for `|`
  let blockLines: string[] = [];

  const flushBlock = (): void => {
    if (mode === 'block' && currentKey !== null) {
      result.data[currentKey] = blockLines.join(blockFold ? ' ' : '\n').trim();
    }
    blockLines = [];
  };

  for (let i = 1; i < closing; i++) {
    const line = lines[i];
    if (line.trim() === '' || (mode !== 'block' && line.trim().startsWith('#'))) continue;

    const indented = /^\s/.test(line);

    if (indented && mode === 'block') {
      blockLines.push(line.trim());
      continue;
    }
    if (!indented && mode === 'block') {
      flushBlock();
      mode = 'none';
      currentKey = null;
    }

    if (indented && currentKey !== null) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed === '-') {
        if (mode === 'map') {
          result.warnings.push(`line ${i + 1}: mixed list/map under key "${currentKey}"`);
          continue;
        }
        mode = 'array';
        if (!Array.isArray(result.data[currentKey])) result.data[currentKey] = [];
        (result.data[currentKey] as string[]).push(unquote(trimmed.replace(/^-\s*/, '')));
        continue;
      }
      const kv = trimmed.match(/^([\w][\w.-]*)\s*:\s*(.*)$/);
      if (kv) {
        if (mode === 'array') {
          result.warnings.push(`line ${i + 1}: mixed map/list under key "${currentKey}"`);
          continue;
        }
        mode = 'map';
        if (typeof result.data[currentKey] !== 'object' || Array.isArray(result.data[currentKey])) {
          result.data[currentKey] = {};
        }
        (result.data[currentKey] as Record<string, string>)[kv[1]] = unquote(kv[2]);
        continue;
      }
      result.warnings.push(`line ${i + 1}: could not parse indented line: ${trimmed}`);
      continue;
    }

    const kv = line.match(/^([\w][\w.-]*)\s*:\s*(.*)$/);
    if (!kv) {
      result.warnings.push(`line ${i + 1}: could not parse line: ${line.trim()}`);
      currentKey = null;
      mode = 'none';
      continue;
    }

    const [, key, rawValue] = kv;
    currentKey = key;
    const value = rawValue.trim();

    if (value === '') {
      // Block array or nested map follows on the next indented lines.
      result.data[key] = '';
      mode = 'none';
    } else if (/^[>|][+-]?$/.test(value)) {
      // Block scalar (`>-`, `>`, `|-`, `|`); content follows on indented lines.
      mode = 'block';
      blockFold = value.startsWith('>');
      result.data[key] = '';
    } else if (value.startsWith('[') && value.endsWith(']')) {
      result.data[key] = parseInlineArray(value);
      mode = 'none';
      currentKey = null;
    } else {
      result.data[key] = unquote(value);
      mode = 'none';
      currentKey = null;
    }
  }

  flushBlock();
  return result;
}
