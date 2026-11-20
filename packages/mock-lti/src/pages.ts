import { COURSES, PEOPLE, ROLE_NAMES } from "./seed.ts";
import { DEFECTS } from "./token.ts";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
label{display:block;margin-top:1rem;font-weight:600}select,button{font:inherit;margin-top:.25rem}
button{margin-top:1.5rem;padding:.5rem 1rem}iframe{width:100%;height:min(36rem, 80vh);border:2px solid #555}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function launchPage(toolUrl: string, formToken: string): string {
  const people = PEOPLE.map(
    (p) => `<option value="${p.key}">${escapeHtml(`${p.givenName} ${p.familyName} (${p.role})`)}</option>`,
  ).join("");
  const courses = COURSES.map((c) => `<option value="${c.key}">${escapeHtml(c.title)}</option>`).join("");
  const roles = ROLE_NAMES.map((r) => `<option value="${r}">${r}</option>`).join("");
  const defects = DEFECTS.map((d) => `<option value="${d}">${d}</option>`).join("");
  return page(
    "Mock LTI platform",
    `<main>
<h1>Mock LTI platform</h1>
<p>Opens Diagramble at ${escapeHtml(toolUrl)} as a seeded person. For development only.</p>
<form method="post" action="/start">
<input type="hidden" name="form_token" value="${escapeHtml(formToken)}">
<label for="person">Person</label>
<select id="person" name="person">${people}</select>
<label for="course">Course</label>
<select id="course" name="course">${courses}</select>
<label for="role">Role</label>
<select id="role" name="role"><option value="">The person's own role</option>${roles}</select>
<label for="defect">Defect</label>
<select id="defect" name="defect"><option value="">None (a good launch)</option>${defects}</select>
<label><input type="checkbox" name="frame" value="1"> Open inside the course page's frame</label>
<button type="submit">Launch Diagramble</button>
</form>
</main>`,
  );
}

// A form that posts itself on load, with a button for when scripts are off.
export function autoPostPage(action: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join("\n");
  return page(
    "Continuing to Diagramble",
    `<main>
<p>Continuing to Diagramble…</p>
<form id="post" method="post" action="${escapeHtml(action)}">
${inputs}
<noscript><button type="submit">Continue</button></noscript>
</form>
</main>
<script>document.getElementById("post").submit();</script>`,
  );
}

/** The course page: it frames the tool's login, which `src` reaches. */
export function coursePage(courseTitle: string, personName: string, src: string): string {
  return page(
    "Mock LTI course",
    `<main>
<h1>${escapeHtml(courseTitle)}</h1>
<p>Signed in to the mock platform as ${escapeHtml(personName)}.</p>
<iframe title="Diagramble" src="${escapeHtml(src)}"></iframe>
<p><a href="/">Back to the launch page</a></p>
</main>`,
  );
}

export function errorPage(message: string): string {
  return page(
    "Mock LTI platform error",
    `<main><h1>The mock platform refused this request</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to the launch page</a></p></main>`,
  );
}
