import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLocalJWKSet, createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "./pages.ts";
import { CLIENT_ID, COURSES, DEPLOYMENT_ID, PEOPLE, ROLE_NAMES, ROLE_URIS, UNFILLED_LOGIN_ID } from "./seed.ts";
import { createHandler } from "./server.ts";
import { CUSTOM_CLAIM, createSigner, DEFECTS, LTI_CLAIM, type Signer } from "./token.ts";

const TOOL = "http://tool.test";
const ISSUER = "http://issuer.test";
const NOW = 1_900_000_000;

let server: Server;
let base: string;
let signer: Signer;
let logs: string[];
let clock: number;

async function listen(handler: ReturnType<typeof createHandler>): Promise<{ server: Server; base: string }> {
  const created = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => created.listen(0, "127.0.0.1", resolve));
  return { server: created, base: `http://127.0.0.1:${(created.address() as AddressInfo).port}` };
}

function newHandler() {
  return createHandler({ issuer: ISSUER, toolUrl: TOOL, signer, log: (line) => logs.push(line), now: () => clock });
}

beforeEach(async () => {
  signer = await createSigner();
  logs = [];
  clock = NOW;
  ({ server, base } = await listen(newHandler()));
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function hiddenFields(page: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of page.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields[m[1] as string] = (m[2] as string).replaceAll("&amp;", "&");
  }
  return fields;
}

async function formToken(): Promise<string> {
  return hiddenFields(await (await fetch(`${base}/`)).text()).form_token as string;
}

async function start(form: Record<string, string>) {
  const res = await fetch(`${base}/start`, {
    method: "POST",
    body: new URLSearchParams({ form_token: await formToken(), ...form }),
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

async function loginFor(form: Record<string, string>) {
  const { html } = await start(form);
  expect(html).toContain(`action="${TOOL}/lti/login"`);
  return hiddenFields(html);
}

function authorizeParams(login: Record<string, string>, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: CLIENT_ID,
    redirect_uri: `${TOOL}/lti/launch`,
    login_hint: login.login_hint as string,
    lti_message_hint: login.lti_message_hint as string,
    state: "state-1",
    nonce: "nonce-1",
    ...extra,
  });
}

async function authorize(params: URLSearchParams) {
  const res = await fetch(`${base}/authorize?${params}`);
  return { status: res.status, html: await res.text() };
}

async function launchFields(form: Record<string, string>, extra: Record<string, string> = {}) {
  const login = await loginFor(form);
  const { status, html } = await authorize(authorizeParams(login, extra));
  expect(status).toBe(200);
  expect(html).toContain(`action="${TOOL}/lti/launch"`);
  return hiddenFields(html);
}

const verifyGood = (token: string) =>
  jwtVerify(token, createLocalJWKSet(signer.jwks), {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: CLIENT_ID,
    currentDate: new Date(NOW * 1000),
  });

describe("the launch page", () => {
  it("lists every person, course, role and defect", async () => {
    const res = await fetch(`${base}/`);
    const page = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    for (const p of PEOPLE) expect(page).toContain(`value="${p.key}"`);
    for (const c of COURSES) expect(page).toContain(`value="${c.key}"`);
    for (const r of ROLE_NAMES) expect(page).toContain(`value="${r}"`);
    for (const d of DEFECTS) expect(page).toContain(`value="${d}"`);
    expect(page).toContain('<label for="person">');
  });

  it("escapes what it prints", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("answers 404 for an unknown path and for the wrong method", async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/start`)).status).toBe(404);
    expect((await fetch(`${base}/jwks`, { method: "POST" })).status).toBe(404);
  });
});

describe("the form token", () => {
  const form = { person: "sam", course: "is301" };

  it("refuses a launch with no token, a wrong token or a token of another run", async () => {
    const post = (body: Record<string, string>) =>
      fetch(`${base}/start`, { method: "POST", body: new URLSearchParams(body) });
    expect((await post(form)).status).toBe(403);
    expect((await post({ ...form, form_token: "wrong" })).status).toBe(403);
    expect((await post({ ...form, form_token: "" })).status).toBe(403);
    expect(logs).toEqual([]);

    const other = await listen(newHandler());
    try {
      const otherToken = hiddenFields(await (await fetch(`${other.base}/`)).text()).form_token as string;
      expect(otherToken).not.toBe(await formToken());
      expect((await post({ ...form, form_token: otherToken })).status).toBe(403);
    } finally {
      await new Promise((resolve) => other.server.close(resolve));
    }
  });

  it("starts a launch with the page's own token", async () => {
    const { status, html } = await start(form);
    expect(status).toBe(200);
    expect(html).toContain(`action="${TOOL}/lti/login"`);
  });

  it("refuses a form token sent in the query string of a GET", async () => {
    const res = await fetch(`${base}/start?form_token=${await formToken()}&person=sam&course=is301`);
    expect(res.status).toBe(404);
  });
});

describe("the launch form's choices", () => {
  it("refuses unknown values", async () => {
    expect((await start({ person: "zed", course: "is301" })).status).toBe(400);
    expect((await start({ person: "sam", course: "cs999" })).status).toBe(400);
    expect((await start({ person: "sam", course: "is301", role: "King" })).status).toBe(400);
    expect((await start({ person: "sam", course: "is301", defect: "odd" })).status).toBe(400);
  });

  it("starts third-party login with the initiation parameters", async () => {
    const login = await loginFor({ person: "sam", course: "is301" });
    expect(login).toMatchObject({
      iss: ISSUER,
      login_hint: "sam",
      target_link_uri: `${TOOL}/`,
      client_id: CLIENT_ID,
      lti_deployment_id: DEPLOYMENT_ID,
    });
    expect(login.lti_message_hint).toBeTruthy();
  });

  it("keeps the oldest launches within a limit", async () => {
    const first = await loginFor({ person: "sam", course: "is301" });
    for (let i = 0; i < 1000; i++) await start({ person: "sam", course: "is301" });
    const { status } = await authorize(authorizeParams(first));
    expect(status).toBe(400);
  }, 60_000);
});

describe("the course page", () => {
  it("frames the tool's login through the mock's own frame address", async () => {
    const framed = await start({ person: "sam", course: "is420", frame: "1" });
    expect(framed.status).toBe(303);
    const course = await (await fetch(`${base}${framed.location}`)).text();
    expect(course).toContain("IS 420 Database Design");
    expect(course).toContain("Sam Student");
    const src = /<iframe title="Diagramble" src="([^"]+)"/.exec(course)?.[1] ?? "";
    expect(src).toMatch(/^\/frame\?launch=/);
    const inner = await (await fetch(`${base}${src.replaceAll("&amp;", "&")}`)).text();
    expect(inner).toContain(`action="${TOOL}/lti/login"`);
    expect(hiddenFields(inner).login_hint).toBe("sam");
  });

  it("answers 404 for a launch it does not know", async () => {
    expect((await fetch(`${base}/frame?launch=nope`)).status).toBe(404);
    expect((await fetch(`${base}/course?launch=nope`)).status).toBe(404);
    expect((await fetch(`${base}/course`)).status).toBe(404);
  });
});

describe("the pages", () => {
  it("send a referrer policy that keeps the Origin header on the auto-posted form", async () => {
    const res = await fetch(`${base}/`);
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("declare both color schemes", async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('<meta name="color-scheme" content="light dark">');
  });

  it("put the auto-posted form in a main landmark with a line of text", async () => {
    const framed = await start({ person: "sam", course: "is420", frame: "1" });
    const course = await (await fetch(`${base}${framed.location}`)).text();
    const src = /<iframe title="Diagramble" src="([^"]+)"/.exec(course)?.[1] ?? "";
    const inner = await (await fetch(`${base}${src.replaceAll("&amp;", "&")}`)).text();
    expect(inner).toMatch(/<main>\s*<p>Continuing to Diagramble…<\/p>\s*<form/);
    expect(inner).toMatch(/<\/form>[\s\S]*<\/main>/);
  });

  it("let the course page's frame fill the width", async () => {
    const framed = await start({ person: "sam", course: "is420", frame: "1" });
    const course = await (await fetch(`${base}${framed.location}`)).text();
    expect(course).toContain("iframe{width:100%;height:min(36rem, 80vh)");
  });
});

describe("/jwks", () => {
  it("serves one public RS256 key with no private member", async () => {
    const res = await fetch(`${base}/jwks`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const jwks = (await res.json()) as { keys: Record<string, unknown>[] };
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid: signer.kid });
    for (const key of jwks.keys) {
      expect(Object.keys(key).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
      for (const secret of ["d", "p", "q", "dp", "dq", "qi", "oth", "k"]) expect(key).not.toHaveProperty(secret);
    }
  });

  it("verifies a launch when the tool fetches it over the network", async () => {
    const { id_token } = await launchFields({ person: "sam", course: "is301" });
    const remote = createRemoteJWKSet(new URL(`${base}/jwks`));
    const { payload } = await jwtVerify(id_token as string, remote, {
      algorithms: ["RS256"],
      issuer: ISSUER,
      audience: CLIENT_ID,
      currentDate: new Date(NOW * 1000),
    });
    expect(payload.sub).toBe(PEOPLE.find((p) => p.key === "sam")?.sub);
  });
});

describe("/authorize", () => {
  it("signs a good launch with the person's seeded role and the course", async () => {
    const { id_token, state } = await launchFields({ person: "ivy", course: "is420" });
    expect(state).toBe("state-1");
    const { payload } = await verifyGood(id_token as string);
    expect(payload).toMatchObject({
      sub: PEOPLE.find((p) => p.key === "ivy")?.sub,
      nonce: "nonce-1",
      exp: NOW + 300,
      [`${LTI_CLAIM}deployment_id`]: DEPLOYMENT_ID,
      [`${LTI_CLAIM}target_link_uri`]: `${TOOL}/`,
      [`${LTI_CLAIM}roles`]: [ROLE_URIS.Instructor],
    });
    expect(payload[`${LTI_CLAIM}context`]).toMatchObject({ title: "IS 420 Database Design" });
    expect(logs).toEqual(["launch person=ivy defect=none"]);
  });

  it("uses the role chosen on the launch page", async () => {
    const { id_token } = await launchFields({ person: "sam", course: "is301", role: "Instructor" });
    expect(decodeJwt(id_token as string)[`${LTI_CLAIM}roles`]).toEqual([ROLE_URIS.Instructor]);
  });

  it("accepts a form POST as well as a query", async () => {
    const login = await loginFor({ person: "sam", course: "is301" });
    const res = await fetch(`${base}/authorize`, { method: "POST", body: authorizeParams(login) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('name="id_token"');
  });

  it("accepts an authorization request with no response_mode", async () => {
    const login = await loginFor({ person: "sam", course: "is301" });
    const params = authorizeParams(login);
    params.delete("response_mode");
    expect((await authorize(params)).status).toBe(200);
  });

  it.each([
    ["scope", { scope: "profile" }],
    ["response_type", { response_type: "code" }],
    ["response_mode", { response_mode: "fragment" }],
    ["client_id", { client_id: "other" }],
    ["redirect_uri", { redirect_uri: "http://evil.test/lti/launch" }],
    ["state", { state: "" }],
    ["nonce", { nonce: "" }],
    ["login_hint", { login_hint: "lee" }],
    ["lti_message_hint", { lti_message_hint: "unknown" }],
  ])("refuses an authorization request with a bad %s", async (_name, extra) => {
    const login = await loginFor({ person: "sam", course: "is301" });
    const { status, html } = await authorize(authorizeParams(login, extra));
    expect(status).toBe(400);
    expect(html).not.toContain('name="id_token"');
    expect(logs).toEqual([]);
  });

  it("never posts a token to an address other than the tool's launch URL", async () => {
    const login = await loginFor({ person: "sam", course: "is301" });
    const { html } = await authorize(authorizeParams(login, { redirect_uri: "http://evil.test/" }));
    expect(html).not.toContain("evil.test/\"");
    expect(html).not.toContain("<form");
  });

  it("answers 400 to a request body that is too large", async () => {
    const res = await fetch(`${base}/authorize`, { method: "POST", body: "x=".padEnd(70 * 1024, "y") });
    expect(res.status).toBe(400);
  });
});

describe("the login ID", () => {
  async function customClaim(person: string) {
    const { id_token } = await launchFields({ person, course: "is301" });
    return decodeJwt(id_token as string)[CUSTOM_CLAIM];
  }

  it("sends the person's login ID", async () => {
    expect(await customClaim("sam")).toEqual({ login_id: "sam.student" });
    expect(await customClaim("ivy")).toEqual({ login_id: "ivy.instructor" });
  });

  it("sends the literal text Canvas leaves when it cannot fill the field in", async () => {
    expect(await customClaim("lee")).toEqual({ login_id: UNFILLED_LOGIN_ID });
    expect(UNFILLED_LOGIN_ID).toBe("$Canvas.user.loginId");
  });

  it("sends an empty login ID for a person with none", async () => {
    expect(await customClaim("una")).toEqual({ login_id: "" });
  });
});

describe("defects through the launch page", () => {
  it.each(DEFECTS.filter((d) => d !== "replayed"))("%s is signed into the launch", async (defect) => {
    // Only the replay needs an earlier launch; every other defect is one launch on its own.
    const { id_token } = await launchFields({ person: "sam", course: "is301", defect });
    expect(typeof id_token).toBe("string");
    expect(logs).toEqual([`launch person=sam defect=${defect}`]);
    if (defect === "alg_none") expect(id_token?.endsWith(".")).toBe(true);
    if (defect === "wrong_nonce") expect(decodeJwt(id_token as string).nonce).not.toBe("nonce-1");
    if (defect === "missing_sub") expect(decodeJwt(id_token as string)).not.toHaveProperty("sub");
  });

  describe("replayed", () => {
    it("re-posts the earlier good token under the state it was first sent with", async () => {
      const first = await launchFields({ person: "sam", course: "is301" });
      const replay = await launchFields(
        { person: "sam", course: "is301", defect: "replayed" },
        { state: "state-2", nonce: "nonce-2" },
      );
      expect(replay.id_token).toBe(first.id_token);
      expect(replay.state).toBe("state-1");
      expect(logs[1]).toBe("launch person=sam defect=replayed");
    });

    it("replays the last good token, never a defective one", async () => {
      const good = await launchFields({ person: "sam", course: "is301" });
      await launchFields({ person: "sam", course: "is301", defect: "expired" });
      const replay = await launchFields({ person: "sam", course: "is301", defect: "replayed" });
      expect(replay.id_token).toBe(good.id_token);
    });

    it("is refused when only defective launches came before", async () => {
      await launchFields({ person: "sam", course: "is301", defect: "bad_signature" });
      const login = await loginFor({ person: "sam", course: "is301", defect: "replayed" });
      const { status, html } = await authorize(authorizeParams(login));
      expect(status).toBe(400);
      expect(html).toContain("earlier good launch");
    });

    it("is refused when the token it would replay has expired", async () => {
      await launchFields({ person: "sam", course: "is301" });
      clock = NOW + 301;
      const login = await loginFor({ person: "sam", course: "is301", defect: "replayed" });
      const { status, html } = await authorize(authorizeParams(login));
      expect(status).toBe(400);
      expect(html).toContain("expired");
    });
  });
});
