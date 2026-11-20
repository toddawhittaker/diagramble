import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { html, json, readForm, send } from "./http.ts";
import { autoPostPage, coursePage, errorPage, launchPage } from "./pages.ts";
import { CLIENT_ID, type Course, DEPLOYMENT_ID, findCourse, findPerson, isRoleName, type Person, type RoleName } from "./seed.ts";
import { type Defect, isDefect, launchClaims, type Signer, signLaunch } from "./token.ts";

export interface MockPlatformOptions {
  /** The platform's `iss`, and the address the browser reaches the mock at. */
  issuer: string;
  /** The tool's address, as the browser reaches it. */
  toolUrl: string;
  signer: Signer;
  log: (line: string) => void;
  /** Seconds since the epoch. */
  now?: () => number;
}

interface PendingLaunch {
  person: Person;
  course: Course;
  role: RoleName;
  defect?: Defect;
}

type Route = (params: URLSearchParams, res: ServerResponse) => unknown;

const MAX_PENDING = 1000;
const PLAIN_TEXT = "text/plain; charset=utf-8";

/** The last defect-free launch: the token, the state it went out under and its `exp`, in seconds. */
interface LastGoodLaunch {
  token: string;
  state: string;
  exp: number;
}

/** The seed person and course a launch form names, or the message for whichever is missing. */
function chosenPersonAndCourse(params: URLSearchParams): { person: Person; course: Course } | { problem: string } {
  const person = findPerson(params.get("person") ?? "");
  const course = findCourse(params.get("course") ?? "");
  if (!person) return { problem: "Choose a person from the list." };
  if (!course) return { problem: "Choose a course from the list." };
  return { person, course };
}

/** Authorize parameters from the form body when posted, with query parameters filling any gaps. */
async function authorizeParams(req: IncomingMessage, url: URL, method: string): Promise<URLSearchParams> {
  const params = method === "POST" ? await readForm(req) : new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}

