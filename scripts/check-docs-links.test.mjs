import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { findProblems, listMarkdownFiles } from "./check-docs-links.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-docs-links.mjs");
const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

// Writes the given files into a fresh folder and returns it.
function fixture(files) {
	const root = mkdtempSync(join(tmpdir(), "docs-links-"));
	roots.push(root);
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), text);
	}
	return root;
}

// Problems found in `files`, a map of path to text, that all exist.
function problemsFor(files) {
	return findProblems(Object.keys(files), fixture(files));
}

test("accepts links and images that point at existing files", () => {
	assert.deepEqual(
		problemsFor({
			"a.md": "[b](b.md) ![pic](img/p.png) [up](sub/c.md)\n",
			"b.md": "text\n",
			"img/p.png": "x",
			"sub/c.md": "[home](../a.md)\n",
		}),
		[],
	);
});

test("reports a broken inline link with its file, line and target", () => {
	assert.deepEqual(problemsFor({ "a.md": "ok\n[x](missing.md)\n" }), ["a.md:2: missing.md does not exist"]);
});

test("reports a broken image", () => {
	assert.deepEqual(problemsFor({ "a.md": "![x](nope.png)\n" }), ["a.md:1: nope.png does not exist"]);
});

test("reports each broken link on a line", () => {
	assert.deepEqual(problemsFor({ "a.md": "[x](one.md) and [y](two.md)\n" }), [
		"a.md:1: one.md does not exist",
		"a.md:1: two.md does not exist",
	]);
});

test("resolves a link against the folder of the file that holds it", () => {
	const problems = problemsFor({ "docs/a.md": "[x](b.md) [y](../c.md)\n", "docs/b.md": "", "c.md": "" });
	assert.deepEqual(problems, []);
	assert.deepEqual(problemsFor({ "docs/a.md": "[x](c.md)\n" }), ["docs/a.md:1: c.md does not exist"]);
});

test("resolves a link that starts with a slash against the repository root", () => {
	assert.deepEqual(problemsFor({ "docs/a.md": "[x](/top.md)\n", "top.md": "" }), []);
	assert.deepEqual(problemsFor({ "docs/a.md": "[x](/b.md)\n", "docs/b.md": "" }), [
		"docs/a.md:1: /b.md does not exist",
	]);
});

test("ignores web links, other schemes and protocol-relative links", () => {
	assert.deepEqual(
		problemsFor({
			"a.md": "[w](https://example.com/x.md) [m](mailto:a@b.c) [p](//example.com/x) [t](tel:1)\n",
		}),
		[],
	);
});

test("ignores an in-page anchor and checks only the file part of a link with an anchor", () => {
	assert.deepEqual(problemsFor({ "a.md": "[x](#top) [y](b.md#part)\n", "b.md": "" }), []);
	assert.deepEqual(problemsFor({ "a.md": "[y](gone.md#part)\n" }), ["a.md:1: gone.md#part does not exist"]);
});

test("drops a query string before checking the file", () => {
	assert.deepEqual(problemsFor({ "a.md": "[y](b.md?x=1)\n", "b.md": "" }), []);
	assert.deepEqual(problemsFor({ "a.md": "[y](b.md?x=1#z)\n", "b.md": "" }), []);
});

test("decodes a URL-encoded path before checking it", () => {
	assert.deepEqual(problemsFor({ "a.md": "[y](my%20doc.md)\n", "my doc.md": "" }), []);
	assert.deepEqual(problemsFor({ "a.md": "[y](my%20doc.md)\n" }), ["a.md:1: my%20doc.md does not exist"]);
});

test("reports an invalid percent sequence as missing instead of crashing", () => {
	assert.deepEqual(problemsFor({ "a.md": "[y](bad%ZZ.md) [z](%E0%A4%A.md)\n" }), [
		"a.md:1: bad%ZZ.md does not exist",
		"a.md:1: %E0%A4%A.md does not exist",
	]);
});

test("accepts a link wrapped in angle brackets and one with a title", () => {
	assert.deepEqual(problemsFor({ "a.md": '[x](<b.md>) [y](b.md "Title")\n', "b.md": "" }), []);
	assert.deepEqual(problemsFor({ "a.md": '[y](gone.md "Title")\n' }), ["a.md:1: gone.md does not exist"]);
});

test("checks reference-style definitions", () => {
	assert.deepEqual(problemsFor({ "a.md": "[x][r]\n\n[r]: b.md\n[s]: <b.md> title here\n", "b.md": "" }), []);
	assert.deepEqual(problemsFor({ "a.md": "[r]: gone.md\n" }), ["a.md:1: gone.md does not exist"]);
	assert.deepEqual(problemsFor({ "a.md": "  [r]: https://example.com\n" }), []);
});

