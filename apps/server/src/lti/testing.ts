// A whole Canvas launch through Fastify's `inject`, for the tests (SPEC.md section 1,
// "Canvas launch"): the login, then a launch signed by the mock platform with the
// login's nonce, state and state cookie.

import { generateKeyPairSync } from "node:crypto";
import {
  CLIENT_ID,
  COURSES,
  type Course,
  createSigner,
  DEPLOYMENT_ID,
  type Defect,
  launchClaims,
  PEOPLE,
  type Person,
  type Signer,
  signLaunch,
} from "@diagramble/mock-lti";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { createLocalJWKSet } from "jose";
import type { LtiSettings } from "./settings.ts";
import { STATE_COOKIE } from "./state.ts";

export const PLATFORM = "https://canvas.mock.test";
export const AUTH_URL = `${PLATFORM}/api/lti/authorize_redirect`;
export const FRAME_ORIGINS = ["https://canvas.mock.test", "https://school.instructure.com"];

/** One RSA key for the whole test process; making one costs a moment. */
const toolKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs8",
  format: "pem",
}) as string;

/** LTI settings that trust the mock platform. */
export function makeLtiSettings(): LtiSettings {
  return {
    issuer: PLATFORM,
    clientId: CLIENT_ID,
    deploymentId: DEPLOYMENT_ID,
    authUrl: AUTH_URL,
    keysUrl: `${PLATFORM}/api/lti/security/jwks`,
    frameOrigins: FRAME_ORIGINS,
    toolKey,
  };
}

/** The mock's signer and the key source a server built with `ltiKeys` checks it against. */
export async function makePlatform(): Promise<{ signer: Signer; keys: ReturnType<typeof createLocalJWKSet> }> {
  const signer = await createSigner();
  return { signer, keys: createLocalJWKSet(signer.jwks) };
}

export interface LaunchOptions {
  person?: Person;
  course?: Course;
  role?: Person["role"];
  defect?: Defect;
  /** Seconds since the epoch, for the token's times; by default the real clock. */
  now?: number;
  /** Headers added to the launch POST, such as a session cookie or another Origin. */
  headers?: Record<string, string>;
}

export interface LaunchRun {
  login: LightMyRequestResponse;
  launch: LightMyRequestResponse;
  /** The form and state cookie sent, so a test can send them again. */
  form: { state: string; id_token: string };
  stateCookie: string;
}

/** The launch POST with a given form and state cookie, from the platform's origin. */
export function postLaunch(
  app: FastifyInstance,
  form: Record<string, string>,
  stateCookie: string,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/lti/launch",
    headers: {
      origin: PLATFORM,
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${STATE_COOKIE}=${stateCookie}`,
      ...headers,
    },
    payload: new URLSearchParams(form).toString(),
  });
}

/** Run the login and a signed launch, as the platform and a browser would. */
export async function runLaunch(
  app: FastifyInstance,
  signer: Signer,
  toolUrl: string,
  options: LaunchOptions = {},
): Promise<LaunchRun> {
  const person = options.person ?? PEOPLE[0]!;
  const course = options.course ?? COURSES[0]!;
  const login = await app.inject({
    method: "GET",
    url: "/lti/login",
    query: { iss: PLATFORM, login_hint: person.sub, target_link_uri: `${toolUrl}/`, client_id: CLIENT_ID },
    headers: { "sec-fetch-dest": "iframe" },
  });
  const location = login.headers.location;
  if (typeof location !== "string") throw new Error(`The login answered ${login.statusCode} with no redirect.`);
  const redirect = new URL(location);
  const state = redirect.searchParams.get("state") ?? "";
  const nonce = redirect.searchParams.get("nonce") ?? "";
  const stateCookie = login.cookies.find((c) => c.name === STATE_COOKIE)?.value ?? "";
  const claims = launchClaims({
    issuer: PLATFORM,
    toolUrl,
    person,
    course,
    role: options.role ?? person.role,
    nonce,
    now: options.now ?? Math.floor(Date.now() / 1000),
    defect: options.defect,
  });
  const form = { state, id_token: await signLaunch(signer, claims, options.defect) };
  const launch = await postLaunch(app, form, stateCookie, options.headers);
  return { login, launch, form, stateCookie };
}
