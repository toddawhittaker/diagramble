// The Canvas launch against the trust boundary of SPEC.md section 1, "Canvas launch",
// "Sign-in" and "Host names", and section 3.9: every check refuses its own kind of bad
// launch, the launch's Origin and cookies are exactly as ruled, framing is allowed only
// where it is meant to be, and nothing a refusal knows reaches the person or the log.

import {
  COURSES,
  createSigner,
  DEFECTS,
  type Defect,
  launchClaims,
  PEOPLE,
  type Person,
  signLaunch,
} from "@diagramble/mock-lti";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { calculateJwkThumbprint, createLocalJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { endSession, sessionFor } from "../accounts/sessions.ts";
import { findLtiMethod, setDisabled } from "../accounts/store.ts";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { REFUSAL_SENTENCE, renderRefusalPage } from "../lti/pages.ts";
import { stateCookieName } from "../lti/state.ts";
import {
  FRAME_ORIGINS,
  makeLtiSettings,
  makePlatform,
  PLATFORM,
  postLaunch,
  runLaunch,
} from "../lti/testing.ts";
import { start } from "../main.ts";
import { buildServer } from "../server.ts";
import {
  cookieOf,
  FORM,
  HTTP_COOKIE,
  HTTP_ORIGIN,
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  PASSWORD,
  sessionToken,
  setCookieLines,
  signIn,
} from "./harness.ts";

const HTTPS_STATE_COOKIE = stateCookieName({ appOrigin: HTTPS_ORIGIN });
const HTTP_STATE_COOKIE = stateCookieName({ appOrigin: HTTP_ORIGIN });

const person = (key: string): Person => {
  const found = PEOPLE.find((p) => p.key === key);
  if (!found) throw new Error(`no seed person ${key}`);
  return found;
};
const sam = person("sam");
const course = COURSES[0]!;

let testDb: TestDb;
let app: FastifyInstance;
let httpApp: FastifyInstance;
let clockApp: FastifyInstance;
let unset: FastifyInstance;
let platform: Awaited<ReturnType<typeof makePlatform>>;
let clock = Date.now();
let logLines: string[] = [];
const closers: Array<() => Promise<unknown>> = [];

async function makeApp(origin: string, now?: () => number, withLti = true): Promise<FastifyInstance> {
  const built = await buildServer({
    db: testDb.db,
    settings: makeSettings(origin, makeStaticDir(), 0, withLti ? makeLtiSettings() : null),
    ...(withLti ? { ltiKeys: platform.keys } : {}),
    ...(now ? { now } : {}),
    logger: { stream: { write: (line: string) => void logLines.push(line) } },
  });
  closers.push(() => built.close());
  return built;
}

beforeAll(async () => {
  testDb = await createTestDb();
  platform = await makePlatform();
  app = await makeApp(HTTPS_ORIGIN);
  httpApp = await makeApp(HTTP_ORIGIN);
  clockApp = await makeApp(HTTPS_ORIGIN, () => clock);
  unset = await makeApp(HTTPS_ORIGIN, undefined, false);
});

afterAll(async () => {
  for (const close of closers) await close();
  await testDb.drop();
});

// --- helpers -------------------------------------------------------------------------

const launch = (options: Parameters<typeof runLaunch>[3] = {}, target = app, origin = HTTPS_ORIGIN) =>
  runLaunch(target, platform.signer, origin, options);

async function count(table: "sessions" | "accounts"): Promise<number> {
  const row = await testDb.db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

interface Begun {
  state: string;
  nonce: string;
  stateCookie: string;
  stateCookieValue: string;
}

/** The login a browser makes inside the platform's frame. */
async function begin(target = app, name = HTTPS_STATE_COOKIE): Promise<Begun> {
  const login = await target.inject({
    url: "/lti/login",
    query: { iss: PLATFORM, login_hint: sam.sub, target_link_uri: `${HTTPS_ORIGIN}/` },
    headers: { "sec-fetch-dest": "iframe" },
  });
  const redirect = new URL(login.headers.location as string);
  const value = cookieOf(login, name)?.value ?? "";
  return {
    state: redirect.searchParams.get("state") ?? "",
    nonce: redirect.searchParams.get("nonce") ?? "",
    stateCookie: `${name}=${value}`,
    stateCookieValue: value,
  };
}

/** The token a platform would sign for a login, with its times at `nowSeconds`. */
function tokenFor(begun: Begun, options: { defect?: Defect; nowSeconds?: number; nonce?: string } = {}) {
  const claims = launchClaims({
    issuer: PLATFORM,
    toolUrl: HTTPS_ORIGIN,
    person: sam,
    course,
    role: sam.role,
    nonce: options.nonce ?? begun.nonce,
    now: options.nowSeconds ?? Math.floor(Date.now() / 1000),
    defect: options.defect,
  });
  return signLaunch(platform.signer, claims, options.defect);
}

/** A launch POST with exactly the Origin given, or none. */
function rawLaunch(
  target: FastifyInstance,
  form: Record<string, string>,
  cookie: string | undefined,
  origin: string | undefined,
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { "content-type": FORM };
  if (origin !== undefined) headers.origin = origin;
  if (cookie !== undefined) headers.cookie = cookie;
  return target.inject({ method: "POST", url: "/lti/launch", headers, payload: new URLSearchParams(form).toString() });
}

/** The reasons the log gives for refused launches, in order. */
function refusalReasons(): string[] {
  return logLines
    .map((line) => JSON.parse(line) as { msg?: string; reason?: string })
    .filter((entry) => entry.msg === "Canvas launch refused")
    .map((entry) => String(entry.reason));
}

/** A refusal is the one plain page, with no session and no clue as to which check failed. */
function expectRefusal(response: LightMyRequestResponse, status: number, cookieName = HTTPS_COOKIE) {
  expect(response.statusCode).toBe(status);
  expect(response.headers["content-type"]).toMatch(/^text\/html/);
  expect(response.body).toBe(renderRefusalPage());
  expect(response.body).toContain(REFUSAL_SENTENCE);
  expect(response.headers.location).toBeUndefined();
  expect(cookieOf(response, cookieName)).toBeUndefined();
}

const ancestors = (response: LightMyRequestResponse) =>
  String(response.headers["content-security-policy"])
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("frame-ancestors"));

// --- the sixteen defects ------------------------------------------------------------

// The reason the log gives for each defect: one check fails, and it is the check named.
const REASON: Record<Defect, string> = {
  bad_signature: "bad_signature",
  alg_none: "alg_not_allowed",
  alg_hs256: "alg_not_allowed",
  wrong_iss: "wrong_issuer",
  wrong_aud: "wrong_audience",
  expired: "expired",
  issued_in_future: "issued_in_future",
  wrong_nonce: "nonce_mismatch",
  replayed: "state_unknown",
  unknown_deployment: "unknown_deployment",
  wrong_message_type: "wrong_message_type",
  wrong_version: "wrong_version",
  wrong_target: "wrong_target",
  missing_sub: "missing_subject",
  missing_resource_link: "missing_resource_link",
  missing_context: "missing_context",
};

describe("each launch defect is refused for its own reason", () => {
  test("the table covers every defect the mock makes", () => {
    expect(Object.keys(REASON).sort()).toEqual([...DEFECTS].sort());
  });

  test.each(DEFECTS.filter((d) => d !== "replayed"))("%s", async (defect) => {
    logLines = [];
    const sessions = await count("sessions");
    const accounts = await count("accounts");
    const run = await launch({ person: person("lee"), defect });
    expectRefusal(run.launch, 401);
    expect(refusalReasons()).toEqual([REASON[defect]]);
    // A refused launch makes no session and no account, and the body never names the reason.
    expect(await count("sessions")).toBe(sessions);
    expect(await count("accounts")).toBe(accounts);
    for (const word of [REASON[defect], defect, "nonce", "signature", "audience", "issuer", "expired"]) {
      expect(run.launch.body).not.toContain(word);
    }
  });

  test("replayed: the same token and state posted twice, the second refused at the state step", async () => {
    logLines = [];
    const run = await launch({ person: person("tom"), defect: "replayed" });
    expect(run.launch.statusCode).toBe(303);
    const sessions = await count("sessions");
    const again = await postLaunch(app, run.form, run.stateCookie);
    expectRefusal(again, 401);
    expect(refusalReasons()).toEqual(["state_unknown"]);
    expect(await count("sessions")).toBe(sessions);
  });

  test("every refusal page is the same bytes, whatever the reason", async () => {
    const bodies = new Set<string>();
    for (const defect of DEFECTS.filter((d) => d !== "replayed")) {
      bodies.add((await launch({ person: sam, defect })).launch.body);
    }
    expect([...bodies]).toEqual([renderRefusalPage()]);
  });
});

// --- the state ----------------------------------------------------------------------

describe("the state", () => {
  test("a good launch with the state and its cookie is accepted", async () => {
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    expect((await rawLaunch(app, form, begun.stateCookie, PLATFORM)).statusCode).toBe(303);
  });

  test("a form with no state, and an empty one, are refused as missing", async () => {
    logLines = [];
    const begun = await begin();
    const id_token = await tokenFor(begun);
    expectRefusal(await rawLaunch(app, { id_token }, begun.stateCookie, PLATFORM), 401);
    expectRefusal(await rawLaunch(app, { id_token, state: "" }, begun.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_missing", "state_missing"]);
  });

  test("no state cookie is refused as missing, and the state is not spent", async () => {
    logLines = [];
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    expectRefusal(await rawLaunch(app, form, undefined, PLATFORM), 401);
    expectRefusal(await rawLaunch(app, form, `${HTTPS_STATE_COOKIE}=`, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_missing", "state_missing"]);
    expect((await rawLaunch(app, form, begun.stateCookie, PLATFORM)).statusCode).toBe(303);
  });

  test("a state that differs from the cookie's is refused as a mismatch", async () => {
    logLines = [];
    const first = await begin();
    const second = await begin();
    const form = { state: first.state, id_token: await tokenFor(first) };
    expectRefusal(await rawLaunch(app, form, second.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_mismatch"]);
  });

  test("a state no login made is refused as unknown, even with a matching cookie", async () => {
    logLines = [];
    const begun = await begin();
    const forged = "forged-state-value";
    const form = { state: forged, id_token: await tokenFor(begun) };
    expectRefusal(await rawLaunch(app, form, `${HTTPS_STATE_COOKIE}=${forged}`, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_unknown"]);
  });

  test("an expired state is refused as unknown, and one just inside its ten minutes works", async () => {
    logLines = [];
    clock = Date.now();
    const late = await begin(clockApp);
    clock += 601_000;
    const lateForm = { state: late.state, id_token: await tokenFor(late, { nowSeconds: Math.floor(clock / 1000) }) };
    expectRefusal(await rawLaunch(clockApp, lateForm, late.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_unknown"]);

    const early = await begin(clockApp);
    clock += 599_000;
    const earlyForm = { state: early.state, id_token: await tokenFor(early, { nowSeconds: Math.floor(clock / 1000) }) };
    expect((await rawLaunch(clockApp, earlyForm, early.stateCookie, PLATFORM)).statusCode).toBe(303);
  });

  test("a used state is refused the second time, even with a good token", async () => {
    logLines = [];
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    expect((await rawLaunch(app, form, begun.stateCookie, PLATFORM)).statusCode).toBe(303);
    expectRefusal(await rawLaunch(app, form, begun.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["state_unknown"]);
  });

  test("a refused token spends the state, so a corrected one cannot be tried under it", async () => {
    logLines = [];
    const begun = await begin();
    const bad = { state: begun.state, id_token: await tokenFor(begun, { defect: "bad_signature" }) };
    expectRefusal(await rawLaunch(app, bad, begun.stateCookie, PLATFORM), 401);
    const good = { state: begun.state, id_token: await tokenFor(begun) };
    expectRefusal(await rawLaunch(app, good, begun.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["bad_signature", "state_unknown"]);
  });

  test("a token signed for another login's nonce is refused", async () => {
    const first = await begin();
    const second = await begin();
    logLines = [];
    const form = { state: first.state, id_token: await tokenFor(first, { nonce: second.nonce }) };
    expectRefusal(await rawLaunch(app, form, first.stateCookie, PLATFORM), 401);
    expect(refusalReasons()).toEqual(["nonce_mismatch"]);
  });
});

// --- the launch's Origin ------------------------------------------------------------

describe("the launch's Origin", () => {
  test("the platform's origin is accepted", async () => {
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    expect((await rawLaunch(app, form, begun.stateCookie, PLATFORM)).statusCode).toBe(303);
  });

  test.each([
    ["the app's own origin", HTTPS_ORIGIN],
    ["another site", "https://evil.example"],
    ["the platform's host on another scheme", PLATFORM.replace("https:", "http:")],
    ["the platform's host on another port", `${PLATFORM}:8443`],
    ["the platform's host with a path", `${PLATFORM}/`],
    ["null", "null"],
    ["none at all", undefined],
  ])("%s is refused with 403 and no session", async (_name, origin) => {
    logLines = [];
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    const sessions = await count("sessions");
    expectRefusal(await rawLaunch(app, form, begun.stateCookie, origin), 403);
    expect(refusalReasons()).toEqual(["wrong_origin"]);
    expect(await count("sessions")).toBe(sessions);
    // The Origin is checked before the state is touched, so a forger cannot spend the real launch's state.
    expect((await rawLaunch(app, form, begun.stateCookie, PLATFORM)).statusCode).toBe(303);
  });
});

describe("the other routes keep the app's Origin rule when LTI is set", () => {
  const foreign: Array<[string, string | undefined]> = [
    ["another site", "https://evil.example"],
    ["the platform", PLATFORM],
    ["null", "null"],
    ["none at all", undefined],
  ];

  beforeAll(async () => {
    await makeAccounts(testDb.db, ["originperson"]);
  });

  async function post(url: string, origin: string | undefined, body = ""): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = { "content-type": FORM };
    if (origin !== undefined) headers.origin = origin;
    return app.inject({ method: "POST", url, headers, payload: body });
  }

  test.each(foreign)("POST /sign-in from %s is refused", async (_name, origin) => {
    const response = await post("/sign-in", origin, `username=originperson&password=${encodeURIComponent(PASSWORD)}`);
    expect(response.statusCode).toBe(403);
    expect(cookieOf(response, HTTPS_COOKIE)).toBeUndefined();
  });

  test.each(foreign)("POST /sign-out from %s is refused and the session survives", async (_name, origin) => {
    const accounts = await makeAccounts(testDb.db, [`signoutperson${foreign.length}${String(origin).length}`]);
    const token = await sessionToken(testDb.db, Object.values(accounts)[0]!, Date.now());
    const headers: Record<string, string> = { cookie: `${HTTPS_COOKIE}=${token}`, "content-type": FORM };
    if (origin !== undefined) headers.origin = origin;
    const response = await app.inject({ method: "POST", url: "/sign-out", headers });
    expect(response.statusCode).toBe(403);
    expect(await sessionFor(testDb.db, token, new Date())).toBeDefined();
  });

  test("a POST to a route that does not exist is refused on Origin before it is routed", async () => {
    for (const origin of [PLATFORM, "https://evil.example", undefined]) {
      expect((await post("/lti/other", origin)).statusCode).toBe(403);
    }
  });

  test("the login accepts a signed-out POST from any Origin, and a GET with none", async () => {
    const query = { iss: PLATFORM, login_hint: sam.sub, target_link_uri: `${HTTPS_ORIGIN}/` };
    for (const origin of ["https://evil.example", PLATFORM, HTTPS_ORIGIN, "null", undefined]) {
      const headers: Record<string, string> = { "content-type": FORM };
      if (origin !== undefined) headers.origin = origin;
      const response = await app.inject({
        method: "POST",
        url: "/lti/login",
        headers,
        payload: new URLSearchParams(query).toString(),
      });
      expect(response.statusCode).toBe(303);
      expect(response.headers.location).toMatch(/^https:\/\/canvas\.mock\.test\/api\/lti\/authorize_redirect\?/);
    }
    for (const origin of ["https://evil.example", undefined]) {
      const response = await app.inject({
        url: "/lti/login",
        query,
        headers: origin ? { origin } : {},
      });
      expect(response.statusCode).toBe(302);
    }
  });
});

// --- cookies ------------------------------------------------------------------------

function expectLaunchCookie(line: string | undefined) {
  expect(line).toBeDefined();
  expect(line).toMatch(/; Secure/);
  expect(line).toMatch(/; HttpOnly/);
  expect(line).toMatch(/; SameSite=None/);
  expect(line).toMatch(/; Partitioned/);
  expect(line).toMatch(/; Path=\/(;|$)/);
  expect(line).not.toMatch(/Domain=/i);
}

describe("the cookies", () => {
  test("over https the launch session cookie has the __Host- name and every attribute", async () => {
    const run = await launch({ person: sam });
    const line = setCookieLines(run.launch).find((l) => l.startsWith("__Host-diagramble-session="));
    expectLaunchCookie(line);
    expect(line).toMatch(/Max-Age=\d+/);
  });

  test("the state cookie has its own __Host- name, the same attributes and ten minutes", async () => {
    const run = await launch({ person: sam });
    const line = setCookieLines(run.login).find((l) => l.startsWith("__Host-diagramble-lti-state="));
    expectLaunchCookie(line);
    expect(line).toMatch(/Max-Age=600(;|$)/);
    expect(HTTPS_STATE_COOKIE).not.toBe(HTTPS_COOKIE);
  });

  test("a launch clears the state cookie with the attributes it was set with", async () => {
    const run = await launch({ person: sam });
    const line = setCookieLines(run.launch).find((l) => l.startsWith("__Host-diagramble-lti-state=;"));
    expectLaunchCookie(line);
    expect(line).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  test("on http://localhost the names lose the prefix and the attributes stay", async () => {
    const run = await launch({ person: sam }, httpApp, HTTP_ORIGIN);
    expect(run.launch.statusCode).toBe(303);
    expectLaunchCookie(setCookieLines(run.login).find((l) => l.startsWith(`${HTTP_STATE_COOKIE}=`)));
    expectLaunchCookie(setCookieLines(run.launch).find((l) => l.startsWith(`${HTTP_COOKIE}=`)));
    expect(setCookieLines(run.launch).some((l) => l.startsWith("__Host-"))).toBe(false);
  });

  test("a launch refused for any reason sets no session cookie and keeps the state cookie", async () => {
    const run = await launch({ person: sam, defect: "wrong_aud" });
    expect(setCookieLines(run.launch)).toEqual([]);
  });

  test("a password sign-in stays SameSite=Lax, is not Partitioned, and clears a partitioned cookie of its name", async () => {
    await makeAccounts(testDb.db, ["cookieperson"]);
    const response = await signIn(app, HTTPS_ORIGIN, { username: "cookieperson", password: PASSWORD });
    expect(response.statusCode).toBe(303);
    const lines = setCookieLines(response).filter((l) => l.startsWith(`${HTTPS_COOKIE}=`));
    expect(lines).toHaveLength(2);
    const [session, cleared] = lines as [string, string];
    expect(session).toMatch(/; SameSite=Lax/);
    expect(session).toMatch(/; Secure/);
    expect(session).toMatch(/; HttpOnly/);
    expect(session).not.toMatch(/Partitioned/);
    expect(cleared).toMatch(/^__Host-diagramble-session=;/);
    expect(cleared).toMatch(/; Partitioned/);
    expect(cleared).toMatch(/; SameSite=None/);
    expect(cleared).toMatch(/Max-Age=0/);
  });
});

// --- framing ------------------------------------------------------------------------

describe("framing", () => {
  const listed = `frame-ancestors ${FRAME_ORIGINS.join(" ")}`;

  test("the app's pages and the refusal page name the Canvas hosts", async () => {
    const run = await launch({ person: sam });
    const token = cookieOf(run.launch, HTTPS_COOKIE)!.value;
    const page = await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${token}` } });
    expect(page.statusCode).toBe(200);
    expect(ancestors(page)).toBe(listed);
    for (const path of ["/app.js", "/assets/style.css"]) {
      const asset = await app.inject({ url: path, headers: { cookie: `${HTTPS_COOKIE}=${token}` } });
      expect(asset.statusCode).toBe(200);
      expect(String(asset.headers["content-security-policy"])).toContain(listed);
    }
    const refused = await launch({ person: sam, defect: "expired" });
    expect(ancestors(refused.launch)).toBe(listed);
    const wrongOrigin = await rawLaunch(app, { state: "x", id_token: "y" }, undefined, "https://evil.example");
    expect(ancestors(wrongOrigin)).toBe(listed);
  });

  test("the sign-in page keeps 'none', including after a failed sign-in", async () => {
    const page = await app.inject({ url: "/sign-in" });
    expect(page.statusCode).toBe(200);
    expect(ancestors(page)).toBe("frame-ancestors 'none'");
    const failed = await signIn(app, HTTPS_ORIGIN, { username: "nobody-here", password: "wrong" });
    expect(failed.statusCode).toBe(401);
    expect(ancestors(failed)).toBe("frame-ancestors 'none'");
  });

  test("the key set keeps 'none'", async () => {
    const response = await app.inject({ url: "/lti/jwks" });
    expect(response.statusCode).toBe(200);
    expect(ancestors(response)).toBe("frame-ancestors 'none'");
  });

  test("no reply carries X-Frame-Options", async () => {
    const run = await launch({ person: sam });
    const token = cookieOf(run.launch, HTTPS_COOKIE)!.value;
    const responses = [
      await app.inject({ url: "/sign-in" }),
      await app.inject({ url: "/sign-in.css" }),
      await app.inject({ url: "/health" }),
      await app.inject({ url: "/lti/jwks" }),
      await app.inject({ url: "/lti/login", query: { iss: PLATFORM } }),
      await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${token}` } }),
      await app.inject({ url: "/", headers: { accept: "text/html" } }),
      (await launch({ person: sam, defect: "bad_signature" })).launch,
      run.launch,
    ];
    for (const response of responses) expect(response.headers["x-frame-options"]).toBeUndefined();
  });

  test("a redirect to the sign-in page and a 401 still carry a frame policy", async () => {
    expect(ancestors(await app.inject({ url: "/", headers: { accept: "text/html" } }))).toBe(listed);
    expect(ancestors(await app.inject({ url: "/" }))).toBe(listed);
  });
});

// --- the tool's key set -------------------------------------------------------------

describe("/lti/jwks", () => {
  test("holds one key with only the public members", async () => {
    const response = await app.inject({ url: "/lti/jwks" });
    const { keys } = response.json() as { keys: Record<string, unknown>[] };
    expect(keys).toHaveLength(1);
    const key = keys[0]!;
    expect(Object.keys(key).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
    for (const secret of ["d", "p", "q", "dp", "dq", "qi", "oth", "k"]) expect(key).not.toHaveProperty(secret);
    expect(key).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig" });
    expect(response.body).not.toContain("PRIVATE");
  });

  test("names the key by its RFC 7638 thumbprint and verifies what the tool key signs", async () => {
    const { keys } = (await app.inject({ url: "/lti/jwks" })).json() as { keys: Record<string, string>[] };
    const key = keys[0]!;
    expect(key.kid).toBe(await calculateJwkThumbprint({ kty: key.kty!, n: key.n!, e: key.e! }));
    const signed = await new SignJWT({ hello: "world" })
      .setProtectedHeader({ alg: "RS256", kid: key.kid! })
      .sign(await importPKCS8(makeLtiSettings().toolKey, "RS256"));
    await expect(jwtVerify(signed, createLocalJWKSet({ keys: [key] }))).resolves.toBeDefined();
  });

  test("is open to a signed-out request with any Origin", async () => {
    for (const headers of [{}, { origin: "https://evil.example" }]) {
      expect((await app.inject({ url: "/lti/jwks", headers })).statusCode).toBe(200);
    }
  });
});

// --- accounts and sessions ----------------------------------------------------------

describe("the account a launch signs in", () => {
  test("a disabled account's launch is refused and makes no session", async () => {
    logLines = [];
    const ivy = person("ivy");
    await launch({ person: ivy });
    const method = await findLtiMethod(testDb.db, PLATFORM, ivy.sub);
    await setDisabled(testDb.db, method!.accountId, true);
    const sessions = await count("sessions");
    const run = await launch({ person: ivy });
    expectRefusal(run.launch, 403);
    expect(refusalReasons()).toEqual(["account_disabled"]);
    expect(await count("sessions")).toBe(sessions);
    expect(setCookieLines(run.launch)).toEqual([]);
  });

  test("a launch never signs into a password account with the same login", async () => {
    const ada = person("ada");
    const { [ada.loginId]: password } = await makeAccounts(testDb.db, [ada.loginId]);
    const run = await launch({ person: ada });
    expect(run.launch.statusCode).toBe(303);
    const method = await findLtiMethod(testDb.db, PLATFORM, ada.sub);
    expect(method).toBeDefined();
    expect(method!.accountId).not.toBe(password!.accountId);
    const signedInAs = await sessionFor(testDb.db, cookieOf(run.launch, HTTPS_COOKIE)!.value, new Date());
    expect(signedInAs?.accountId).toBe(method!.accountId);
    expect(signedInAs?.accountId).not.toBe(password!.accountId);
    const logins = await testDb.db.selectFrom("accounts").select("id").where("login", "=", ada.loginId).execute();
    expect(logins).toHaveLength(2);
    const passwordMethods = await testDb.db
      .selectFrom("sign_in_methods")
      .select("kind")
      .where("account_id", "=", password!.accountId)
      .execute();
    expect(passwordMethods).toEqual([{ kind: "password" }]);
  });

  test("a launch ends the session the browser sent and makes a new one", async () => {
    const accounts = await makeAccounts(testDb.db, ["sentbefore"]);
    const old = await sessionToken(testDb.db, accounts.sentbefore!, Date.now());
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun) };
    const response = await rawLaunch(app, form, `${begun.stateCookie}; ${HTTPS_COOKIE}=${old}`, PLATFORM);
    expect(response.statusCode).toBe(303);
    const fresh = cookieOf(response, HTTPS_COOKIE)!.value;
    expect(fresh).not.toBe(old);
    expect(await sessionFor(testDb.db, old, new Date())).toBeUndefined();
    const now = await sessionFor(testDb.db, fresh, new Date());
    expect(now).toBeDefined();
    expect(now!.accountId).not.toBe(accounts.sentbefore!.accountId);
    expect((await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${old}` } })).statusCode).toBe(401);
  });

  test("a refused launch leaves the session the browser sent alone", async () => {
    const accounts = await makeAccounts(testDb.db, ["keptsession"]);
    const old = await sessionToken(testDb.db, accounts.keptsession!, Date.now());
    const begun = await begin();
    const form = { state: begun.state, id_token: await tokenFor(begun, { defect: "bad_signature" }) };
    expectRefusal(await rawLaunch(app, form, `${begun.stateCookie}; ${HTTPS_COOKIE}=${old}`, PLATFORM), 401);
    expect(await sessionFor(testDb.db, old, new Date())).toBeDefined();
    await endSession(testDb.db, old);
  });

  test("the session a launch makes works, and signing out ends it", async () => {
    const run = await launch({ person: person("tom") });
    const token = cookieOf(run.launch, HTTPS_COOKIE)!.value;
    const cookie = `${HTTPS_COOKIE}=${token}`;
    expect((await app.inject({ url: "/", headers: { cookie } })).statusCode).toBe(200);
    const out = await app.inject({ method: "POST", url: "/sign-out", headers: { cookie, origin: HTTPS_ORIGIN } });
    expect(out.statusCode).toBe(303);
    expect((await app.inject({ url: "/", headers: { cookie } })).statusCode).toBe(401);
  });
});

// --- LTI unset ----------------------------------------------------------------------

describe("with no LTI settings", () => {
  test.each(["/lti/login", "/lti/jwks"])("GET %s answers 404 to a signed-in person", async (url) => {
    const accounts = await makeAccounts(testDb.db, [`unsetget${url.replaceAll("/", "")}`]);
    const token = await sessionToken(testDb.db, Object.values(accounts)[0]!, Date.now());
    const response = await unset.inject({ url, headers: { cookie: `${HTTPS_COOKIE}=${token}` } });
    expect(response.statusCode).toBe(404);
  });

  test.each(["/lti/login", "/lti/launch"])("POST %s answers 404 to a signed-in person from the app's origin", async (url) => {
    const accounts = await makeAccounts(testDb.db, [`unsetpost${url.replaceAll("/", "")}`]);
    const token = await sessionToken(testDb.db, Object.values(accounts)[0]!, Date.now());
    const response = await unset.inject({
      method: "POST",
      url,
      headers: { cookie: `${HTTPS_COOKIE}=${token}`, origin: HTTPS_ORIGIN, "content-type": FORM },
      payload: "",
    });
    expect(response.statusCode).toBe(404);
  });

  test("a signed-out request gets the guard's usual sign-in answer, not a launch", async () => {
    for (const url of ["/lti/login", "/lti/jwks", "/lti/launch"]) {
      const page = await unset.inject({ url, headers: { accept: "text/html" } });
      expect(page.statusCode).toBe(303);
      expect(page.headers.location).toBe("/sign-in");
      const other = await unset.inject({ url });
      expect(other.statusCode).toBe(401);
    }
  });

  test("a signed-out POST to the launch is refused on Origin, since nothing exempts it", async () => {
    for (const origin of [PLATFORM, "https://evil.example"]) {
      const response = await unset.inject({
        method: "POST",
        url: "/lti/launch",
        headers: { origin, "content-type": FORM },
        payload: "state=a&id_token=b",
      });
      expect(response.statusCode).toBe(403);
    }
  });

  test("its pages are never framed", async () => {
    expect(ancestors(await unset.inject({ url: "/sign-in" }))).toBe("frame-ancestors 'none'");
    expect(ancestors(await unset.inject({ url: "/" }))).toBe("frame-ancestors 'none'");
  });
});

describe("start-up with some of the LTI settings", () => {
  const all: Record<string, string> = {
    DATABASE_URL: "postgres://unused/x",
    APP_ORIGIN: HTTPS_ORIGIN,
    STATIC_DIR: makeStaticDir(),
    LTI_ISSUER: PLATFORM,
    LTI_CLIENT_ID: "client",
    LTI_DEPLOYMENT_ID: "deployment",
    LTI_AUTH_URL: `${PLATFORM}/authorize`,
    LTI_KEYS_URL: `${PLATFORM}/keys`,
    LTI_FRAME_ORIGINS: PLATFORM,
    LTI_TOOL_KEY: makeLtiSettings().toolKey,
  };

  test("fails naming the missing ones, before it opens a database", async () => {
    const { LTI_AUTH_URL: _a, LTI_TOOL_KEY: _k, ...some } = all;
    await expect(start(some, { logger: false })).rejects.toThrow(/LTI_AUTH_URL, LTI_TOOL_KEY are missing/);
  });

  test.each(["LTI_ISSUER", "LTI_CLIENT_ID", "LTI_DEPLOYMENT_ID", "LTI_AUTH_URL", "LTI_KEYS_URL", "LTI_FRAME_ORIGINS", "LTI_TOOL_KEY"])(
    "fails naming %s when it alone is missing",
    async (name) => {
      const { [name]: _gone, ...rest } = all;
      await expect(start(rest, { logger: false })).rejects.toThrow(new RegExp(`${name} is missing`));
    },
  );
});

// --- the log ------------------------------------------------------------------------

describe("the log", () => {
  test("names the reason of a refusal and never holds the token, state, cookie values or form", async () => {
    logLines = [];
    const refused = await launch({ person: sam, defect: "bad_signature" });
    const good = await launch({ person: person("lee") });
    const wrongOrigin = await launch({ person: sam, headers: { origin: "https://evil.example" } });
    expect(refusalReasons()).toEqual(["bad_signature", "wrong_origin"]);

    const log = logLines.join("\n");
    expect(log).toContain("Canvas launch refused");
    const session = cookieOf(good.launch, HTTPS_COOKIE)!.value;
    const secrets = [
      ...[refused, good, wrongOrigin].flatMap((run) => [
        run.form.id_token,
        run.form.id_token.split(".")[1]!,
        run.form.id_token.split(".")[2]!,
        run.form.state,
        run.stateCookie.split("=")[1]!,
        new URLSearchParams(run.form).toString(),
      ]),
      session,
    ];
    for (const secret of secrets) expect(secret.length).toBeGreaterThan(8);
    for (const secret of secrets) expect(log).not.toContain(secret);
    // No headers either, so no Cookie or Origin value is logged.
    expect(log).not.toContain("evil.example");
    expect(log).not.toMatch(/"cookie"|set-cookie/i);
  });
});
