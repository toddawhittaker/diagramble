// The Canvas launch through the server (SPEC.md section 1, "Canvas launch", "Sign-in",
// "Host names"; section 3.9): login, launch, the cookies, framing, and the refusals.

import { COURSES, PEOPLE } from "@diagramble/mock-lti";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { findLtiMethod, setDisabled } from "../accounts/store.ts";
import { createTestDb, type TestDb } from "../db/testing.ts";
import {
  cookieOf,
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  PASSWORD,
  sessionToken,
  setCookieLines,
  signIn,
} from "../security/harness.ts";
import { buildServer } from "../server.ts";
import { REFUSAL_SENTENCE } from "./pages.ts";
import { stateCookieName } from "./state.ts";
import { AUTH_URL, FRAME_ORIGINS, makeLtiSettings, makePlatform, PLATFORM, postLaunch, runLaunch } from "./testing.ts";

const STATE_COOKIE = stateCookieName({ appOrigin: HTTPS_ORIGIN });
const ivy = PEOPLE.find((p) => p.key === "ivy")!;
const sam = PEOPLE.find((p) => p.key === "sam")!;
const course = COURSES[0]!;

let testDb: TestDb;
let app: FastifyInstance;
let unset: FastifyInstance;
let platform: Awaited<ReturnType<typeof makePlatform>>;
const logLines: string[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  platform = await makePlatform();
  const staticDir = makeStaticDir();
  app = await buildServer({
    db: testDb.db,
    settings: makeSettings(HTTPS_ORIGIN, staticDir, 0, makeLtiSettings()),
    ltiKeys: platform.keys,
    logger: { stream: { write: (line: string) => void logLines.push(line) } },
  });
  unset = await buildServer({ db: testDb.db, settings: makeSettings(HTTPS_ORIGIN, staticDir) });
});

afterAll(async () => {
  await app.close();
  await unset.close();
  await testDb.drop();
});

const launch = (options: Parameters<typeof runLaunch>[3] = {}) =>
  runLaunch(app, platform.signer, HTTPS_ORIGIN, options);

async function membership(accountId: string) {
  return testDb.db
    .selectFrom("course_members")
    .innerJoin("courses", "courses.id", "course_members.course_id")
    .select(["courses.id", "courses.context_id", "course_members.role"])
    .where("account_id", "=", accountId)
    .execute();
}

function expectRefused(response: Awaited<ReturnType<typeof postLaunch>>, status: number) {
  expect(response.statusCode).toBe(status);
  expect(response.headers["content-type"]).toMatch(/^text\/html/);
  expect(response.body).toContain(REFUSAL_SENTENCE);
  expect(cookieOf(response, HTTPS_COOKIE)).toBeUndefined();
}

describe("the login", () => {
  test("stores a state, sets the state cookie and redirects to the platform", async () => {
    const { login } = await launch({ person: sam });
    expect(login.statusCode).toBe(302);
    const to = new URL(login.headers.location as string);
    expect(`${to.origin}${to.pathname}`).toBe(AUTH_URL);
    expect(to.searchParams.get("redirect_uri")).toBe(`${HTTPS_ORIGIN}/lti/launch`);
    const line = setCookieLines(login).find((l) => l.startsWith(`${STATE_COOKIE}=`))!;
    expect(line).toMatch(/; Secure/);
    expect(line).toMatch(/; HttpOnly/);
    expect(line).toMatch(/; SameSite=None/);
    expect(line).toMatch(/; Partitioned/);
    expect(line).toMatch(/; Path=\/(;|$)/);
    expect(line).toMatch(/; Max-Age=600/);
  });

  test("POST is exempt from the app's Origin check and answers 303", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/lti/login",
      headers: { origin: PLATFORM, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ iss: PLATFORM, login_hint: sam.sub, target_link_uri: `${HTTPS_ORIGIN}/` }).toString(),
    });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toMatch(new RegExp(`^${AUTH_URL}\\?`));
  });

  test("a request that is not a navigation is refused", async () => {
    const response = await app.inject({
      url: "/lti/login",
      query: { iss: PLATFORM, login_hint: sam.sub },
      headers: { "sec-fetch-dest": "script" },
    });
    expectRefused(response, 400);
  });
});

