import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { MAX_LINES, scanText, sizeWarning } from "./check-comment-history.mjs";

const SCRIPT = resolve(import.meta.dirname, "check-comment-history.mjs");
const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

// Builds a git repository holding the given files, all staged, and returns its path.
function repo(files) {
	const root = mkdtempSync(join(tmpdir(), "comment-history-"));
	roots.push(root);
	execFileSync("git", ["init", "-q"], { cwd: root });
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), text);
	}
	execFileSync("git", ["add", "."], { cwd: root });
	return root;
}

function run(cwd) {
	return spawnSync("node", [SCRIPT], { cwd, encoding: "utf8" });
}

const names = (hits) => hits.map((h) => h.name);

describe("what it flags in comments", () => {
	const flagged = [
		["an issue number", "// fixes issue #12", "issue reference"],
		["a bare hash number", "// see #123 for details", "issue reference"],
		["a pull request", "// from PR 7", "pull request reference"],
		["an epic", "// part of Epic 3", "epic reference"],
		["a task", "// task T4 adds this", "task reference"],
		["a ruling", "// ruling B2 says so", "ruling reference"],
		["a review code", "// review C1 asked for it", "review code"],
		["an epic plan path", "// see docs/archive/epics/one.md", "epic plan pointer"],
		["an epic plan file", "// per EPIC-1 row 4", "epic plan pointer"],
	];
	for (const [label, comment, name] of flagged) {
		test(`flags ${label}`, () => {
			const hits = scanText("src/a.ts", `const a = 1;\n${comment}\n`);
			assert.deepEqual(names(hits), [name]);
			assert.equal(hits[0].line, 2);
			assert.equal(hits[0].path, "src/a.ts");
		});
	}

	test("flags history inside a block comment and reports its own line", () => {
		const hits = scanText("src/a.ts", "/*\n * fine\n * added for Epic 2\n */\n");
		assert.deepEqual(hits.map((h) => h.line), [3]);
	});

	test("reports one hit per comment line", () => {
		const hits = scanText("src/a.ts", "// Epic 1 and issue #5 and PR 9\n");
		assert.equal(hits.length, 1);
	});

	test("flags a hash comment in shell, YAML and Python files", () => {
		for (const path of ["a.sh", "ci.yml", "tool.py", "Makefile"]) {
			assert.equal(scanText(path, "echo hi # epic 4\n").length, 1, path);
		}
	});

	test("flags both kinds of comment in a Jinja template", () => {
		const src = "{# written for Epic 2 #}\nkey: 1 # PR 8\n";
		const hits = scanText("conf.j2", src);
		assert.deepEqual(hits.map((h) => h.line).sort(), [1, 2]);
	});

	test("flags an issue reference in a stylesheet comment", () => {
		assert.equal(scanText("a.css", "/* issue #40 */\n").length, 1);
	});

	test("flags history in the title of a test, not a title that cites SPEC.md", () => {
		const bad = scanText("a.test.ts", 'it("handles the case from issue 9", () => {});\n');
		assert.equal(bad.length, 1);
		const nested = scanText("a.test.tsx", "describe.skip(`Epic 2 cases`, () => {});\n");
		assert.equal(nested.length, 1);
		const good = scanText("a.test.ts", 'test("rejects a cycle (SPEC.md 3.4)", () => {});\n');
		assert.deepEqual(good, []);
	});

	describe("a title in the curried each form", () => {
		const table = "[[1, 2], [3, 4]]";
		const forms = ["test", "it", "describe"].flatMap((fn) =>
			[
				fn,
				`${fn}.skip`,
				`${fn}.only`,
				`${fn}.concurrent`,
				`${fn}.concurrent.only`,
			].map((head) => `${head}.each`),
		);
		for (const head of forms) {
			test(`flags history in ${head}([...])("title")`, () => {
				const src = `${head}(${table})("handles issue 9 for %i", () => {});\n`;
				const hits = scanText("a.test.ts", src);
				assert.deepEqual(names(hits), ["issue reference"]);
				assert.equal(hits[0].line, 1);
			});

			test(`flags history in ${head}\`table\`("title")`, () => {
				const src = `${head}\`\n  a | b\n  \${1} | \${2}\n\`("part of Epic 3", () => {});\n`;
				const hits = scanText("a.test.ts", src);
				assert.deepEqual(names(hits), ["epic reference"]);
				assert.equal(hits[0].line, 4);
			});

			test(`lets a clean title through in ${head}`, () => {
				const src = `${head}(${table})("rejects a cycle (SPEC.md 3.4)", () => {});\n`;
				assert.deepEqual(scanText("a.test.ts", src), []);
			});
		}

		test("reports the line of the title, not of the each call", () => {
			const src = 'test.each([\n  [1],\n  [2],\n])(\n  "from PR 7",\n  () => {},\n);\n';
			const hits = scanText("a.test.ts", src);
			assert.deepEqual(hits.map((h) => h.line), [5]);
		});

		test("reads past quotes, parentheses and comments inside the table", () => {
			const src = [
				"test.each([",
				'  ["a (b", "it\'s"], // don\'t trip on this',
				"  /* ) */ [`c ) d`],",
				'])("see issue 5", () => {});',
				"",
			].join("\n");
			assert.deepEqual(scanText("a.test.ts", src).map((h) => h.line), [4]);
		});

		test("reads a title written in single quotes or backticks", () => {
			assert.equal(scanText("a.test.ts", "it.each([1])('task T4', () => {});\n").length, 1);
			assert.equal(scanText("a.test.ts", "it.each([1])(`task T4`, () => {});\n").length, 1);
		});

		test("reads a table held in a variable", () => {
			assert.equal(scanText("a.test.ts", 'test.each(cases)("Epic 2", () => {});\n').length, 1);
		});

		test("finds a second curried title after a first one", () => {
			const src = 'test.each([1])("ok", () => {});\ntest.each([2])("Epic 2", () => {});\n';
			assert.deepEqual(scanText("a.test.ts", src).map((h) => h.line), [2]);
		});

		test("ignores an each call with no title call after it", () => {
			assert.deepEqual(scanText("a.test.ts", "const t = test.each([1]);\nconst u = test.each([1]) ;\n"), []);
			assert.deepEqual(scanText("a.test.ts", "const t = test.each;\ntest.each([1\n"), []);
		});

		test("does not read an each call on some other object", () => {
			assert.deepEqual(scanText("a.test.ts", 'list.test.each([1])("Epic 2", () => {});\n'), []);
		});

		test("does not read the curried form in a file that is not a test file", () => {
			assert.deepEqual(scanText("a.ts", 'test.each([1])("Epic 2", () => {});\n'), []);
		});
	});

	test("does not read the title of a test in a file that is not a test file", () => {
		assert.deepEqual(scanText("a.ts", 'it("issue 9", () => {});\n'), []);
	});
});

