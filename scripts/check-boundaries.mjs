#!/usr/bin/env node
// Fails when a file in packages/model, packages/rules or packages/cases imports
// anything but its own files or a package listed in its own package.json
// dependencies (in test files also vitest or a listed devDependency), or holds
// a `/// <reference ...>` directive, which pulls in Node or DOM globals without
// an import. SPEC.md section 12: these packages stay free of React, the browser
// and the server. Hoisted packages resolve by name from any folder, so the
// typecheck alone cannot hold the line.
//
// The scan is textual. It never strips a trailing `//` comment, because `//`
// inside a string would then hide the rest of the line; a specifier in a
// trailing comment is reported, which errs on the side of failing.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGES = ["packages/model", "packages/rules", "packages/cases"];
const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;
// `from "x"`, `import "x"` and `import("x")`, with any of the three quotes, since
// import(`x`) loads a package too.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'`]([^"'`]+)["'`]/g;

function sourceFiles(dir) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "dist") continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...sourceFiles(path));
		else if (SOURCE.test(entry.name)) found.push(path);
	}
	return found;
}

const REFERENCE = /^[ \t]*\/\/\/\s*<reference\b/;

// Blanks block comments, keeping their newlines so line numbers stay right.
function withoutBlockComments(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// Blanks lines that are only a `//` comment.
function withoutCommentLines(text) {
	return text.replace(/^[ \t]*\/\/.*$/gm, "");
}

function packageNameOf(specifier) {
	const parts = specifier.split("/");
	return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isAllowed(specifier, file, packageDir, dependencies, devDependencies) {
	if (specifier.startsWith("./") || specifier.startsWith("../")) {
		const target = relative(packageDir, resolve(dirname(file), specifier));
		return !target.startsWith("..");
	}
	if (TEST.test(file) && (specifier === "vitest" || devDependencies.has(packageNameOf(specifier)))) {
		return true;
	}
	return dependencies.has(packageNameOf(specifier));
}

// Returns a message for each import the package may not make.
export function findViolations(packageDir) {
	const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	const dependencies = new Set(Object.keys(manifest.dependencies ?? {}));
	const devDependencies = new Set(Object.keys(manifest.devDependencies ?? {}));
	const violations = [];
	for (const file of sourceFiles(packageDir)) {
		const blockFree = withoutBlockComments(readFileSync(file, "utf8"));
		const name = relative(process.cwd(), file);
		blockFree.split("\n").forEach((text, index) => {
			if (REFERENCE.test(text)) {
				violations.push(`${name}:${index + 1}: a reference directive brings in globals without an import`);
			}
		});
		const text = withoutCommentLines(blockFree);
		for (const match of text.matchAll(SPECIFIER)) {
			const specifier = match[1];
			if (isAllowed(specifier, file, packageDir, dependencies, devDependencies)) continue;
			const line = text.slice(0, match.index).split("\n").length;
			violations.push(
				`${name}:${line}: "${specifier}" is not a relative path inside the package or a listed dependency`,
			);
		}
	}
	return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const violations = PACKAGES.flatMap((p) => findViolations(join(root, p)));
	for (const message of violations) console.error(message);
	process.exit(violations.length === 0 ? 0 : 1);
}
