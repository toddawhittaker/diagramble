// JSON Patch (RFC 6902), limited to `add`, `remove` and `replace`, with JSON Pointer
// paths (RFC 6901). `diff` works out the operations between two JSON values and
// `applyPatch` applies them without changing its input. Arrays and primitives that
// differ are replaced whole, so no operation ever carries an array index. The inverse
// of `diff(from, to)` is `diff(to, from)`.
// See docs/SPEC.md section 3.6, the change record in JSON Patch form.

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export type PatchOperation =
  | { readonly op: "add"; readonly path: string; readonly value: JsonValue }
  | { readonly op: "replace"; readonly path: string; readonly value: JsonValue }
  | { readonly op: "remove"; readonly path: string };

export type Patch = readonly PatchOperation[];

/** A patch either applies whole, or fails on one operation and changes nothing. */
export type PatchResult =
  | { readonly ok: true; readonly doc: JsonValue }
  | { readonly ok: false; readonly index: number; readonly message: string };

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(object: JsonObject, key: string): boolean {
  return Object.hasOwn(object, key);
}

/** Escape one key as a JSON Pointer token: `~` becomes `~0` and `/` becomes `~1`. */
export function escapePointerToken(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** Split a JSON Pointer into keys, or return null when it is not a valid pointer. */
function parsePointer(path: string): string[] | null {
  if (path === "") return [];
  if (!path.startsWith("/")) return null;
  const keys: string[] = [];
  for (const token of path.slice(1).split("/")) {
    if (/~(?![01])/.test(token)) return null;
    keys.push(token.replaceAll("~1", "/").replaceAll("~0", "~"));
  }
  return keys;
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i] as JsonValue));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => hasKey(b, key) && deepEqual(a[key] as JsonValue, b[key] as JsonValue));
  }
  return false;
}

function escapedPath(parent: string, key: string): string {
  return `${parent}/${escapePointerToken(key)}`;
}

function diffInto(from: JsonValue, to: JsonValue, path: string, ops: PatchOperation[]): void {
  if (isObject(from) && isObject(to)) {
    const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
    for (const key of keys) {
      const child = escapedPath(path, key);
      if (!hasKey(to, key)) {
        ops.push({ op: "remove", path: child });
      } else if (!hasKey(from, key)) {
        ops.push({ op: "add", path: child, value: to[key] as JsonValue });
      } else {
        diffInto(from[key] as JsonValue, to[key] as JsonValue, child, ops);
      }
    }
    return;
  }
  if (!deepEqual(from, to)) ops.push({ op: "replace", path, value: to });
}

/**
 * The operations that turn `from` into `to`. Objects are compared key by key, in sorted
 * key order; anything else that differs is replaced whole. Equal values give `[]`.
 * The result shares values with `to` and changes neither input.
 */
export function diff(from: JsonValue, to: JsonValue): PatchOperation[] {
  const ops: PatchOperation[] = [];
  diffInto(from, to, "", ops);
  return ops;
}

/** A copy of `object` with `key` set, safe for the key `__proto__`. */
function withKey(object: JsonObject, key: string, value: JsonValue): JsonObject {
  const copy: Record<string, JsonValue> = { ...object };
  Object.defineProperty(copy, key, { value, enumerable: true, writable: true, configurable: true });
  return copy;
}

function withoutKey(object: JsonObject, key: string): JsonObject {
  const copy: Record<string, JsonValue> = { ...object };
  delete copy[key];
  return copy;
}

type Step = { readonly ok: true; readonly doc: JsonValue } | { readonly ok: false; readonly message: string };

function fail(message: string): Step {
  return { ok: false, message };
}

/** Apply one operation at `keys`, copying only the objects along the path. */
function applyAt(doc: JsonValue, keys: readonly string[], depth: number, op: PatchOperation): Step {
  const key = keys[depth] as string;
  if (!isObject(doc)) {
    return fail(`"${op.path}" goes through a value that is not an object, and arrays are only replaced whole.`);
  }
  const last = depth === keys.length - 1;
  if (!last) {
    if (!hasKey(doc, key)) return fail(`"${op.path}" goes through "${key}", which does not exist.`);
    const inner = applyAt(doc[key] as JsonValue, keys, depth + 1, op);
    return inner.ok ? { ok: true, doc: withKey(doc, key, inner.doc) } : inner;
  }
  if (op.op === "remove") {
    if (!hasKey(doc, key)) return fail(`Cannot remove "${op.path}": it does not exist.`);
    return { ok: true, doc: withoutKey(doc, key) };
  }
  if (op.op === "replace" && !hasKey(doc, key)) {
    return fail(`Cannot replace "${op.path}": it does not exist.`);
  }
  return { ok: true, doc: withKey(doc, key, op.value) };
}

function applyOne(doc: JsonValue, op: PatchOperation): Step {
  if (op.op !== "add" && op.op !== "remove" && op.op !== "replace") {
    return fail(`Unknown operation "${String((op as { op: unknown }).op)}".`);
  }
  if (typeof op.path !== "string") return fail("An operation needs a string path.");
  const keys = parsePointer(op.path);
  if (keys === null) return fail(`"${op.path}" is not a valid JSON Pointer.`);
  if (op.op !== "remove" && (op as { value?: unknown }).value === undefined) {
    return fail(`The ${op.op} at "${op.path}" has no value.`);
  }
  if (keys.length === 0) {
    if (op.op === "remove") return fail("Cannot remove the whole document.");
    return { ok: true, doc: op.value };
  }
  return applyAt(doc, keys, 0, op);
}

/**
 * Apply `ops` in order and return the new document, or the index and a plain sentence
 * for the first operation that cannot apply, in which case nothing is returned. The
 * input is never changed; the result shares unchanged parts with it and the added values
 * with the operations. A `remove` or `replace` of a missing path, and an `add` whose
 * parent is missing or is not an object, fail. An `add` of an existing key replaces it,
 * as RFC 6902 says. Paths through an array fail, since patches replace arrays whole.
 */
export function applyPatch(doc: JsonValue, ops: Patch): PatchResult {
  let current = doc;
  for (const [index, op] of ops.entries()) {
    const step = applyOne(current, op);
    if (!step.ok) return { ok: false, index, message: step.message };
    current = step.doc;
  }
  return { ok: true, doc: current };
}
