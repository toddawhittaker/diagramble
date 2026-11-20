# Epic 4 plan: Canvas launch

This is the detailed plan for Epic 4 of `docs/EPICS.md`. It lives only on the epic
branch `epic/4-canvas-launch` and is deleted by the fold task. Epic 4 serves SPEC.md
section 1 (the rows "Canvas launch", "Sign-in", "Host names" and "Grading"), section 2
item 6, section 3.9 (the login) and section 12, and VISION.md section 5, "Canvas through
LTI 1.3". It builds the Learning Tools Interoperability (LTI) 1.3 login and launch in
`apps/server/src/lti/`, and a mock LTI 1.3 platform in `packages/mock-lti`.

Base commit: `0f48ab4` (`main`). Milestone: "Epic 4: Canvas launch". It closes no
issues. The architect designed it first (the `epic-run` skill, step 2); the rulings
below are its recommendations as the user decided them. Code ported from the user's own
Portikus project (MIT license, `~/projects/portikus`, `packages/auth/src/lti`,
`apps/api/src/routes/lti.ts` and `packages/mock-lms/src`) needs no notice; each porting
commit names the Portikus file it came from.

## Rulings

1. **Schema.** One migration, `0002_lti`.
   - `sign_in_methods.kind`: the check `sign_in_methods_kind_check` is dropped and
     re-added as `kind in ('password', 'lti')`. An LTI method is (`lti`, the token's
     `iss` exactly as sent, its `sub`), with no password hash. The unique key (kind,
     issuer, subject) stays.
   - `lti_login_states`: `state_hash text` primary key (SHA-256 of the state, through
     the existing `hashToken`), `nonce text`, `expires_at` (10 minutes), `created_at`.
     A launch consumes its row with one `DELETE … RETURNING`, so a state and its nonce
     work once. Making a row deletes expired rows.
   - `courses`: `id uuid` primary key, `issuer text`, `context_id text` (1 to 255
     characters), `title text`, `created_at`, `updated_at`; unique on (issuer,
     context_id). Epic 7's projects and the later course settings refer to `courses.id`.
   - `course_members`: `course_id`, `account_id` (each deleted with its parent), `role
     text` checked to `('student', 'instructor')`, `first_launch_at`,
     `last_launch_at`; primary key (course_id, account_id). Every launch refreshes the
     role and `last_launch_at`.
