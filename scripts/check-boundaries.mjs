#!/usr/bin/env node
// Fails when a file in packages/model, packages/rules or packages/cases imports
// anything but its own files, a package listed in its own package.json
// dependencies, or (in test files) vitest. SPEC.md section 12: these packages
// stay free of React, the browser and the server. Hoisted packages resolve by
// name from any folder, so the typecheck alone cannot hold the line.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGES = ["packages/model", "packages/rules", "packages/cases"];
const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;
// `from "x"`, `import "x"` and `import("x")`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

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

// Blanks comments but keeps their newlines, so line numbers stay right.
function withoutComments(text) {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
		.replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function packageNameOf(specifier) {
	const parts = specifier.split("/");
	return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isAllowed(specifier, file, packageDir, dependencies) {
	if (specifier.startsWith("./") || specifier.startsWith("../")) {
		const target = relative(packageDir, resolve(dirname(file), specifier));
		return !target.startsWith("..");
	}
	if (specifier === "vitest" && TEST.test(file)) return true;
	return dependencies.has(packageNameOf(specifier));
}

// Returns a message for each import the package may not make.
export function findViolations(packageDir) {
	const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	const dependencies = new Set(Object.keys(manifest.dependencies ?? {}));
	const violations = [];
	for (const file of sourceFiles(packageDir)) {
		const text = withoutComments(readFileSync(file, "utf8"));
		for (const match of text.matchAll(SPECIFIER)) {
			const specifier = match[1];
			if (isAllowed(specifier, file, packageDir, dependencies)) continue;
			const line = text.slice(0, match.index).split("\n").length;
			violations.push(
				`${relative(process.cwd(), file)}:${line}: "${specifier}" is not a relative path inside the package or a listed dependency`,
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