export function createHandler(options: MockPlatformOptions) {
  const { issuer, toolUrl, signer, log } = options;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  // Launches stay valid for the life of the process: the framed login re-submits the same hint.
  const pending = new Map<string, PendingLaunch>();
  let lastGood: LastGoodLaunch | undefined;
  // Stops another site from making the operator's browser start a launch.
  const formToken = randomBytes(32).toString("base64url");
  const formTokenOk = (value: string | null) => {
    const given = Buffer.from(value ?? "");
    const expected = Buffer.from(formToken);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  function loginFields(id: string, launch: PendingLaunch): Record<string, string> {
    return {
      iss: issuer,
      login_hint: launch.person.key,
      target_link_uri: `${toolUrl}/`,
      lti_message_hint: id,
      client_id: CLIENT_ID,
      lti_deployment_id: DEPLOYMENT_ID,
    };
  }

  function start(params: URLSearchParams, res: ServerResponse) {
    if (!formTokenOk(params.get("form_token"))) {
      return html(res, 403, errorPage("Start the launch from this mock's launch page."));
    }
    const chosen = chosenPersonAndCourse(params);
    if ("problem" in chosen) return html(res, 400, errorPage(chosen.problem));
    const roleParam = params.get("role") ?? "";
    const defectParam = params.get("defect") ?? "";
    if (roleParam !== "" && !isRoleName(roleParam)) return html(res, 400, errorPage("Choose a role from the list."));
    if (defectParam !== "" && !isDefect(defectParam)) {
      return html(res, 400, errorPage("Choose a defect from the list."));
    }
    const { person, course } = chosen;
    const id = randomUUID();
    if (pending.size >= MAX_PENDING) {
      const oldest = pending.keys().next().value;
      if (oldest !== undefined) pending.delete(oldest);
    }
    pending.set(id, {
      person,
      course,
      role: roleParam === "" ? person.role : roleParam,
      defect: defectParam === "" ? undefined : defectParam,
    });
    if (params.get("frame") === "1") {
      res.writeHead(303, { location: `/course?launch=${id}`, "cache-control": "no-store" });
      return res.end();
    }
    return loginPage(id, res);
  }

  function loginPage(id: string, res: ServerResponse) {
    const launch = pending.get(id);
    if (!launch) return html(res, 404, errorPage("That launch is unknown. Start again."));
    return html(res, 200, autoPostPage(`${toolUrl}/lti/login`, loginFields(id, launch)));
  }

  function course(params: URLSearchParams, res: ServerResponse) {
    const id = params.get("launch") ?? "";
    const launch = pending.get(id);
    if (!launch) return html(res, 404, errorPage("That launch is unknown. Start again."));
    const name = `${launch.person.givenName} ${launch.person.familyName}`;
    return html(res, 200, coursePage(launch.course.title, name, `/frame?launch=${id}`));
  }

  /** What is wrong with the OpenID Connect parameters of an authorize request, if anything. */
  function authorizeRequestProblem(params: URLSearchParams): string | null {
    if (!(params.get("scope") ?? "").split(" ").includes("openid")) return "scope must include openid.";
    if (params.get("response_type") !== "id_token") return "response_type must be id_token.";
    const mode = params.get("response_mode");
    if (mode !== null && mode !== "form_post") return "response_mode must be form_post.";
    if (params.get("client_id") !== CLIENT_ID) return "client_id is not this tool's.";
    // Posting a signed token to any other address would make this an open redirector.
    if (params.get("redirect_uri") !== `${toolUrl}/lti/launch`) return "redirect_uri is not this tool's launch URL.";
    return null;
  }

  /** The last good launch, or why it cannot be replayed. */
  function replayable(): LastGoodLaunch | { problem: string } {
    if (lastGood === undefined) {
      return { problem: "replayed needs an earlier good launch to replay. Launch once without a defect first." };
    }
    // An expired replay would fail on exp as well as on being a replay.
    if (now() >= lastGood.exp) {
      return { problem: "The last good launch has expired. Launch once more without a defect, then replay." };
    }
    return lastGood;
  }

  async function authorize(params: URLSearchParams, res: ServerResponse) {
    const refuse = (message: string) => html(res, 400, errorPage(message));
    const requestProblem = authorizeRequestProblem(params);
    if (requestProblem) return refuse(requestProblem);
    const state = params.get("state") ?? "";
    const nonce = params.get("nonce") ?? "";
    if (state === "" || nonce === "") return refuse("state and nonce are required.");
    const launch = pending.get(params.get("lti_message_hint") ?? "");
    if (!launch) return refuse("lti_message_hint names no launch started here.");
    if (params.get("login_hint") !== launch.person.key) return refuse("login_hint does not match the launch.");
    const { defect } = launch;

    let fields: { id_token: string; state: string };
    if (defect === "replayed") {
      // The same message again: the earlier good token with the state it was first sent under.
      const replay = replayable();
      if ("problem" in replay) return refuse(replay.problem);
      fields = { id_token: replay.token, state: replay.state };
    } else {
      const claims = launchClaims({
        issuer,
        toolUrl,
        person: launch.person,
        course: launch.course,
        role: launch.role,
        nonce,
        now: now(),
        defect,
      });
      const token = await signLaunch(signer, claims, defect);
      // Replay only a good token, so the replay fails as a replay and nothing else.
      if (defect === undefined) lastGood = { token, state, exp: Number(claims.exp) };
      fields = { id_token: token, state };
    }
    // Never the token, and nothing about the person beyond the seed key.
    log(`launch person=${launch.person.key} defect=${defect ?? "none"}`);
    return html(res, 200, autoPostPage(`${toolUrl}/lti/launch`, fields));
  }

  // Each table is a plain list of routes; a new service adds a line.
  const getRoutes: Record<string, Route> = {
    "/": (_params, res) => html(res, 200, launchPage(toolUrl, formToken)),
    "/jwks": (_params, res) => json(res, 200, signer.jwks),
    "/course": course,
    "/frame": (params, res) => loginPage(params.get("launch") ?? "", res),
  };

  // POST routes that take a form body.
  const formRoutes: Record<string, Route> = {
    "/start": start,
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://mock-lti.invalid");
    const method = req.method ?? "GET";
    try {
      const getRoute = method === "GET" ? getRoutes[url.pathname] : undefined;
      if (getRoute) {
        await getRoute(url.searchParams, res);
        return;
      }
      const formRoute = method === "POST" ? formRoutes[url.pathname] : undefined;
      if (formRoute) {
        await formRoute(await readForm(req), res);
        return;
      }
      if (url.pathname === "/authorize" && (method === "GET" || method === "POST")) {
        await authorize(await authorizeParams(req, url, method), res);
        return;
      }
      send(res, 404, PLAIN_TEXT, "Not found\n");
    } catch {
      send(res, 400, PLAIN_TEXT, "Bad request\n");
    }
  };
}
