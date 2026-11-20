import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { renderSignInPage, signInCss } from "./sign-in-page.ts";

const failure = "That username and password do not match.";

function tagFor(html: string, id: string): string {
  const match = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if (!match) throw new Error(`no input with id ${id}`);
  return match[0];
}

describe("renderSignInPage", () => {
  test("returns a whole document with language, charset, viewport and title", () => {
    const html = renderSignInPage({});
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<meta charset="utf-8">/);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1">/);
    expect(html).toMatch(/<title>Sign in · Diagramble<\/title>/);
  });

  test("links the one stylesheet and has no script, inline style or style attribute", () => {
    const html = renderSignInPage({ username: "ada", message: failure });
    expect(html).toContain('<link rel="stylesheet" href="/sign-in.css">');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  test("posts the username and password to /sign-in", () => {
    const html = renderSignInPage({});
    expect(html).toMatch(/<form method="post" action="\/sign-in">/);
    expect(tagFor(html, "username")).toContain('name="username"');
    expect(tagFor(html, "password")).toContain('name="password"');
    expect(tagFor(html, "password")).toContain('type="password"');
    expect(html).toMatch(/<button type="submit"[^>]*>Sign in<\/button>/);
  });

  test("ties each label to its input", () => {
    const html = renderSignInPage({});
    for (const id of ["username", "password"]) {
      expect(html).toMatch(new RegExp(`<label for="${id}"[^>]*>[^<]+</label>`));
      tagFor(html, id);
    }
  });

  test("gives the browser's password manager the right autocomplete values", () => {
    const html = renderSignInPage({});
    expect(tagFor(html, "username")).toContain('autocomplete="username"');
    expect(tagFor(html, "password")).toContain('autocomplete="current-password"');
  });

  test("shows an alert only when there is a message", () => {
    expect(renderSignInPage({})).not.toContain('role="alert"');
    expect(renderSignInPage({ username: "ada" })).not.toContain('role="alert"');
    expect(renderSignInPage({ message: "" })).not.toContain('role="alert"');
    const html = renderSignInPage({ message: failure });
    expect(html).toMatch(new RegExp(`role="alert"[^>]*>[\\s\\S]*${failure}`));
  });

  test("escapes the username, quotes included, inside the value attribute", () => {
    const html = renderSignInPage({ username: `a"><script>x</script>&'b` });
    expect(tagFor(html, "username")).toContain(
      'value="a&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;&#39;b"',
    );
    expect(html).not.toContain("<script>");
  });

  test("escapes the message", () => {
    const html = renderSignInPage({ message: `<b>"x"</b> & 'y'` });
    expect(html).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;");
    expect(html).not.toContain("<b>");
  });

  test("leaves the username empty, and focuses it, when none is given", () => {
    const empty = tagFor(renderSignInPage({}), "username");
    expect(empty).toContain('value=""');
    expect(empty).toContain("autofocus");
    expect(tagFor(renderSignInPage({ username: "ada" }), "password")).toContain("autofocus");
  });

  test("draws the logo inline, in the text colour, with a name", () => {
    const html = renderSignInPage({});
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Diagramble"/);
    expect(html).toContain('fill="currentColor"');
    expect(html).not.toMatch(/<img/i);
  });

  test("offers no way to sign up", () => {
    expect(renderSignInPage({ message: failure })).not.toMatch(/sign[ -]?up|register|create (an )?account/i);
  });
});

describe("signInCss", () => {
  test("is the stylesheet beside the module", () => {
    const onDisk = readFileSync(new URL("./sign-in.css", import.meta.url), "utf8");
    expect(signInCss).toBe(onDisk);
  });

  test("has a dark theme and loads no external font", () => {
    expect(signInCss).toContain("prefers-color-scheme: dark");
    expect(signInCss).not.toMatch(/@import|@font-face|url\(/);
  });
});