describe("what it lets through", () => {
	test("ignores history-looking text inside string literals", () => {
		const src = 'const a = "see issue #12";\nconst b = \'Epic 3\';\nconst c = `PR 4\nEpic 5`;\n';
		assert.deepEqual(scanText("a.ts", src), []);
	});

	test("does not take // inside a string for a comment", () => {
		assert.deepEqual(scanText("a.ts", 'const u = "https://x.test"; const n = "Epic 1";\n'), []);
	});

	test("does not take a slash inside a regular expression for a comment", () => {
		const src = "const re = /a\\/\\/b[/]Epic 2/;\nconst ok = x / 2; // fine\n";
		assert.deepEqual(scanText("a.ts", src), []);
	});

	test("reads a comment after a division and after a keyword that takes a regex", () => {
		assert.equal(scanText("a.ts", "const x = a / b; // epic 1\n").length, 1);
		assert.equal(scanText("a.ts", "function f() { return /x/; } // epic 1\n").length, 1);
	});

	test("ignores a quote opened and never closed on one line", () => {
		assert.deepEqual(scanText("a.ts", "const a = 'oops\nconst b = 1; // fine\n"), []);
	});

	test("ignores a block comment that is never closed when it is clean", () => {
		assert.deepEqual(scanText("a.ts", "/* open and clean"), []);
	});

	test("lets short and long hash numbers through that are not issue numbers", () => {
		const src = "// colour #333333, entity &#43; and #1 and #123456\n";
		assert.deepEqual(scanText("a.ts", src), []);
	});

	test("lets a short hex colour in a stylesheet comment through but not an explicit issue", () => {
		assert.deepEqual(scanText("a.css", "/* use #123 here */\n"), []);
		assert.equal(scanText("a.css", "/* issue 123 */\n").length, 1);
	});

	test("lets ordinary wording through", () => {
		const src = "// Parses the file, then checks SPEC.md section 5.5 for each task in turn.\n";
		assert.deepEqual(scanText("a.ts", src), []);
	});

	test("does not treat a shebang or a hash inside quotes as a comment", () => {
		const src = '#!/usr/bin/env bash\necho "a # Epic 1" \'# PR 3\'\n';
		assert.deepEqual(scanText("a.sh", src), []);
	});

	test("does not treat a hash glued to a word as a comment", () => {
		assert.deepEqual(scanText("a.sh", "echo a#Epic 1\n"), []);
	});

	test("handles an escaped quote inside a double-quoted shell string", () => {
		assert.deepEqual(scanText("a.sh", 'echo "a \\" # Epic 1"\n'), []);
	});

	test("skips files of other kinds", () => {
		assert.deepEqual(scanText("README.md", "// Epic 1 issue #4\n"), []);
		assert.deepEqual(scanText("data.json", "// Epic 1\n"), []);
	});
});

