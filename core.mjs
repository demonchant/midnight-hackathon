import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class GateError extends Error {
  constructor(code, message) { super(message); this.name = 'GateError'; this.code = code; }
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

export function extractLedger(metadata) {
  if (!metadata || typeof metadata !== 'object' || !Array.isArray(metadata.ledger)) {
    throw new GateError('UNSUPPORTED_METADATA', 'Expected the observed Compact contract-info.json top-level ledger array. No policy decision was made.');
  }
  const ledger = metadata.ledger.map((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      !['name', 'index', 'exported', 'storage', 'type'].every(key => Object.hasOwn(item, key))) {
      throw new GateError('INVALID_METADATA', `Ledger entry ${i} does not match the observed Compact metadata fields.`);
    }
    return { name: item.name, index: item.index, exported: item.exported, storage: item.storage, type: stable(item.type) };
  });
  const names = new Set();
  const indexes = new Set();
  for (const field of ledger) {
    if (typeof field.name !== 'string' || !field.name || !Number.isInteger(field.index) || field.index < 0 ||
      typeof field.exported !== 'boolean' || typeof field.storage !== 'string') {
      throw new GateError('INVALID_METADATA', `Invalid Compact ledger field: ${field.name || '(unnamed)'}.`);
    }
    if (names.has(field.name)) throw new GateError('INVALID_METADATA', `Duplicate ledger field name: ${field.name}.`);
    if (indexes.has(field.index)) throw new GateError('INVALID_METADATA', `Duplicate ledger index: ${field.index}.`);
    names.add(field.name);
    indexes.add(field.index);
  }
  return ledger.sort((a, b) => a.index - b.index);
}

export function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      policy.formatVersion !== 1 || !Array.isArray(policy.ledger) ||
      !policy.toolchain || typeof policy.toolchain !== 'object' || Array.isArray(policy.toolchain)) {
    throw new GateError('INVALID_POLICY', 'Policy must have formatVersion 1, a toolchain object, and a ledger array.');
  }
  if (Object.keys(policy.toolchain).some(key => !['compiler', 'language', 'runtime'].includes(key))) {
    throw new GateError('INVALID_POLICY', 'Policy toolchain supports only compiler, language, and runtime fields.');
  }
  for (const key of ['compiler', 'language', 'runtime']) {
    if (typeof policy.toolchain[key] !== 'string' || !policy.toolchain[key].trim()) {
      throw new GateError('INVALID_POLICY', `Policy toolchain.${key} must be a nonempty version string.`);
    }
  }
  const names = new Set();
  const indexes = new Set();
  for (const [i, field] of policy.ledger.entries()) {
    if (!field || typeof field !== 'object' || Array.isArray(field) ||
      typeof field.name !== 'string' || !field.name.trim() || !Number.isInteger(field.index) || field.index < 0 ||
      typeof field.exported !== 'boolean' || typeof field.storage !== 'string' || !Object.hasOwn(field, 'type') ||
      typeof field.reason !== 'string' || !field.reason.trim()) {
      throw new GateError('INVALID_POLICY', `Policy ledger entry ${i} must define name, index, exported, storage, type, and a nonempty reason.`);
    }
    if (names.has(field.name)) throw new GateError('INVALID_POLICY', `Duplicate policy field name: ${field.name}.`);
    if (indexes.has(field.index)) throw new GateError('INVALID_POLICY', `Duplicate policy ledger index: ${field.index}.`);
    names.add(field.name);
    indexes.add(field.index);
  }
}

export function compareLedger(actual, policy) {
  validatePolicy(policy);
  const expected = policy.ledger.map(({ reason, ...field }) => field);
  const actualByName = new Map(actual.map(f => [f.name, f]));
  const expectedByName = new Map(expected.map(f => [f.name, f]));
  const changes = [];
  for (const [name, field] of actualByName) {
    if (!expectedByName.has(name)) changes.push({ kind: 'unapproved', name, actual: field });
    else if (JSON.stringify(stable(field)) !== JSON.stringify(stable(expectedByName.get(name)))) {
      changes.push({ kind: 'changed', name, expected: expectedByName.get(name), actual: field });
    }
  }
  for (const [name, field] of expectedByName) if (!actualByName.has(name)) changes.push({ kind: 'removed', name, expected: field });
  return changes.sort((a, b) => a.name.localeCompare(b.name));
}

export function compareToolchain(actual, policy) {
  validatePolicy(policy);
  const changes = [];
  for (const key of ['compiler', 'language', 'runtime']) {
    if (actual[key] !== policy.toolchain[key]) {
      changes.push({ kind: 'toolchain-changed', name: key, expected: policy.toolchain[key], actual: actual[key] });
    }
  }
  return changes;
}

export async function parseMetadataFile(path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (e) { throw new GateError('METADATA_READ_FAILED', `Cannot read compiler metadata at ${path}: ${e.message}`); }
  try { return JSON.parse(text); }
  catch (e) { throw new GateError('INVALID_METADATA_JSON', `Compiler metadata is not valid JSON: ${e.message}`); }
}