describe("a good launch", () => {
  test("signs a new person in and redirects to our course ID", async () => {
    const { launch: response } = await launch({ person: sam, course });
    expect(response.statusCode).toBe(303);
    const method = await findLtiMethod(testDb.db, PLATFORM, sam.sub);
    expect(method).toBeDefined();
    const rows = await membership(method!.accountId);
    expect(rows).toEqual([{ id: expect.any(String), context_id: course.id, role: "student" }]);
    expect(response.headers.location).toBe(`/?course=${rows[0]!.id}`);

    const session = cookieOf(response, HTTPS_COOKIE)!;
    const page = await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${session.value}` } });
    expect(page.statusCode).toBe(200);
  });

  test("the launch session cookie is Secure, HttpOnly, SameSite=None, Partitioned, Path=/", async () => {
    const { launch: response } = await launch({ person: sam });
    const line = setCookieLines(response).find((l) => l.startsWith(`${HTTPS_COOKIE}=`))!;
    expect(line).toMatch(/; Secure/);
    expect(line).toMatch(/; HttpOnly/);
    expect(line).toMatch(/; SameSite=None/);
    expect(line).toMatch(/; Partitioned/);
    expect(line).toMatch(/; Path=\/(;|$)/);
    expect(line).not.toMatch(/Domain=/i);
    // The state cookie is cleared, with the attributes it was set with.
    const state = setCookieLines(response).find((l) => l.startsWith(`${STATE_COOKIE}=;`))!;
    expect(state).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(state).toMatch(/; Partitioned/);
  });

  test("clears an older unpartitioned SameSite=Lax cookie of the same name", async () => {
    const { launch: response } = await launch({ person: sam });
    const lines = setCookieLines(response).filter((l) => l.startsWith(`${HTTPS_COOKIE}=`));
    expect(lines).toHaveLength(2);
    const cleared = lines.find((l) => l.startsWith(`${HTTPS_COOKIE}=;`))!;
    expect(cleared).toMatch(/; SameSite=Lax/);
    expect(cleared).toMatch(/Max-Age=0/);
    expect(cleared).not.toMatch(/Partitioned/);
    const session = lines.find((l) => l !== cleared)!;
    expect(session).toMatch(/; Partitioned/);
    expect(session).toMatch(/; SameSite=None/);
  });

  test("a second launch reuses the account and refreshes the role", async () => {
    await launch({ person: ivy, role: "Learner" });
    const first = await findLtiMethod(testDb.db, PLATFORM, ivy.sub);
    expect((await membership(first!.accountId))[0]!.role).toBe("student");
    await launch({ person: ivy, role: "Instructor" });
    const second = await findLtiMethod(testDb.db, PLATFORM, ivy.sub);
    expect(second).toEqual(first);
    expect((await membership(first!.accountId))[0]!.role).toBe("instructor");
  });

  test("ends the session the browser sent", async () => {
    const accounts = await makeAccounts(testDb.db, ["sentbefore"]);
    const old = await sessionToken(testDb.db, accounts.sentbefore!, Date.now());
    const response = await runLaunchWithSession(old);
    expect(response.statusCode).toBe(303);
    const reuse = await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${old}` } });
    expect(reuse.statusCode).toBe(401);
  });
});

/** A launch that also sends a session cookie beside the state cookie. */
async function runLaunchWithSession(token: string) {
  const login = await app.inject({
    url: "/lti/login",
    query: { iss: PLATFORM, login_hint: sam.sub, target_link_uri: `${HTTPS_ORIGIN}/` },
  });
  const redirect = new URL(login.headers.location as string);
  const state = redirect.searchParams.get("state")!;
  const stateCookie = `${STATE_COOKIE}=${cookieOf(login, STATE_COOKIE)!.value}`;
  const { launchClaims, signLaunch } = await import("@diagramble/mock-lti");
  const claims = launchClaims({
    issuer: PLATFORM,
    toolUrl: HTTPS_ORIGIN,
    person: sam,
    course,
    role: sam.role,
    nonce: redirect.searchParams.get("nonce")!,
    now: Math.floor(Date.now() / 1000),
  });
  return postLaunch(app, { state, id_token: await signLaunch(platform.signer, claims) }, stateCookie, {
    cookie: `${stateCookie}; ${HTTPS_COOKIE}=${token}`,
  });
}