test("checks the src of img and source tags and the href of a tags", () => {
	assert.deepEqual(
		problemsFor({
			"a.md": '<img alt="x" src="p.png">\n<source srcset="q.png">\n<a class="k" href="b.md">b</a>\n',
			"p.png": "",
			"q.png": "",
			"b.md": "",
		}),
		[],
	);
	assert.deepEqual(problemsFor({ "a.md": '<IMG src="p.png"> <a href="b.md">b</a>\n' }), [
		"a.md:1: p.png does not exist",
		"a.md:1: b.md does not exist",
	]);
});

test("ignores links inside fenced code blocks, backtick or tilde", () => {
	assert.deepEqual(
		problemsFor({ "a.md": "```md\n[x](gone.md)\n```\n~~~\n[y](gone.md)\n~~~\n  ```\n[z](gone.md)\n  ```\n" }),
		[],
	);
});

test("checks links again after a fence closes", () => {
	assert.deepEqual(problemsFor({ "a.md": "```\n[x](gone.md)\n```\n[y](gone2.md)\n" }), [
		"a.md:4: gone2.md does not exist",
	]);
});

test("ignores link syntax inside inline code", () => {
	assert.deepEqual(problemsFor({ "a.md": "Write `[x](gone.md)` for a link. [y](b.md)\n", "b.md": "" }), []);
});

test("counts lines the same way for CRLF and lone CR line endings", () => {
	assert.deepEqual(problemsFor({ "a.md": "one\r\n[x](gone.md)\r\n" }), ["a.md:2: gone.md does not exist"]);
	assert.deepEqual(problemsFor({ "a.md": "one\r[x](gone.md)\r" }), ["a.md:2: gone.md does not exist"]);
});

test("skips a listed file that does not exist", () => {
	assert.deepEqual(findProblems(["ghost.md"], fixture({})), []);
});

test("reports problems file by file in the order given", () => {
	assert.deepEqual(problemsFor({ "a.md": "[x](1.md)\n", "b.md": "[x](2.md)\n" }), [
		"a.md:1: 1.md does not exist",
		"b.md:1: 2.md does not exist",
	]);
});

test("rejects decision history in the specification and the vision, but not elsewhere", () => {
	const text = "Offline mode was dropped.\nThe user decided to keep it.\nThis was decided on 12 March 2026.\n";
	assert.deepEqual(problemsFor({ "docs/SPEC.md": text }), [
		'docs/SPEC.md:1: decision history "was dropped"; state the current truth instead',
		'docs/SPEC.md:2: decision history "The user decided"; state the current truth instead',
		'docs/SPEC.md:3: decision history "decided on 12 March"; state the current truth instead',
	]);
	assert.equal(problemsFor({ "docs/VISION.md": text }).length, 3);
	assert.equal(problemsFor({ "docs/EPICS.md": text }).length, 3);
	assert.deepEqual(problemsFor({ "docs/OTHER.md": text }), []);
});

test("the history check also reads lines inside code fences and matches without regard to case", () => {
	assert.deepEqual(problemsFor({ "docs/SPEC.md": "```\nDROPPED IN 2026\n```\n" }), [
		'docs/SPEC.md:2: decision history "DROPPED IN 2026"; state the current truth instead',
	]);
});

test("accepts plain present-tense text in the specification", () => {
	assert.deepEqual(problemsFor({ "docs/SPEC.md": "Models are saved as JSON. Rules are decided by the author.\n" }), []);
});

// Runs the script in a git repository that holds `files`, committed or not.
function runIn(files) {
	const root = fixture(files);
	execFileSync("git", ["init", "-q"], { cwd: root });
	execFileSync("git", ["add", "."], { cwd: root });
	const run = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
	return { root, listed: listMarkdownFiles(root), status: run.status, out: run.stdout, err: run.stderr };
}

test("lists the tracked Markdown files in any folder, including names with non-ASCII letters", () => {
	const { listed } = runIn({ "a.md": "", "docs/b.md": "", "é.md": "", "notes.txt": "" });
	assert.deepEqual([...listed].sort(), ["a.md", "docs/b.md", "é.md"]);
});

test("the command prints the file count and exits 0 when every link resolves", () => {
	const { status, out } = runIn({ "a.md": "[b](b.md)\n", "b.md": "" });
	assert.equal(status, 0);
	assert.equal(out, "check-docs-links: 2 Markdown files checked\n");
});

test("the command prints each problem and the total, and exits 1, when a link is broken", () => {
	const { status, out } = runIn({ "a.md": "[b](gone.md) [c](gone2.md)\n" });
	assert.equal(status, 1);
	assert.equal(out, "a.md:1: gone.md does not exist\na.md:1: gone2.md does not exist\ncheck-docs-links: 2 problem(s)\n");
});
