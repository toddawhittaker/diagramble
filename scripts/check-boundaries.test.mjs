import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { findViolations } from "./check-boundaries.mjs";

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

// Builds a package folder holding the given files, with `zod` as its one dependency.
function fixture(files) {
	const root = mkdtempSync(join(tmpdir(), "boundaries-"));
	roots.push(root);
	const pkg = join(root, "pkg");
	const all = { "package.json": JSON.stringify({ dependencies: { zod: "1.0.0" } }), ...files };
	for (const [name, text] of Object.entries(all)) {
		mkdirSync(dirname(join(pkg, name)), { recursive: true });
		writeFileSync(join(pkg, name), text);
	}
	return pkg;
}

test("accepts a relative import, a listed dependency and vitest in a test file", () => {
	const pkg = fixture({
		"src/a.ts": 'import { b } from "./b.ts";\nimport { z } from "zod";\nexport { b, z };\n',
		"src/b.ts": "export const b = 1;\n",
		"src/a.test.ts": 'import { test } from "vitest";\nimport "../src/b.ts";\ntest("x", () => {});\n',
	});
	assert.deepEqual(findViolations(pkg), []);
});

test("ignores a specifier that appears only in a comment", () => {
	const pkg = fixture({ "src/a.ts": '// import "react";\n/* from "fs" */\nexport const a = 1;\n' });
	assert.deepEqual(findViolations(pkg), []);
});

const FAILING = [
	["react", 'import { useState } from "react";\n'],
	["node:fs", 'import { readFileSync } from "node:fs";\n'],
	["fs", 'import { readFileSync } from "fs";\n'],
	["an unlisted hoisted package", 'import { Kysely } from "kysely";\n'],
	["a relative path that escapes the package", 'export { x } from "../../outside.ts";\n'],
	["a dynamic import", 'export const load = () => import("react");\n'],
	["a side-effect import", 'import "react";\n'],
	["an export from", 'export * from "react";\n'],
];

for (const [name, source] of FAILING) {
	test(`rejects ${name}`, () => {
		const violations = findViolations(fixture({ "src/a.ts": source }));
		assert.equal(violations.length, 1);
		assert.match(violations[0], /src\/a\.ts:1: /);
	});
}

test("rejects vitest in a file that is not a test", () => {
	const violations = findViolations(fixture({ "src/a.ts": 'import { expect } from "vitest";\n' }));
	assert.equal(violations.length, 1);
	assert.match(violations[0], /"vitest"/);
});

test("reports the line of a multi-line import", () => {
	const violations = findViolations(
		fixture({ "src/a.ts": 'export const a = 1;\nimport {\n  x,\n} from "react";\n' }),
	);
	assert.equal(violations.length, 1);
	assert.match(violations[0], /src\/a\.ts:4: /);
});