2. **Settings.** Seven variables, set all together or not at all. With none, the server
   runs as today and the `/lti/*` routes answer 404; with some but not all, start-up
   stops with a sentence naming the missing ones. `settings.ts` gains `lti: LtiSettings
   | null`.

   | Variable | Rule |
   | --- | --- |
   | `LTI_ISSUER` | The platform's `iss`, exact string |
   | `LTI_CLIENT_ID` | The tool's client ID at the platform |
   | `LTI_DEPLOYMENT_ID` | The one deployment ID accepted |
   | `LTI_AUTH_URL` | The platform's OpenID Connect authorization endpoint. Its origin is the only `Origin` a launch accepts (ruling 5) |
   | `LTI_KEYS_URL` | The platform's public key set |
   | `LTI_FRAME_ORIGINS` | Origins allowed to frame the app, separated by spaces (the school's Canvas host, which is not the issuer) |
   | `LTI_TOOL_KEY` | The tool's RSA private key in PEM, at least 2048 bits |

   Every address is https unless its host is `localhost`, ends in `.localhost`, or is a
   single-label name such as a Docker service name.
3. **The tool's key** lives in `LTI_TOOL_KEY`, like every other secret. `GET /lti/jwks`
   publishes its public members only (`kty`, `n`, `e`, `kid`, `alg`, `use`), with the
   key ID taken from the key's RFC 7638 thumbprint. WORKFLOW.md gives the `openssl
   genpkey` command that makes one. Only the mock's roster service uses it in Release 0
   (ruling 10).
4. **Routes.** `/lti/login`, `/lti/launch` and `/lti/jwks`. These paths are typed into
   each Canvas developer key, so they keep these names.
   - `GET` and `POST /lti/login`: open and exempt from the `Origin` check, because it
     grants nothing; it stores a login state, sets the state cookie and redirects to
     `LTI_AUTH_URL`. It accepts `Sec-Fetch-Dest` of `document` or `iframe`.
   - `POST /lti/launch`: open; see ruling 5 for its `Origin` rule. In order: the state
     cookie matches the form's state; the state row is consumed; the token is checked
     (algorithm, signature, issuer, audience, times, nonce, deployment, message type,
     version, target, subject, resource link, context); a launch with no course
     (context) claim is refused; the account is found or made (ruling 7); the course and
     the membership are written; the session the browser sent is ended and a new one is
     made; then a 303 to `/?course=<courses.id>`, our own course ID, which Epics 7 and 8
     read.
   - `GET /lti/jwks`: open, a GET, so not checked.
   - Refusal pages reuse `/sign-in.css` and say in a plain sentence that the launch
     could not sign the person in, without naming which check failed. The server's log
     names the check.
5. **The launch's `Origin`.** `/lti/launch` is on the guard's exempt list for the app's
   own origin, and the handler instead requires `Origin` to equal the origin of
   `LTI_AUTH_URL`. A missing `Origin`, `null`, the app's own origin and every other value
   get 403. Every other route keeps Epic 3's check unchanged.
6. **The cookie inside a frame.** Sessions made by a launch, and the login-state cookie,
   are `Secure; HttpOnly; SameSite=None; Partitioned; Path=/`, under the same names as
   today (`__Host-…` over https, the plain name on localhost). A partitioned cookie is
   kept per top-level site, so a launch session travels on cross-site requests only
   inside Canvas's own partition; the `Origin` check still covers forged requests.
   Password sessions stay `SameSite=Lax`, exactly as Epic 3 reviewed them. A password
   sign-in also clears a partitioned cookie of the same name, so a browser never sends
   two. Safari's handling is checked by hand at the trial; the proof runs Chromium.
7. **The account after a launch.** The method is found by (`lti`, iss, sub). A launch
   never links to a password account, even one with the same login; `accounts.login` is
   not unique. A new account's login (SPEC.md section 3.9) comes from the custom claim
   `login_id`, which each Canvas developer key maps to `$Canvas.user.loginId`, trimmed,
   at most 255 characters. A missing or empty value, or one starting with `$` (Canvas did
   not fill it in), falls back to the part of the `email` claim before `@`, and with no
   email to `user` plus the first 8 characters of the account ID, which is made with
   `randomUUID()` before the insert. Two first launches at once: the loser catches the
   unique violation and uses the winner's row. A disabled account gets the refusal page.
   Later launches change the login never and the membership always.
8. **Framing.** When LTI is set, the app's pages carry `frame-ancestors
   <LTI_FRAME_ORIGINS>`. The sign-in page and `/lti/jwks` keep `frame-ancestors 'none'`,
   so the password form is never framed. No `X-Frame-Options`, which cannot list sites.
   When a session ends inside the frame the sign-in page shows blank there; Epic 8 says
   what the student sees.
9. **Roles.** The LTI roles claim maps to `instructor` (any instructor, teaching
   assistant, content developer or administrator role of the context or institution) or
   else `student`, as Portikus's `roles.ts` does. The role is kept on the membership
   only; nothing in Release 0 acts on it.
10. **The mock platform**, `@diagramble/mock-lti`, a workspace with no build step and
    `jose` as its only dependency. It is both a library and a small `node:http` server.
    - Library (`src/index.ts`): the platform's signer and key set, a claim builder,
      `signLaunch`, the defect list, and the seed people and courses. The server's tests
      sign launches in-process and pass `createLocalJWKSet` as the key source; one
      integration test listens on `127.0.0.1:0` to cover the remote key set.
    - Server (`src/main.ts`, flags `--public-url`, `--tool-url`, `--keys-url`): a launch
      page choosing person, course, role and defect, guarded by a form token against
      forged launches; a course page that frames the tool; `/authorize`; `/jwks`; and it
      prints the seven `LTI_*` lines for the server's settings.
    - Each launch sends the custom claim `login_id`. The seed includes a person with no
      login ID and one whose value comes back as the literal `$Canvas.user.loginId`.
    - Defects, each failing exactly one check: `bad_signature`, `alg_none`,
      `alg_hs256`, `wrong_iss`, `wrong_aud`, `expired`, `issued_in_future`,
      `wrong_nonce`, `replayed`, `unknown_deployment`, `wrong_message_type`,
      `wrong_version`, `wrong_target`, `missing_sub`, `missing_resource_link`,
      `missing_context`.
    - The roster service (LTI Names and Role Provisioning Services) is ported now, from
      Portikus's `roster.ts`, `services.ts` and `tool.ts`: a token endpoint that takes a
      client assertion signed with the tool's key and checked against the tool's
      `/lti/jwks`, and a class-list endpoint for each course. Launches carry the
      service's claim. Nothing in `apps/server` calls it in Release 0; the Release 2
      course dashboard is its first user.
    - Left out of the port: deep linking, content links and the TLS listener.
    - It is never in the Docker image. The runtime stage copies only the packages it
      names, so the Dockerfile needs no edit; the proof checks the image.
11. **Shared files.** One task (T1) edits `package-lock.json` and adds the mock as a
    devDependency of `apps/server`. The root `package.json`, CI, `vitest.config.ts`, the
    Dockerfile and `compose.yaml` need no edit: the `packages/*` pattern already picks up
    the new workspace. The `LTI_*` lines for deployers go into `compose.yaml` in Epic 8.
12. **Testing in a browser.** CI has no browser for the server, and `ci.yml` is closed to
    this epic, so CI checks the cookie and framing headers through `inject` tests, and
    the framed launch is shown in the proof.
13. **The proof** runs on Epic 3's proof stack (the `diagramble` Compose project behind
    Caddy at `diagramble.thewhittakers.org`), with the new image and an uncommitted
    `compose.override.yaml`. The mock runs as a `node` container on the `diagramble`
    network with port 4000 open on 127.0.0.1: the browser opens it at
    `http://localhost:4000`, a different site from `thewhittakers.org`, so the frame is
    truly third-party, and the server fetches its keys at `http://mock-lti:4000/jwks`.
    In Chromium, a student and an instructor each launch at the top level and inside the
    mock's frame and land signed in; the cookie and policy headers are checked; one
    defect launch is refused; the key set is fetched with curl; the mock's roster
    service issues a token to the tool's signed assertion; and the image holds no
    `mock-lti`. Screenshots are dark first.

## Tasks

All paths below are under `apps/server/src/` unless they start with `packages/`.

| Task | Owner and model | Files it may touch | Starts after | What done looks like |
| --- | --- | --- | --- | --- |
| T1 Mock platform | builder, Sonnet, high effort | `packages/mock-lti/**` except the roster files of T2, `package-lock.json`, `apps/server/package.json` (one devDependency) | None | Ruling 10 without the roster service. The library signs launches and every defect; the server serves the launch page, the framing course page, `/authorize` and `/jwks`, and prints the settings; tests for the form token, each defect and the unfilled login ID |
| T2 Mock roster service | builder, Sonnet, high effort | `packages/mock-lti/src/roster.ts`, `services.ts`, `tool.ts`, their tests, and the route lines and launch claim they need in T1's `server.ts` and claim builder | T1 | Ruling 10's roster service. A good assertion gets a token and the class list; a bad signature, wrong audience, replayed assertion, expired token and wrong scope are refused |
| T3 Schema and stores | builder, Sonnet, high effort | `migrations/0002_lti.ts`, `db/schema.ts`, `accounts/store.ts`, `lti/store.ts`, their tests, a migration test in `db/` | None | Rulings 1 and 7's store part, against PostgreSQL: the widened kind check, a state consumed once and expired rows deleted, the course unique key, cascades, the role check, the race on first launch, login fallbacks |
| T4 LTI core | builder, Sonnet, high effort | `lti/settings.ts`, `lti/login.ts`, `lti/state.ts`, `lti/validate.ts`, `lti/roles.ts`, `lti/tool-key.ts`, their tests | T1 | Rulings 2, 3, 9 and the checks of ruling 4. Each defect from the mock library refused for its own reason; settings all or none; the key set has no private member |
| T5 Routes and wiring | builder, Opus, low effort | `lti/routes.ts`, `lti/pages.ts`, `lti/testing.ts`, their tests; `settings.ts`, `server.ts`, `guard.ts`, `accounts/sessions.ts`, `accounts/routes.ts`, `security/harness.ts` and their tests | T3, T4 | Rulings 4 to 8 through `inject` against PostgreSQL: a launch signs in and redirects to the course, the launch cookie and framing headers, 404 when LTI is unset |
| T6 Security tests | tester, Sonnet, high effort | `security/lti.test.ts` (new file only) | T5 | Every defect and a missing, mismatched or replayed state refused; the launch `Origin` cases (platform accepted; app origin, another site, `null`, missing refused); `/lti/login` exempt and every other route still checked; cookie attributes for both kinds of session; `frame-ancestors` on each page; a disabled account refused; no link to a password account; the 404s when unset |
| T7 Proof | tester, Sonnet, high effort | Nothing committed; `compose.override.yaml` and the mock container in the proof worktree; output in the scratchpad | T2, T5 (rerun at the final head) | Ruling 13, with screenshots, dark first, for the epic pull request |
| T8 Fold | the main session | `docs/STATUS.md`, `docs/SPEC.md` sections 1, 3.9, 12 and 14.1, `docs/EPICS.md` (the Epic 4 entry's mock line), WORKFLOW.md "Local development", CLAUDE.md's commands table, this file (deleted) | T7 and the review fixes | The lasting rulings in the spec in a sentence or two each; the Epic 4 entry in STATUS.md; this plan deleted |

All tasks run here, each in its own worktree.

Waves, for reading only: T1 and T3; then T2 and T4; then T5; then T6 and the proof; then
the fold.

## Review

The security reviewer and the code reviewer run over the epic head once T5 has landed,
and make a short pass over the rest when T6 lands. The accessibility reviewer reviews
the refusal pages in `lti/pages.ts` and the mock's launch page.

## Left out on purpose

- Deep linking, Assignment and Grade Services, and certification: in no plan (SPEC.md
  section 1, "Grading").
- Any server code that calls the roster service: the Release 2 course dashboard.
- More than one platform registration: Release 0 has one (SPEC.md section 1).
- Linking a launch to an existing password account: a later feature through a
  signed-in session.
- A new-window fallback for browsers that drop partitioned cookies: built only if the
  trial finds one.
- A framed-launch browser test in CI: it needs a CI edit or Epic 6's Playwright setup.
- The `LTI_*` lines in `compose.yaml`: Epic 8.
- The account's name and email, and the platform's display name: nothing reads them.
