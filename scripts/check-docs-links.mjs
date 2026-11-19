#!/usr/bin/env node
// Fails on relative links and images in Markdown files that point nowhere, and
// on decision history in the documents that must state only the current truth.
//
// Checks every tracked Markdown file. Web links and in-page anchors are not
// checked. The history check covers HISTORY_FREE only (CLAUDE.md, "Where things
// are documented").
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INLINE = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE = /^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/g;
const HTML_SRC = /<(?:img|source)\b[^>]*\b(?:src|srcset)="([^"]+)"/gi;
const HTML_HREF = /<a\b[^>]*\bhref="([^"]+)"/gi;
const HISTORY_FREE = ["docs/SPEC.md", "docs/VISION.md", "docs/EPICS.md"];
const HISTORY =
	/\b(?:decided|dropped|deferred|settled|confirmed|restored|revised|reversed)\s+(?:on|in)\s+(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December|\d{4})|\b(?:was|were)\s+(?:dropped|restored|reversed)\b|\bthe (?:user|author) (?:decided|changed|asked|confirmed)\b/i;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function* targets(line) {
	for (const pattern of [INLINE, REFERENCE, HTML_SRC, HTML_HREF]) {
		for (const match of line.matchAll(pattern)) yield match[1];
	}
}

function isExternal(target) {
	return SCHEME.test(target) || target.startsWith("#") || target.startsWith("//");
}

// Decodes %XX sequences; one that is not valid UTF-8 stays as written.
function unquote(text) {
	return text.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
		try {
			return decodeURIComponent(run);
		} catch {
			return run;
		}
	});
}

const lines = (text) => text.split(/\r\n|\r|\n/);

function checkLinks(path, root) {
	const problems = [];
	let inFence = false;
	lines(readFileSync(resolve(root, path), "utf8")).forEach((raw, index) => {
		const trimmed = raw.trimStart();
		if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
			inFence = !inFence;
			return;
		}
		if (inFence) return;
		// Inline code often shows link syntax as an example.
		const line = raw.replace(/`[^`]*`/g, "");
		for (const target of targets(line)) {
			if (isExternal(target)) continue;
			const filePart = unquote(target.split("#")[0].split("?")[0]);
			if (!filePart) continue;
			const base = filePart.startsWith("/") ? "." : posix.dirname(path);
			const resolved = posix.normalize(posix.join(base, filePart.replace(/^\/+/, "")));
			if (!existsSync(resolve(root, resolved))) problems.push(`${path}:${index + 1}: ${target} does not exist`);
		}
	});
	return problems;
}

function checkHistory(path, root) {
	const problems = [];
	lines(readFileSync(resolve(root, path), "utf8")).forEach((line, index) => {
		const match = HISTORY.exec(line);
		if (match) {
			problems.push(`${path}:${index + 1}: decision history "${match[0]}"; state the current truth instead`);
		}
	});
	return problems;
}

// Returns a message for each broken link and each piece of history in the
// given files, which are paths relative to `root`. A path that does not exist
// is skipped.
export function findProblems(files, root = ".") {
	const problems = [];
	for (const path of files) {
		if (!existsSync(resolve(root, path))) continue;
		problems.push(...checkLinks(path, root));
		if (HISTORY_FREE.includes(path)) problems.push(...checkHistory(path, root));
	}
	return problems;
}

// The tracked Markdown files under `root`. Git's -z output keeps names with
// non-ASCII letters unquoted.
export function listMarkdownFiles(root = ".") {
	const listed = execFileSync("git", ["ls-files", "-z", "*.md"], { cwd: root, encoding: "utf8" });
	return listed.split("\0").filter(Boolean);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const files = listMarkdownFiles();
	const problems = findProblems(files);
	for (const problem of problems) console.log(problem);
	if (problems.length > 0) {
		console.log(`check-docs-links: ${problems.length} problem(s)`);
		process.exit(1);
	}
	console.log(`check-docs-links: ${files.length} Markdown files checked`);
}