describe("the launch's Origin", () => {
  test.each([
    ["missing", undefined],
    ["null", "null"],
    ["the app's own", HTTPS_ORIGIN],
    ["another site", "https://evil.example"],
    ["a Canvas host's other port", "https://school.instructure.com:8443"],
  ])("%s is refused with 403", async (_name, origin) => {
    const run = await launch({ person: sam });
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", cookie: run.stateCookie };
    if (origin !== undefined) headers.origin = origin;
    const response = await app.inject({
      method: "POST",
      url: "/lti/launch",
      headers,
      payload: new URLSearchParams(run.form).toString(),
    });
    expectRefused(response, 403);
  });
});

describe("the launch's accepted Origins", () => {
  test.each([
    ["the platform's", PLATFORM],
    ["a listed frame origin", FRAME_ORIGINS[1]!],
  ])("%s is accepted", async (_name, origin) => {
    const { launch: response } = await launch({ person: sam, headers: { origin } });
    expect(response.statusCode).toBe(303);
  });
});

/** The line that clears the state cookie, if the reply has one. */
const stateCleared = (response: Awaited<ReturnType<typeof postLaunch>>) =>
  setCookieLines(response).find((l) => l.startsWith(`${STATE_COOKIE}=;`) && /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(l));

describe("refusals", () => {
  test("the refusal page states its sentence once, with no live region", async () => {
    const { launch: response } = await launch({ person: sam, defect: "expired" });
    expect(response.body).toContain(REFUSAL_SENTENCE);
    expect(response.body).not.toContain('role="alert"');
  });

  test("a refused launch clears the state cookie", async () => {
    const run = await launch({ person: sam, defect: "bad_signature" });
    expectRefused(run.launch, 401);
    expect(stateCleared(run.launch)).toMatch(/; Partitioned/);
    const first = await launch({ person: sam });
    const other = await launch({ person: sam });
    expect(stateCleared(await postLaunch(app, first.form, other.stateCookie))).toBeDefined();
  });

  test("a replayed launch, same token and state, is refused at the state step", async () => {
    const run = await launch({ person: sam });
    expect(run.launch.statusCode).toBe(303);
    logLines.length = 0;
    const again = await postLaunch(app, run.form, run.stateCookie);
    expectRefused(again, 401);
    const logged = logLines.map((l) => JSON.parse(l) as Record<string, unknown>).find((l) => l.reason);
    expect(logged?.reason).toBe("state_unknown");
  });

  test("a state cookie that does not match the form is refused", async () => {
    const run = await launch({ person: sam });
    const other = await launch({ person: sam });
    expectRefused(await postLaunch(app, run.form, other.stateCookie), 401);
  });

  test("a disabled account is refused", async () => {
    const tom = PEOPLE.find((p) => p.key === "tom")!;
    await launch({ person: tom });
    const method = await findLtiMethod(testDb.db, PLATFORM, tom.sub);
    await setDisabled(testDb.db, method!.accountId, true);
    const { launch: response } = await launch({ person: tom });
    expectRefused(response, 403);
  });

  test("a launch with no course is refused", async () => {
    const { launch: response } = await launch({ person: sam, defect: "missing_context" });
    expectRefused(response, 401);
  });

  test("a bad token is refused, and the log holds no token, cookie or body", async () => {
    logLines.length = 0;
    const run = await launch({ person: sam, defect: "bad_signature" });
    expectRefused(run.launch, 401);
    const log = logLines.join("\n");
    expect(log).toContain("Canvas launch refused");
    expect(log).not.toContain(run.form.id_token);
    expect(log).not.toContain(run.form.state);
    expect(log).not.toContain(run.stateCookie.split("=")[1]!);
  });
});

