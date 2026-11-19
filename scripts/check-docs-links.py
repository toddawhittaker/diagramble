#!/usr/bin/env python3
"""Fail on relative links and images in Markdown files that point nowhere,
and on decision history in the documents that must state only the current truth.

Checks every tracked Markdown file. Web links and in-page anchors are not
checked. The history check covers HISTORY_FREE only (CLAUDE.md, "Where things
are documented").
"""
import os
import re
import subprocess
import sys
from urllib.parse import unquote

INLINE = re.compile(r"!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
REFERENCE = re.compile(r"^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$")
HTML_SRC = re.compile(r"<(?:img|source)\b[^>]*\b(?:src|srcset)=\"([^\"]+)\"", re.IGNORECASE)
HTML_HREF = re.compile(r"<a\b[^>]*\bhref=\"([^\"]+)\"", re.IGNORECASE)
SKIPPED = ()
HISTORY_FREE = ("docs/SPEC.md", "docs/VISION.md", "docs/EPICS.md")
HISTORY = re.compile(
    r"\b(?:decided|dropped|deferred|settled|confirmed|restored|revised|reversed)"
    r"\s+(?:on|in)\s+(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July"
    r"|August|September|October|November|December|\d{4})"
    r"|\b(?:was|were)\s+(?:dropped|restored|reversed)\b"
    r"|\bthe (?:user|author) (?:decided|changed|asked|confirmed)\b",
    re.IGNORECASE,
)


def targets(line):
    for pattern in (INLINE, REFERENCE, HTML_SRC, HTML_HREF):
        for match in pattern.finditer(line):
            yield match.group(1)


def is_external(target):
    return re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith(("#", "//"))


def check(path):
    problems = []
    in_fence = False
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            if line.lstrip().startswith(("```", "~~~")):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            # Inline code often shows link syntax as an example.
            line = re.sub(r"`[^`]*`", "", line)
            for target in targets(line):
                if is_external(target):
                    continue
                file_part = unquote(target.split("#", 1)[0].split("?", 1)[0])
                if not file_part:
                    continue
                base = "." if file_part.startswith("/") else os.path.dirname(path)
                resolved = os.path.normpath(os.path.join(base, file_part.lstrip("/")))
                if not os.path.exists(resolved):
                    problems.append(f"{path}:{number}: {target} does not exist")
    return problems


def check_history(path):
    problems = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            match = HISTORY.search(line)
            if match:
                problems.append(f"{path}:{number}: decision history \"{match.group(0)}\"; state the current truth instead")
    return problems


def main():
    listed = subprocess.run(
        ["git", "ls-files", "*.md"], check=True, capture_output=True, text=True
    )
    files = [f for f in listed.stdout.split("\n") if f and not f.startswith(SKIPPED)]
    problems = []
    for path in files:
        if os.path.exists(path):
            problems.extend(check(path))
            if path in HISTORY_FREE:
                problems.extend(check_history(path))
    for problem in problems:
        print(problem)
    if problems:
        print(f"check-docs-links: {len(problems)} problem(s)")
        return 1
    print(f"check-docs-links: {len(files)} Markdown files checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
