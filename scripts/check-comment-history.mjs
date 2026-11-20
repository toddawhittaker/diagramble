#!/usr/bin/env node
// Fails when a code comment or test title carries project history (issue
// numbers, epic or task names, rulings, review codes, plan pointers) instead
// of citing SPEC.md sections, and warns about overlong source files.
// Rules: .claude/agents/builder.md, "Code quality".
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Two to five digits: skips HTML entities like &#43;, hex colours with a letter
// and six- or eight-digit colours such as #333333.
const BARE_HASH = /(?<![&\w])#\d{2,5}(?![\w])/g;

const PATTERNS = [
	{ name: "issue reference", re: /\bissues? #?\d+/gi },
	{ name: "issue reference", re: BARE_HASH },
	{ name: "pull request reference", re: /\bPRs? #?\d+/g },
	{ name: "epic reference", re: /\bEpics? \d+/gi },
	{ name: "task reference", re: /\b[Tt]asks? T?\d+\b/g },
	{ name: "ruling reference", re: /\brulings? [A-Z]?\d+/gi },
	{ name: "review code", re: /\breview [A-Z]\d+/gi },
	{ name: "epic plan pointer", re: /docs\/archive\/epics|EPIC-\d/g },
];

// Paths not scanned.
const SKIPPED = [];

function kindOf(path) {
	if (SKIPPED.some((re) => re.test(path))) return null;
	const base = path.split("/").pop();
	if (base === "Makefile") return "hash";
	if (/\.(ts|tsx|mts|cts|mjs|cjs|js|css)$/.test(path)) return "c";
	if (/\.(sh|bash|ya?ml|py|tf|service|timer)$/.test(path)) return "hash";
	if (/\.j2$/.test(path)) return "jinja";
	return null;
}

// Skips the string literal opening at i; returns the index past it and the line.
function skipString(src, start, startLine) {
	const quote = src[start];
	let i = start + 1;
	let line = startLine;
	while (i < src.length && src[i] !== quote) {
		if (src[i] === "\\") {
			i++;
		} else if (src[i] === "\n") {
			line++;
			if (quote !== "`") break;
		}
		i++;
	}
	return { i: i + 1, line };
}

// A "/" after one of these characters or words starts a regex, not a division.
const REGEX_AFTER_CHAR = "(,=:[!&|?{};+-*%<>~^";
const REGEX_AFTER_WORD = /(?:^|[^\w$])(?:return|typeof|case|in|of|void|delete|throw)$/;

function regexAllowed(src, at) {
	let j = at - 1;
	while (j >= 0 && /\s/.test(src[j])) j--;
	if (j < 0) return true;
	if (REGEX_AFTER_CHAR.includes(src[j])) return true;
	return REGEX_AFTER_WORD.test(src.slice(Math.max(0, j - 8), j + 1));
}

// Skips the regex literal opening at start; returns the index past its end.
function skipRegex(src, start) {
	let i = start + 1;
	let inClass = false;
	while (i < src.length && src[i] !== "\n") {
		if (src[i] === "\\") i++;
		else if (src[i] === "[") inClass = true;
		else if (src[i] === "]") inClass = false;
		else if (src[i] === "/" && !inClass) return i + 1;
		i++;
	}
	return i;
}

// Pushes each line of the block comment opening at start onto out; returns
// the index past its end and the line it ends on.
function readBlockComment(src, start, startLine, out) {
	const end = src.indexOf("*/", start + 2);
	const stop = end === -1 ? src.length : end;
	const lines = src.slice(start + 2, stop).split("\n");
	lines.forEach((text, n) => {
		out.push({ line: startLine + n, text });
	});
	return { i: stop + 2, line: startLine + lines.length - 1 };
}

// Returns [{ line, text }] per comment line; string and regex literals are
// skipped so "https://" or a backtick inside them is not taken for code.
function cComments(src, isCss) {
	const out = [];
	let line = 1;
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (ch === "\n") {
			line++;
			i++;
		} else if (ch === "/" && src[i + 1] === "/") {
			const end = src.indexOf("\n", i);
			const stop = end === -1 ? src.length : end;
			out.push({ line, text: src.slice(i + 2, stop) });
			i = stop;
		} else if (ch === "/" && src[i + 1] === "*") {
			({ i, line } = readBlockComment(src, i, line, out));
		} else if (ch === '"' || ch === "'" || ch === "`") {
			({ i, line } = skipString(src, i, line));
		} else if (ch === "/" && !isCss && regexAllowed(src, i)) {
			i = skipRegex(src, i);
		} else {
			i++;
		}
	}
	return out;
}

// Index of the first "#" comment start outside quotes, or -1.
function hashStart(text) {
	let quote = "";
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === "\\" && quote === '"') i++;
			else if (ch === quote) quote = "";
		} else if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (
			ch === "#" &&
			(i === 0 || /\s/.test(text[i - 1])) &&
			text[i + 1] !== "!"
		) {
			return i;
		}
	}
	return -1;
}

function hashComments(src) {
	const out = [];
	src.split("\n").forEach((text, n) => {
		const at = hashStart(text);
		if (at !== -1) out.push({ line: n + 1, text: text.slice(at) });
	});
	return out;
}