describe("the size warning", () => {
	const lines = (n) => "x\n".repeat(n);

	test("warns on a source file over the limit and reports its length", () => {
		assert.deepEqual(sizeWarning("src/a.ts", lines(MAX_LINES + 1)), {
			path: "src/a.ts",
			lines: MAX_LINES + 1,
		});
	});

	test("does not warn at exactly the limit, with or without a final newline", () => {
		assert.equal(sizeWarning("src/a.ts", lines(MAX_LINES)), null);
		assert.equal(sizeWarning("src/a.ts", lines(MAX_LINES).trimEnd()), null);
	});

	test("does not warn for tests, declaration files, other file kinds or test folders", () => {
		const long = lines(MAX_LINES + 50);
		for (const path of [
			"src/a.test.ts",
			"scripts/a.spec.mjs",
			"src/types.d.ts",
			"tests/helper.ts",
			"e2e/flow.ts",
			"tools/test_a.py",
			"ci-test.sh",
			"README.md",
		]) {
			assert.equal(sizeWarning(path, long), null, path);
		}
	});
});

describe("running it", () => {
	test("exits 0 and prints nothing for a clean repository", () => {
		const r = run(repo({ "a.ts": "// Explains why.\nexport const a = 1;\n", "notes.md": "Epic 1\n" }));
		assert.equal(r.status, 0);
		assert.equal(r.stdout, "");
		assert.equal(r.stderr, "");
	});

	test("exits 1, lists each hit as path:line and says how many", () => {
		const r = run(
			repo({
				"src/a.ts": "const a = 1;\n// from Epic 2\n",
				"ci/run.sh": "echo # fixes issue #3\n",
				"src/ok.ts": "// clean\n",
			}),
		);
		assert.equal(r.status, 1);
		assert.match(r.stdout, /^src\/a\.ts:2: epic reference: Epic 2$/m);
		assert.match(r.stdout, /^ci\/run\.sh:1: issue reference: issue #3$/m);
		assert.doesNotMatch(r.stdout, /ok\.ts/);
		assert.match(r.stderr, /2 comment\(s\) carry project history\. Cite a SPEC\.md section instead\./);
	});

	test("warns about an overlong file on standard error but still exits 0", () => {
		const r = run(repo({ "big.ts": "export const a = 1;\n".repeat(MAX_LINES + 1) }));
		assert.equal(r.status, 0);
		assert.match(r.stderr, new RegExp(`warning: big\\.ts has ${MAX_LINES + 1} lines \\(over ${MAX_LINES}\\)`));
		assert.equal(r.stdout, "");
	});

	test("reports history and warns about length in the same run, failing on the history", () => {
		const r = run(
			repo({
				"big.ts": "export const a = 1;\n".repeat(MAX_LINES + 1),
				"a.ts": "// task T2\n",
			}),
		);
		assert.equal(r.status, 1);
		assert.match(r.stderr, /warning: big\.ts/);
		assert.match(r.stdout, /a\.ts:1: task reference/);
	});

	test("skips a file that git lists but that is deleted from the working tree", () => {
		const root = repo({ "gone.ts": "// Epic 1\n", "a.ts": "// clean\n" });
		rmSync(join(root, "gone.ts"));
		const r = run(root);
		assert.equal(r.status, 0);
		assert.equal(r.stdout, "");
	});

	test("does not run its checks when imported", () => {
		const r = spawnSync("node", ["-e", `import(${JSON.stringify(SCRIPT)})`], {
			cwd: repo({ "a.ts": "// Epic 1\n" }),
			encoding: "utf8",
		});
		assert.equal(r.status, 0);
		assert.equal(r.stdout, "");
	});
});
