// The page a refused Canvas launch shows (SPEC.md section 1, "Canvas launch"). One plain
// sentence, the same for every refusal, so the page never says which check failed; the
// server's log names it. Plain HTML styled only by /sign-in.css.

/** What a refused launch tells the person. */
export const REFUSAL_SENTENCE =
  "Diagramble could not sign you in from this course link. Go back to the course and open the link again.";

/** The refusal page's policy: its stylesheet only, framed only where the app's pages may be. */
export function refusalPolicy(frameOrigins: readonly string[]): string {
  return `default-src 'none'; style-src 'self'; form-action 'none'; frame-ancestors ${frameOrigins.join(" ")}; base-uri 'none'`;
}

/** The whole refusal document. It holds no text from the request, so nothing needs escaping. */
export function renderRefusalPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Could not sign in · Diagramble</title>
  <link rel="stylesheet" href="/sign-in.css">
</head>
<body>
  <main class="sign-in">
    <h1>Could not sign in</h1>
    <p class="sign-in-alert" role="alert"><span>${REFUSAL_SENTENCE}</span></p>
  </main>
</body>
</html>
`;
}
