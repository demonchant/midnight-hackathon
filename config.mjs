import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
const allowed = new Set(['CPG_PROJECT_ROOT', 'COMPACT_BIN', 'CPG_HOST', 'CPG_PORT']);

export async function loadConfig() {
  let text;
  try { text = await readFile(envPath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (!match || !allowed.has(match[1])) throw new Error(`Invalid .env setting on line ${index + 1}. Allowed: ${[...allowed].join(', ')}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
