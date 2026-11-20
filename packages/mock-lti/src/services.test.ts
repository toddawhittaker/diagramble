import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, type JSONWebKeySet, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHandler, NRPS_CLAIM, NRPS_MEDIA_TYPE, NRPS_SCOPE, ROLE_URIS, ROSTERS } from "./index.ts";
import { fetchKeysFrom } from "./tool.ts";
import { CLIENT_ID, COURSES, PEOPLE } from "./seed.ts";
import { createSigner, launchClaims } from "./token.ts";

const ISSUER = "http://issuer.test";
const NOW = 1_900_000_000;
const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const course = COURSES[0] as (typeof COURSES)[number];

type Key = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

let server: Server;
let base: string;
let toolKey: Key;
let strangerKey: Key;
let toolKeys: JSONWebKeySet;
let logs: string[];
let clock: number;
let jtiCounter: number;

beforeEach(async () => {
  const tool = await generateKeyPair("RS256");
  toolKey = tool.privateKey;
  strangerKey = (await generateKeyPair("RS256")).privateKey;
  toolKeys = { keys: [{ ...(await exportJWK(tool.publicKey)), kid: "tool-key", alg: "RS256", use: "sig" }] };
  logs = [];
  clock = NOW;
  jtiCounter = 0;
  const handler = createHandler({
    issuer: ISSUER,
    toolUrl: "http://tool.test",
    signer: await createSigner(),
    log: (line) => logs.push(line),
    now: () => clock,
    fetchToolKeys: async () => toolKeys,
  });
  server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

interface AssertionOptions {
  key?: Key;
  iss?: string;
  sub?: string;
  aud?: string;
  jti?: string | null;
  iat?: number;
  exp?: number;
}

function assertion(o: AssertionOptions = {}): Promise<string> {
  const iat = o.iat ?? NOW;
  const claims: Record<string, unknown> = {
    iss: o.iss ?? CLIENT_ID,
    sub: o.sub ?? CLIENT_ID,
    aud: o.aud ?? `${ISSUER}/token`,
    iat,
    exp: o.exp ?? iat + 300,
  };
  if (o.jti !== null) claims.jti = o.jti ?? `jti-${++jtiCounter}`;
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "tool-key" }).sign(o.key ?? toolKey);
}

