import { describe, expect, test } from "vitest";
import { applyPatch, diff, escapePointerToken, type JsonValue, type Patch } from "./patch.ts";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function copy<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applied(doc: JsonValue, ops: Patch): JsonValue {
  const result = applyPatch(doc, ops);
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

/** The round-trip properties: diff then apply gives the target, and the inverse gives the source (SPEC.md section 3.6). */
function expectRoundTrip(a: JsonValue, b: JsonValue): void {
  const frozenA = deepFreeze(copy(a));
  const frozenB = deepFreeze(copy(b));
  const forward = diff(frozenA, frozenB);
  const inverse = diff(frozenB, frozenA);
  expect(applied(frozenA, forward)).toEqual(b);
  expect(applied(frozenB, inverse)).toEqual(a);
  expect(frozenA).toEqual(a);
  expect(frozenB).toEqual(b);
}

describe("diff", () => {
  test("equal values give no operations", () => {
    expect(diff({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toEqual([]);
    expect(diff(5, 5)).toEqual([]);
    expect(diff(null, null)).toEqual([]);
    expect(diff({}, {})).toEqual([]);
  });

  test("a key only in the target is an add, a key only in the source is a remove", () => {
    expect(diff({ a: 1 }, { a: 1, b: "x" })).toEqual([{ op: "add", path: "/b", value: "x" }]);
    expect(diff({ a: 1, b: "x" }, { a: 1 })).toEqual([{ op: "remove", path: "/b" }]);
  });

  test("a changed primitive is a replace", () => {
    expect(diff({ a: 1 }, { a: 2 })).toEqual([{ op: "replace", path: "/a", value: 2 }]);
    expect(diff({ a: "x" }, { a: "" })).toEqual([{ op: "replace", path: "/a", value: "" }]);
    expect(diff({ a: false }, { a: null })).toEqual([{ op: "replace", path: "/a", value: null }]);
  });

  test("nested objects are compared key by key", () => {
    const ops = diff(
      { elements: { p1: { name: "Old", id: "p1" }, p2: { name: "Keep" } } },
      { elements: { p1: { name: "New", id: "p1" }, p2: { name: "Keep" } } },
    );
    expect(ops).toEqual([{ op: "replace", path: "/elements/p1/name", value: "New" }]);
  });

  test("an array that differs is replaced whole, never by index", () => {
    expect(diff({ a: [1, 2, 3] }, { a: [1, 3] })).toEqual([{ op: "replace", path: "/a", value: [1, 3] }]);
    expect(diff({ a: [{ x: 1 }] }, { a: [{ x: 2 }] })).toEqual([
      { op: "replace", path: "/a", value: [{ x: 2 }] },
    ]);
    expect(diff({ a: [1] }, { a: [1] })).toEqual([]);
  });

  test("a value that changes type is replaced whole", () => {
    expect(diff({ a: { b: 1 } }, { a: [1] })).toEqual([{ op: "replace", path: "/a", value: [1] }]);
    expect(diff({ a: [1] }, { a: { b: 1 } })).toEqual([{ op: "replace", path: "/a", value: { b: 1 } }]);
    expect(diff({ a: null }, { a: { b: 1 } })).toEqual([{ op: "replace", path: "/a", value: { b: 1 } }]);
    expect(diff({ a: { b: 1 } }, { a: null })).toEqual([{ op: "replace", path: "/a", value: null }]);
  });

  test("different top-level values are replaced at the root", () => {
    expect(diff(1, 2)).toEqual([{ op: "replace", path: "", value: 2 }]);
    expect(diff([1], { a: 1 })).toEqual([{ op: "replace", path: "", value: { a: 1 } }]);
    expect(diff({ a: 1 }, null)).toEqual([{ op: "replace", path: "", value: null }]);
  });

  test("the output order is deterministic: sorted keys, whatever the insertion order", () => {
    const from = { z: 1, a: 1, m: 1 };
    const to = { m: 2, q: 1, a: 1 };
    const expected = [
      { op: "replace", path: "/m", value: 2 },
      { op: "add", path: "/q", value: 1 },
      { op: "remove", path: "/z" },
    ];
    expect(diff(from, to)).toEqual(expected);
    expect(diff({ m: 1, a: 1, z: 1 }, { a: 1, q: 1, m: 2 })).toEqual(expected);
  });

  test("keys are escaped in paths, ~ before / as RFC 6901 says", () => {
    expect(escapePointerToken("a/b~c")).toBe("a~1b~0c");
    expect(escapePointerToken("~1")).toBe("~01");
    const ops = diff({}, { "a/b": 1, "m~n": 2, "~1": 3 });
    expect(ops.map((op) => op.path)).toEqual(["/a~1b", "/m~0n", "/~01"].sort());
    expectRoundTrip({}, { "a/b": 1, "m~n": 2, "~1": 3, "": 4 });
    expectRoundTrip({ "a/b": { "c/d": 1 } }, { "a/b": { "c/d": 2 } });
  });

  test("does not change its inputs", () => {
    const from = deepFreeze({ a: { b: [1] }, c: 1 });
    const to = deepFreeze({ a: { b: [2] }, d: 1 });
    expect(() => diff(from, to)).not.toThrow();
  });
});

describe("applyPatch", () => {
  test("applies add, replace and remove in order", () => {
    const doc = { a: 1, b: { c: 2 } };
    const result = applied(doc, [
      { op: "add", path: "/d", value: [1, 2] },
      { op: "replace", path: "/b/c", value: 3 },
      { op: "remove", path: "/a" },
      { op: "add", path: "/b/e", value: null },
    ]);
    expect(result).toEqual({ b: { c: 3, e: null }, d: [1, 2] });
  });

  test("an empty patch returns an equal document", () => {
    expect(applied({ a: [1] }, [])).toEqual({ a: [1] });
  });

  test("never changes its input, even a deeply frozen one", () => {
    const doc = deepFreeze({ a: { b: { c: 1 } }, list: [{ x: 1 }], gone: 1 });
    const snapshot = copy(doc);
    const ops: Patch = [
      { op: "replace", path: "/a/b/c", value: 2 },
      { op: "add", path: "/a/new", value: { deep: true } },
      { op: "remove", path: "/gone" },
      { op: "replace", path: "/list", value: [] },
    ];
    expect(applied(doc, ops)).toEqual({ a: { b: { c: 2 }, new: { deep: true } }, list: [] });
    expect(doc).toEqual(snapshot);
  });

  test("a failed patch returns a failure and changes nothing", () => {
    const doc = deepFreeze({ a: 1 });
    const result = applyPatch(doc, [
      { op: "replace", path: "/a", value: 2 },
      { op: "remove", path: "/missing" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(1);
      expect(result.message).toMatch(/\/missing/);
    }
    expect(doc).toEqual({ a: 1 });
  });

  test("remove of a missing path is refused", () => {
    expect(applyPatch({ a: {} }, [{ op: "remove", path: "/a/b" }]).ok).toBe(false);
    expect(applyPatch({ a: 1 }, [{ op: "remove", path: "/x/y" }]).ok).toBe(false);
  });

  test("replace of a missing path is refused", () => {
    expect(applyPatch({ a: {} }, [{ op: "replace", path: "/a/b", value: 1 }]).ok).toBe(false);
    expect(applyPatch({}, [{ op: "replace", path: "/x/y", value: 1 }]).ok).toBe(false);
  });

  test("add whose parent is missing, or is not an object, is refused", () => {
    expect(applyPatch({}, [{ op: "add", path: "/a/b", value: 1 }]).ok).toBe(false);
    expect(applyPatch({ a: 1 }, [{ op: "add", path: "/a/b", value: 1 }]).ok).toBe(false);
    expect(applyPatch({ a: null }, [{ op: "add", path: "/a/b", value: 1 }]).ok).toBe(false);
    expect(applyPatch({ a: [1] }, [{ op: "add", path: "/a/0", value: 1 }]).ok).toBe(false);
    expect(applyPatch({ a: [{ b: 1 }] }, [{ op: "replace", path: "/a/0/b", value: 2 }]).ok).toBe(false);
  });

  test("add of an existing key replaces it, as RFC 6902 says", () => {
    expect(applied({ a: 1 }, [{ op: "add", path: "/a", value: 2 }])).toEqual({ a: 2 });
  });

  test("the whole document can be added over or replaced, but not removed", () => {
    expect(applied({ a: 1 }, [{ op: "replace", path: "", value: [1] }])).toEqual([1]);
    expect(applied({ a: 1 }, [{ op: "add", path: "", value: 7 }])).toBe(7);
    expect(applyPatch({ a: 1 }, [{ op: "remove", path: "" }]).ok).toBe(false);
  });

  test("refuses malformed operations from stored data", () => {
    const bad = (op: unknown): boolean => applyPatch({ a: 1 }, [op as Patch[number]]).ok;
    expect(bad({ op: "move", from: "/a", path: "/b" })).toBe(false);
    expect(bad({ op: "add", path: "a", value: 1 })).toBe(false);
    expect(bad({ op: "add", path: "/a~2", value: 1 })).toBe(false);
    expect(bad({ op: "add", path: "/a~", value: 1 })).toBe(false);
    expect(bad({ op: "add", path: 5, value: 1 })).toBe(false);
    expect(bad({ op: "add", path: "/b" })).toBe(false);
    expect(bad({ op: "replace", path: "/a" })).toBe(false);
  });

  test("handles the key __proto__ as data, not as the prototype", () => {
    const doc = JSON.parse('{"a":1}') as JsonValue;
    const target = JSON.parse('{"a":1,"__proto__":{"x":1}}') as JsonValue;
    const ops = diff(doc, target);
    expect(ops).toEqual([{ op: "add", path: "/__proto__", value: { x: 1 } }]);
    const result = applied(doc, ops);
    expect(Object.keys(result as object)).toEqual(["a", "__proto__"]);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(applied(result, diff(target, doc))).toEqual(doc);
  });
});

describe("round trips", () => {
  test("hand-built cases", () => {
    const cases: [JsonValue, JsonValue][] = [
      [{}, {}],
      [{}, { a: 1 }],
      [{ a: 1 }, {}],
      [{ a: "" }, { a: "x" }],
      [{ a: "x" }, { a: "" }],
      [{ a: null }, { a: 0 }],
      [{ a: [] }, { a: [[]] }],
      [{ a: { b: { c: { d: 1 } } } }, { a: { b: { c: { d: 2, e: [1] } } } }],
      [{ a: { b: 1 } }, { a: [{ b: 1 }] }],
      [
        { schemaVersion: 1, elements: { p1: { id: "p1", name: "Pay" } }, views: {} },
        { schemaVersion: 1, elements: { p1: { id: "p1", name: "Pay it" }, p2: { id: "p2", name: "" } }, views: {} },
      ],
      [1, 2],
      [{ a: 1 }, [1]],
      [null, { a: null }],
    ];
    for (const [a, b] of cases) expectRoundTrip(a, b);
  });

  test("a generated loop over random pairs of documents", () => {
    let seed = 20260101;
    const random = (): number => {
      // mulberry32, so the loop is the same on every run
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const keys = ["a", "b", "c", "a/b", "m~n", "", "id", "name"];
    const make = (depth: number): JsonValue => {
      const kind = random();
      if (kind < 0.12) return null;
      if (kind < 0.22) return random() < 0.5;
      if (kind < 0.36) return Math.floor(random() * 4);
      if (kind < 0.5) return pick(["", "x", "y z"]);
      if (depth === 0) return pick([1, "s", null]);
      if (kind < 0.62) return Array.from({ length: Math.floor(random() * 3) }, () => make(depth - 1));
      const entries = Array.from({ length: Math.floor(random() * 5) }, () => [pick(keys), make(depth - 1)] as const);
      return Object.fromEntries(entries);
    };
    // Mutate a copy so that pairs share structure, which exercises the recursive cases.
    const mutate = (value: JsonValue, depth: number): JsonValue => {
      if (typeof value !== "object" || value === null || Array.isArray(value) || depth === 0 || random() < 0.15) {
        return random() < 0.5 ? value : make(2);
      }
      const next: Record<string, JsonValue> = { ...(value as { readonly [key: string]: JsonValue }) };
      for (const key of Object.keys(next)) {
        const roll = random();
        if (roll < 0.2) delete next[key];
        else if (roll < 0.5) next[key] = mutate(next[key] as JsonValue, depth - 1);
      }
      if (random() < 0.5) next[pick(keys)] = make(2);
      return next;
    };
    for (let i = 0; i < 500; i++) {
      const a = make(3);
      const b = random() < 0.7 ? mutate(a, 3) : make(3);
      expectRoundTrip(a, b);
      expect(diff(a, a)).toEqual([]);
      if (JSON.stringify(a) === JSON.stringify(b)) expect(diff(a, b)).toEqual([]);
    }
  });
});