describe("framing", () => {
  const ancestors = (policy: unknown) =>
    String(policy)
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("frame-ancestors"));

  test("the app's pages may be framed by the Canvas hosts only", async () => {
    const { launch: response } = await launch({ person: sam });
    const session = cookieOf(response, HTTPS_COOKIE)!.value;
    const page = await app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${session}` } });
    expect(ancestors(page.headers["content-security-policy"])).toBe(`frame-ancestors ${FRAME_ORIGINS.join(" ")}`);
    expect(page.headers["x-frame-options"]).toBeUndefined();
  });

  test("the refusal page is framed like the app's pages", async () => {
    const { launch: response } = await launch({ person: sam, defect: "expired" });
    expect(ancestors(response.headers["content-security-policy"])).toBe(`frame-ancestors ${FRAME_ORIGINS.join(" ")}`);
  });

  test.each(["/sign-in", "/lti/jwks"])("%s is never framed", async (url) => {
    const response = await app.inject({ url });
    expect(response.statusCode).toBe(200);
    expect(ancestors(response.headers["content-security-policy"])).toBe("frame-ancestors 'none'");
    expect(response.headers["x-frame-options"]).toBeUndefined();
  });

  test("without LTI the app's pages are never framed", async () => {
    const page = await unset.inject({ url: "/sign-in" });
    expect(ancestors(page.headers["content-security-policy"])).toBe("frame-ancestors 'none'");
  });
});

describe("the tool's key set", () => {
  test("publishes only public members", async () => {
    const response = await app.inject({ url: "/lti/jwks" });
    const { keys } = response.json() as { keys: Record<string, unknown>[] };
    expect(keys).toHaveLength(1);
    for (const name of ["d", "p", "q", "dp", "dq", "qi"]) expect(keys[0]).not.toHaveProperty(name);
  });
});

describe("with no LTI settings", () => {
  test.each([
    ["GET", "/lti/login"],
    ["GET", "/lti/jwks"],
    ["POST", "/lti/login"],
    ["POST", "/lti/launch"],
  ])("%s %s answers 404 to a signed-in person", async (method, url) => {
    const name = `unset${method}${url.replaceAll("/", "")}`;
    const accounts = await makeAccounts(testDb.db, [name]);
    const token = await sessionToken(testDb.db, accounts[name]!, Date.now());
    const response = await unset.inject({
      method: method as "GET" | "POST",
      url,
      headers: { origin: HTTPS_ORIGIN, cookie: `${HTTPS_COOKIE}=${token}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("sign-out", () => {
  test("clears both the SameSite=Lax cookie and the partitioned one of the same name", async () => {
    const response = await app.inject({ method: "POST", url: "/sign-out", headers: { origin: HTTPS_ORIGIN } });
    expect(response.statusCode).toBe(303);
    const lines = setCookieLines(response).filter((l) => l.startsWith(`${HTTPS_COOKIE}=;`));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/Max-Age=0/);
    expect(lines.find((l) => /; Partitioned/.test(l))).toMatch(/; SameSite=None/);
    expect(lines.find((l) => !/Partitioned/.test(l))).toMatch(/; SameSite=Lax/);
  });
});

describe("a password sign-in beside a launch", () => {
  test("stays SameSite=Lax and clears a partitioned cookie of the same name", async () => {
    await makeAccounts(testDb.db, ["pwperson"]);
    const response = await signIn(app, HTTPS_ORIGIN, { username: "pwperson", password: PASSWORD });
    expect(response.statusCode).toBe(303);
    const lines = setCookieLines(response).filter((l) => l.startsWith(`${HTTPS_COOKIE}=`));
    expect(lines).toHaveLength(2);
    const cleared = lines.find((l) => l.startsWith(`${HTTPS_COOKIE}=;`))!;
    expect(cleared).toMatch(/; Partitioned/);
    expect(cleared).toMatch(/; SameSite=None/);
    expect(cleared).toMatch(/Max-Age=0/);
    const session = lines.find((l) => l !== cleared)!;
    expect(session).toMatch(/; SameSite=Lax/);
    expect(session).not.toMatch(/Partitioned/);
  });
});