function jinjaComments(src) {
	// Blank out {# #} blocks first so the hash scan does not see them twice.
	const out = hashComments(
		src.replace(/\{#[\s\S]*?#\}/g, (m) => m.replace(/[^\n]/g, " ")),
	);
	for (const m of src.matchAll(/\{#([\s\S]*?)#\}/g)) {
		const first = src.slice(0, m.index).split("\n").length;
		m[1].split("\n").forEach((text, n) => {
			out.push({ line: first + n, text });
		});
	}
	return out;
}

const lineAt = (src, index) => src.slice(0, index).split("\n").length;

// Matches a quoted title at the sticky position: optional space, then the string.
const TITLE = /\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/y;

// Returns the index past the parenthesis group opening at start, skipping
// strings and comments inside it; src.length when it is never closed.
function skipParens(src, start) {
	let depth = 0;
	let i = start;
	while (i < src.length) {
		const ch = src[i];
		if (ch === "(") {
			depth++;
			i++;
		} else if (ch === ")") {
			i++;
			if (--depth === 0) return i;
		} else if (ch === '"' || ch === "'" || ch === "`") {
			i = skipString(src, i, 0).i;
		} else if (ch === "/" && src[i + 1] === "/") {
			const end = src.indexOf("\n", i);
			i = end === -1 ? src.length : end;
		} else if (ch === "/" && src[i + 1] === "*") {
			const end = src.indexOf("*/", i + 2);
			i = end === -1 ? src.length : end + 2;
		} else {
			i++;
		}
	}
	return i;
}

// The index of the "(" that opens the title call after test.each(table) or
// test.each`table`, or -1 when the call is not followed by one.
function eachTitleCall(src, at) {
	let i = at;
	while (/\s/.test(src[i] ?? "")) i++;
	if (src[i] === "(") i = skipParens(src, i);
	else if (src[i] === "`") i = skipString(src, i, 0).i;
	else return -1;
	while (/\s/.test(src[i] ?? "")) i++;
	return src[i] === "(" ? i : -1;
}

function testTitles(src) {
	const out = [];
	const re =
		/(?<![.\w$])(?:test|it|describe)(?:\.\w+)*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
	for (const m of src.matchAll(re)) {
		out.push({ line: lineAt(src, m.index), text: m[2] });
	}
	// The curried form: test.each(table)("title") and test.each`table`("title").
	const each = /(?<![.\w$])(?:test|it|describe)(?:\.\w+)*\.each(?![\w$])/g;
	for (const m of src.matchAll(each)) {
		const call = eachTitleCall(src, m.index + m[0].length);
		if (call === -1) continue;
		TITLE.lastIndex = call + 1;
		const title = TITLE.exec(src);
		if (!title) continue;
		const quote = call + 1 + title[0].indexOf(title[1]);
		out.push({ line: lineAt(src, quote), text: title[2] });
	}
	return out;
}

export function scanText(path, src) {
	const kind = kindOf(path);
	if (!kind) return [];
	let spans;
	if (kind === "c") spans = cComments(src, path.endsWith(".css"));
	else if (kind === "jinja") spans = jinjaComments(src);
	else spans = hashComments(src);
	if (/\.(test|spec)\.tsx?$/.test(path)) spans = spans.concat(testTitles(src));
	const hits = [];
	for (const { line, text } of spans) {
		const hit = firstHit(path, text);
		if (hit) hits.push({ path, line, ...hit });
	}
	return hits;
}

// The first history pattern in one comment line, if any. One hit per comment
// line is enough to point the reader at it.
function firstHit(path, text) {
	const clean = text;
	for (const { name, re } of PATTERNS) {
		// In a stylesheet a bare short number is a colour; an explicit "issue" prefix still hits.
		if (re === BARE_HASH && path.endsWith(".css")) continue;
		const m = clean.match(new RegExp(re.source, re.flags.replace("g", "")));
		if (m) return { name, match: m[0] };
	}
	return null;
}

// A source file past this many lines likely does two jobs and should be
// split (.claude/agents/builder.md, "Code quality"). Warn only, never fail.
export const MAX_LINES = 800;

// Tests and generated declarations may run long without doing two jobs.
const SIZE_EXEMPT = [
	/\.(test|spec)\.[cm]?[jt]sx?$/,
	/(^|\/)tests?\//,
	/^e2e\//,
	/(^|\/)test_[^/]+\.py$/,
	/-test\.sh$/,
	/\.d\.ts$/,
];

export function sizeWarning(path, src) {
	if (!/\.([cm]?[jt]sx?|css|sh|bash|py)$/.test(path)) return null;
	if (SKIPPED.some((re) => re.test(path))) return null;
	if (SIZE_EXEMPT.some((re) => re.test(path))) return null;
	const lines = src.split("\n").length - (src.endsWith("\n") ? 1 : 0);
	return lines > MAX_LINES ? { path, lines } : null;
}

function main() {
	const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
		.split("\n")
		.filter((f) => f && kindOf(f));
	const hits = [];
	const long = [];
	for (const f of files) {
		let src;
		try {
			src = readFileSync(f, "utf8");
		} catch {
			continue; // listed but deleted in the working tree
		}
		hits.push(...scanText(f, src));
		const warning = sizeWarning(f, src);
		if (warning) long.push(warning);
	}
	for (const w of long) {
		console.warn(
			`warning: ${w.path} has ${w.lines} lines (over ${MAX_LINES}); split it where it does a second job.`,
		);
	}
	for (const h of hits) console.log(`${h.path}:${h.line}: ${h.name}: ${h.match}`);
	if (hits.length > 0) {
		console.error(
			`\n${hits.length} comment(s) carry project history. Cite a SPEC.md section instead.`,
		);
		process.exit(1);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