async function postToken(fields: Record<string, string>) {
  const res = await fetch(`${base}/token`, { method: "POST", body: new URLSearchParams(fields) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function tokenFor(o: AssertionOptions = {}, scope = NRPS_SCOPE) {
  return postToken({
    grant_type: "client_credentials",
    client_assertion_type: ASSERTION_TYPE,
    client_assertion: await assertion(o),
    scope,
  });
}

async function bearer(): Promise<string> {
  const { status, body } = await tokenFor();
  expect(status).toBe(200);
  return body.access_token as string;
}

function memberships(token: string | undefined, path = `/nrps/${course.id}/memberships`) {
  return fetch(`${base}${path}`, { headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
}

describe("the launch's roster claim", () => {
  it("names the course's class list and the service version", () => {
    const person = PEOPLE[0] as (typeof PEOPLE)[number];
    for (const c of COURSES) {
      const claims = launchClaims({
        issuer: ISSUER,
        toolUrl: "http://tool.test",
        person,
        course: c,
        role: person.role,
        nonce: "n",
        now: NOW,
      });
      expect(claims[NRPS_CLAIM]).toEqual({
        context_memberships_url: `${ISSUER}/nrps/${c.id}/memberships`,
        service_versions: ["2.0"],
      });
    }
    expect(NRPS_CLAIM).toBe("https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice");
  });
});

describe("the token endpoint", () => {
  it("gives a one-hour bearer token for a good assertion and the read-only scope", async () => {
    const { status, body } = await tokenFor();
    expect(status).toBe(200);
    expect(body).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: NRPS_SCOPE });
    expect(typeof body.access_token).toBe("string");
    expect(logs).toEqual(["token issued"]);
  });

  it("accepts the scope among others", async () => {
    expect((await tokenFor({}, `openid ${NRPS_SCOPE}`)).status).toBe(200);
  });

  it.each([
    ["a bad signature", { key: "stranger" }],
    ["a wrong audience", { aud: "http://elsewhere.test/token" }],
    ["a wrong issuer", { iss: "someone-else" }],
    ["a subject other than the client ID", { sub: "someone-else" }],
    ["an expired assertion", { iat: NOW - 3600 }],
    ["an assertion with no jti", { jti: null }],
  ])("refuses %s", async (_name, change) => {
    const { key, ...rest } = change as { key?: string } & AssertionOptions;
    const { status, body } = await tokenFor({ ...rest, ...(key ? { key: strangerKey } : {}) });
    expect(status).toBe(401);
    expect(body).toEqual({ error: "invalid_client" });
    expect(logs).toEqual([]);
  });

  it("refuses a replayed assertion, the second time only", async () => {
    const token = await assertion({ jti: "same" });
    const fields = { grant_type: "client_credentials", client_assertion_type: ASSERTION_TYPE, client_assertion: token, scope: NRPS_SCOPE };
    expect((await postToken(fields)).status).toBe(200);
    const again = await postToken(fields);
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: "invalid_client" });
  });

  it("refuses a scope other than the class-list read scope", async () => {
    const { status, body } = await tokenFor({}, "https://purl.imsglobal.org/spec/lti-ags/scope/score");
    expect(status).toBe(400);
    expect(body).toEqual({ error: "invalid_scope" });
    expect((await tokenFor({}, "")).body).toEqual({ error: "invalid_scope" });
  });

  it("refuses another grant type and another assertion type", async () => {
    const client_assertion = await assertion();
    expect((await postToken({ grant_type: "password", client_assertion })).body).toEqual({
      error: "unsupported_grant_type",
    });
    expect(
      (await postToken({ grant_type: "client_credentials", client_assertion_type: "x", client_assertion })).body,
    ).toEqual({ error: "invalid_request" });
  });

  it("refuses an assertion when the tool's key set cannot be fetched", async () => {
    const handler = createHandler({
      issuer: ISSUER,
      toolUrl: "http://tool.test",
      signer: await createSigner(),
      log: () => {},
      now: () => NOW,
      fetchToolKeys: async () => {
        throw new Error("tool is down");
      },
    });
    const other = createServer((req, res) => void handler(req, res));
    await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${(other.address() as AddressInfo).port}/token`, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_assertion_type: ASSERTION_TYPE,
          client_assertion: await assertion(),
          scope: NRPS_SCOPE,
        }),
      });
      expect(res.status).toBe(401);
    } finally {
      await new Promise((resolve) => other.close(resolve));
    }
  });
});

describe("the class list", () => {
  async function allMembers(token: string, path = `/nrps/${course.id}/memberships`) {
    const members: Record<string, unknown>[] = [];
    let next: string | undefined = `${base}${path}`;
    let first: Record<string, unknown> | undefined;
    while (next) {
      const res: Response = await memberships(token, next.replace(ISSUER, "").replace(base, ""));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(NRPS_MEDIA_TYPE);
      const body = (await res.json()) as { members: Record<string, unknown>[] };
      first ??= body;
      members.push(...body.members);
      const link: string | null = res.headers.get("link");
      next = link ? /<([^>]+)>; rel="next"/.exec(link)?.[1] : undefined;
    }
    return { members, first: first as Record<string, unknown> };
  }

  it("returns the course's seed members across pages, with roles and no email", async () => {
    const { members, first } = await allMembers(await bearer());
    const keys = ROSTERS[course.key] ?? [];
    expect(members).toHaveLength(keys.length);
    expect(first).toMatchObject({
      id: `${ISSUER}/nrps/${course.id}/memberships`,
      context: { id: course.id, label: course.label, title: course.title },
    });
    const sam = PEOPLE.find((p) => p.key === "sam");
    expect(members).toContainEqual({
      status: "Active",
      user_id: sam?.sub,
      name: "Sam Student",
      given_name: "Sam",
      family_name: "Student",
      roles: [ROLE_URIS.Learner],
    });
    expect(members.every((m) => !("email" in m))).toBe(true);
  });

  it("lists each course's own members", async () => {
    const token = await bearer();
    const other = COURSES[1] as (typeof COURSES)[number];
    const { members } = await allMembers(token, `/nrps/${other.id}/memberships`);
    expect(members.map((m) => m.given_name).sort()).toEqual(["Ivy", "Sam", "Tom"]);
  });

  it("pages by the limit asked for and ends without a next link", async () => {
    const token = await bearer();
    const res = await memberships(token, `/nrps/${course.id}/memberships?limit=100`);
    expect(((await res.json()) as { members: unknown[] }).members).toHaveLength((ROSTERS[course.key] ?? []).length);
    expect(res.headers.get("link")).toBeNull();
    const small = await memberships(token, `/nrps/${course.id}/memberships?limit=2&page=2`);
    expect(small.headers.get("link")).toContain("page=3&limit=2");
  });

  it("accepts one token for every course", async () => {
    const token = await bearer();
    for (const c of COURSES) expect((await memberships(token, `/nrps/${c.id}/memberships`)).status).toBe(200);
  });

  it("refuses a missing token, an unknown token and a token that is not a bearer", async () => {
    expect((await memberships(undefined)).status).toBe(401);
    expect((await memberships("nope")).status).toBe(401);
    const res = await fetch(`${base}/nrps/${course.id}/memberships`, { headers: { authorization: `Basic ${await bearer()}` } });
    expect(res.status).toBe(401);
  });

  it("refuses a token after its hour", async () => {
    const token = await bearer();
    clock = NOW + 3599;
    expect((await memberships(token)).status).toBe(200);
    clock = NOW + 3600;
    expect((await memberships(token)).status).toBe(401);
  });

  it("answers 404 for an unknown course", async () => {
    const token = await bearer();
    expect((await memberships(token, "/nrps/no-such-course/memberships")).status).toBe(404);
    expect((await memberships(token, `/nrps/${course.id}/other`)).status).toBe(404);
  });

  it("is a read: a POST finds nothing", async () => {
    const res = await fetch(`${base}/nrps/${course.id}/memberships`, {
      method: "POST",
      headers: { authorization: `Bearer ${await bearer()}` },
    });
    expect(res.status).toBe(404);
  });
});

describe("the tool's key set", () => {
  it("is fetched from the tool's /lti/jwks", async () => {
    const tool = createServer((req, res) => {
      res.writeHead(req.url === "/lti/jwks" ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(toolKeys));
    });
    await new Promise<void>((resolve) => tool.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(tool.address() as AddressInfo).port}`;
    try {
      expect(await fetchKeysFrom(url)()).toEqual(toolKeys);
      await expect(fetchKeysFrom(`${url}/missing`)()).rejects.toThrow(/answered 404/);
    } finally {
      await new Promise((resolve) => tool.close(resolve));
    }
  });
});
