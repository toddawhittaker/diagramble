# Epic 3 plan: Server and sign-in

This is the detailed plan for Epic 3 of `docs/EPICS.md`. It lives only on the epic
branch `epic/3-server-sign-in` and is deleted by the fold task. Epic 3 serves SPEC.md
section 1 (the rows "Server framework", "Database access", "Deployment", "Sign-in" and
"Host names"), section 2 item 8, section 3.9 (the login) and section 12. It builds
`apps/server`: a Fastify server with checked settings, PostgreSQL through Kysely,
password accounts, sessions, the `Origin` check, the sign-in page, the prototype's build
served behind the sign-in, and the Docker files.

Base commit: `581aac8` (`main`). Milestone: "Epic 3: Server and sign-in". It closes no
issues. The architect designed it first (the `epic-run` skill, step 2); the rulings
below are its recommendations as the user decided them. Code ported from the user's own
Portikus project (MIT license, `~/projects/portikus`) needs no notice; each porting
commit names the Portikus file it came from.

## Rulings

1. **Schema.** One migration, `0001_accounts`, makes three tables.
   - `accounts`: `id uuid` primary key defaulting to `gen_random_uuid()` (version 4, so
     the login fallback of SPEC.md section 3.9 stays distinct), `login text not null`
     (set once, not unique), `disabled_at timestamptz null`, `created_at timestamptz`.
   - `sign_in_methods`: `id uuid` primary key, `account_id` (deleted with the account),
     `kind text` checked against the known kinds (only `password` now), `issuer text
     not null`, `subject text not null`, `password_hash text null`, `created_at`. Unique
     on `(kind, issuer, subject)`. A check makes `password_hash` present exactly when
     `kind = 'password'`. A password method has `issuer = ''` and the username as
     `subject`. Epic 4's LTI method is `('lti', iss, sub)` in the same table.
   - `sessions`: `id text` primary key holding the SHA-256 hash of the token in hex,
     `account_id` and `method_id` (each deleted with its parent), `created_at`,
     `expires_at`, with indexes on `expires_at` and `account_id`.
2. **Usernames** match `^[a-z0-9][a-z0-9._-]{0,63}$` after lowercasing, which keeps the
   login safe in export file names. `make` sets the new account's login to the username.
3. **Session cookie.** Named `__Host-diagramble-session` when `APP_ORIGIN` is https, so
   the browser refuses any `Domain` attribute; plain `diagramble-session` on
   `http://localhost`. `HttpOnly`, `Secure` whenever `APP_ORIGIN` is https, `Path=/`,
   no `Domain`, `SameSite=Lax`. The value is the token itself, 32 random bytes in
   base64url; only its hash is stored, so a copy of the database opens no session. No
   cookie-signing secret. Epic 4 decides what a launch inside a frame needs.
4. **Session lifetime.** An absolute 24 hours from sign-in, with no idle timeout and no
   write per request. Every sign-in makes a new token and ends the session of any cookie
   the browser sent. Making a session deletes expired rows. Loading a session refuses an
   expired one and one whose account is disabled.
5. **Settings.** `apps/server/src/settings.ts` exports a Zod `settingsSchema` and
   `readSettings(env)`; a bad or missing value stops start-up with a sentence naming the
   variable. Secrets arrive only as environment variables; Compose reads them from an
   `.env` file that is not committed.

   | Variable | Rule |
   | --- | --- |
   | `DATABASE_URL` | Required, a `postgres://` or `postgresql://` URL |
   | `APP_ORIGIN` | Required. A URL whose origin equals the whole string; https unless the host is `localhost` or ends in `.localhost` |
   | `PORT` | A whole number, default 3000. The server listens on `0.0.0.0` |
   | `TRUST_PROXY_HOPS` | A whole number, default 0, passed to Fastify's `trustProxy`. Compose sets 1 |
   | `STATIC_DIR` | Required, an existing directory. The Dockerfile sets it |

   The `Origin` check and the cookie's `Secure` attribute come from `APP_ORIGIN`, never
   from the request. Epic 4 adds its LTI variables to the same schema.
6. **The `Origin` check** covers every request with a method other than GET, HEAD or
   OPTIONS, signed in or not, the sign-in POST and sign-out included. `Origin` must equal
   `APP_ORIGIN` exactly; anything else, `Origin: null` and a missing `Origin` included,
   gets 403 and a plain sentence. Only routes on the guard's exempt list skip it, and the
   list is empty until Epic 4's launch. No GET route changes anything. This is wider
   than SPEC.md section 1, "Host names", which names only requests signed in by the
   cookie; it also stops another site from signing a person in to an account of its
   choosing. The fold records it there.
7. **Headers.** Every reply carries `Referrer-Policy: strict-origin-when-cross-origin`
   (under `no-referrer` browsers send `Origin: null` on a same-origin form) and
   `frame-ancestors 'none'` in its Content Security Policy. The sign-in page's policy is
   `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self';
   frame-ancestors 'none'; base-uri 'none'`. Epic 4 relaxes framing for the launch.
8. **Who sees what.** Open paths: `GET /sign-in`, `POST /sign-in`, `GET /sign-in.css`
   and `GET /health`. A signed-out GET that accepts `text/html` gets a 303 to
   `/sign-in`; any other signed-out request gets 401. A signed-in person gets the
   prototype's build from `STATIC_DIR` at `/` (it uses a hash router and relative paths,
   so no fallback page is needed). `GET /sign-in` when signed in redirects to `/`.
9. **The sign-in POST**, in order: the `Origin` check, the limits (ruling 10), the
   password check, then a 303 to `/`. Every failure, unknown username and disabled
   account included, gives the same sentence, "That username and password do not
   match." An unknown username is checked against a dummy hash so timing does not reveal
   it. There is no `next` parameter, so the form cannot send anyone elsewhere.
10. **Failed sign-ins** are counted in memory, over a fixed 15-minute window, with the
    Portikus counter. Per username, unknown ones included: from the 4th failure each
    reply waits 1 second for each failure past 3, up to 5 seconds; from the 10th,
    sign-in is refused for the rest of the window. Per address, where one IPv6 /64 counts
    as one: slowed from the 20th and refused from the 50th, which leaves room for a
    computer lab behind one address. A refusal is 429 with `Retry-After` and a plain
    sentence. A success clears that username's count. The numbers are constants, not
    settings. The account command runs in its own process, so it cannot clear the
    server's counts; a reset password works once the window ends.
11. **Passwords** are scrypt hashes from Node's `crypto`, with N = 2^15, r = 8, p = 3,
    a 16-byte salt, a 32-byte hash and `maxmem` raised to fit. The stored string is
    `$scrypt$ln=15,r=8,p=3$<salt>$<hash>` in base64url, so it names its own settings and
    they can be raised later. Checking uses `timingSafeEqual`.
12. **Sign-out.** `POST /sign-out` deletes the session and clears the cookie, then sends
    a 303 to `/sign-in`. Nothing in the preview links to it, because the prototype cannot
    change; Epic 8's web app gets the button.
13. **The account command**, run on the server as `npm run account --workspace
    @diagramble/server -- <subcommand> <username>`:
    - `make <username>` makes an account and its password method;
    - `set-password <username>` replaces the hash and ends the account's sessions;
    - `disable <username>` sets `disabled_at` and ends its sessions;
    - `enable <username>` clears `disabled_at`.

    `make` and `set-password` generate a random password of 20 characters and print it
    once, and nothing else goes to standard output. With `--stdin` they read the password
    from standard input instead, refusing one shorter than 15 characters or longer than
    128. A password given as an argument is never accepted. Nobody can sign up from the
    web.
14. **The sign-in page** is HTML rendered by one function with an escaping helper, with
    no framework and no script, so it works without JavaScript. Its only other file is
    `/sign-in.css`; the logo is inline SVG. It follows `docs/mockups/STYLES.md` with
    system font stacks, has a dark theme through `prefers-color-scheme`, labelled fields,
    `autocomplete="username"` and `autocomplete="current-password"`, and its error
    message in an element with `role="alert"`.
15. **Data access.** Every query on accounts, sign-in methods and sessions is in
    `accounts/store.ts`; handlers never use Kysely directly. SPEC.md section 12 says
    the server reaches the database only through the project-store interface; the fold
    rewords it to say that of project data, with accounts going through their own
    store.
16. **Migrations** are files under `src/migrations/`, read in order by Kysely's
    `FileMigrationProvider`, so a later epic adds a file and edits no index. The server
    migrates to the latest on start-up.
17. **Tests against PostgreSQL** use the Portikus helper: one database per test file,
    made from `DATABASE_URL` and migrated, with a sweep that drops abandoned ones. It
    refuses to run without `DATABASE_URL` and prints how to start one. Locally:
    `docker run -d --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e
    POSTGRES_DB=diagramble_test postgres:18` and CI's URL. The fold adds this to
    WORKFLOW.md, "Local development".
18. **Docker.** A three-stage `Dockerfile`: the prototype stage runs `prototype/`'s own
    `npm ci` and `npm run build` with no file changed; the dependencies stage installs
    the root lockfile's production dependencies for the server workspace; the runtime
    stage is `node:26`-slim at an exact tag, runs as `USER node`, holds the server's
    source, the packages it imports and the prototype's `dist` at `/app/static`, sets
    `STATIC_DIR`, runs `node apps/server/src/main.ts` on Node's type stripping, and has
    a `HEALTHCHECK` on `/health`. `compose.yaml` adds `db` (PostgreSQL 18 at an exact
    tag, a named volume, a `pg_isready` check, no published port) and `app` (built from
    `.`, starting once `db` is healthy, `APP_ORIGIN` and `POSTGRES_PASSWORD` required
    from `.env`, `TRUST_PROXY_HOPS: 1`, the port published only on `127.0.0.1:3000`).
    `.dockerignore` keeps out `node_modules`, `dist`, `.git`, `sources`, `screenshots`,
    `coverage`, `.claude` and `.env`.
19. **The local proof of the exit** uses the existing Caddy on the author's machine
    (`foreman-trial-caddy-1`, `/home/todd/foreman-trial/Caddyfile`), which gets real
    certificates through Cloudflare DNS. A site block for `diagramble.thewhittakers.org`
    proxies to the Compose `app` service; that Caddy is connected to the Compose network
    and reloaded, and the foreman site is left as it is. The user adds the DNS record or
    a hosts line. Nothing about that proxy is committed. The proof, recorded in the epic
    pull request: signed out, any path shows the sign-in page; a wrong password gets the
    plain refusal; the right one shows the prototype; the cookie is `__Host-`, `Secure`
    and `HttpOnly`; a POST with another `Origin` gets 403.
20. **Docker base images** are not covered by Dependabot, and no Release 0 epic may edit
    `.github/dependabot.yml`, so an `enhancement` issue asks to add the Docker
    ecosystem.

## Layout of `apps/server/src`

| File | What it owns |
| --- | --- |
| `main.ts` | `start(env)`: read settings, connect, migrate, build the server, listen, close cleanly on SIGTERM; runs `start(process.env)` when run directly |
| `server.ts` | `buildServer({ db, settings })`: form bodies, cookies, the guard, the routes, the static files. Later epics add one `register` line each |
| `settings.ts` | Ruling 5 |
| `guard.ts` | The `onRequest` hook: headers, the `Origin` check, the session lookup, the open paths and the exempt list (rulings 6 to 8) |
| `health.ts` | `GET /health`: `select 1`, then 200 `ok` or 503 |
| `static.ts` | `@fastify/static` on `STATIC_DIR` |
| `db/connection.ts`, `db/migrate.ts`, `db/schema.ts`, `db/testing.ts` | Ported from Portikus `packages/db`. `schema.ts` exports `Database`, which later epics extend |
| `migrations/0001_accounts.ts` | Ruling 1 |
| `accounts/store.ts` | Ruling 15 |
| `accounts/password.ts` | Ruling 11, the dummy check of ruling 9, and the generated password of ruling 13 |
| `accounts/sign-in-limit.ts` | Ruling 10 |
| `accounts/sessions.ts` | Tokens, their hash, the cookie name and options, and making, loading and ending sessions (rulings 3 and 4) |
| `accounts/routes.ts` | `GET` and `POST /sign-in`, `POST /sign-out`, `GET /sign-in.css` |
| `accounts/sign-in-page.ts`, `accounts/sign-in.css` | Ruling 14 |
| `accounts/command.ts` | Ruling 13, as `run(args, deps, io)` returning an exit code |

## Contracts between tasks

These are settled here so tasks can run at once. A task that needs to change one stops
and reports.

- `db/schema.ts` (T1): `Database` with `accounts`, `sign_in_methods` and `sessions`
  typed for Kysely; `db/connection.ts` exports `createDb(databaseUrl)`;
  `db/migrate.ts` exports `migrateToLatest(db)`; `db/testing.ts` exports
  `createTestDb()` returning `{ db, drop }`.
- `accounts/store.ts` (T1), each taking `db` first: `createPasswordAccount(username,
  passwordHash)` returning `{ accountId, methodId }` and refusing a taken username;
  `findPasswordMethod(username)` returning `{ accountId, methodId, passwordHash,
  disabled }` or `undefined`; `setPasswordHash(methodId, hash)`;
  `setDisabled(accountId, disabled)`; `createSession({ id, accountId, methodId,
  expiresAt })`, which also deletes expired rows; `loadSession(id, now)` returning
  `{ accountId, methodId, login }` for a live session of an enabled account, else
  `undefined`; `deleteSession(id)`; `deleteSessionsFor(accountId)`.
- `accounts/password.ts` (T2): `hashPassword(password)`, `verifyPassword(password,
  stored)`, `verifyAgainstDummy(password)`, all async; `generatePassword()`;
  `normalizeUsername(raw)` returning the lowercased username or `undefined` when it
  breaks ruling 2.
- `accounts/sign-in-limit.ts` (T2): `createSignInLimiter({ now })` with
  `check(username, address)` returning `{ refused: false, delayMs }` or `{ refused: true,
  retryAfterSeconds }`, `recordFailure(username, address)` and
  `recordSuccess(username)`; and `addressKey(ip)`.
- `accounts/sign-in-page.ts` (T4): `renderSignInPage({ username?, message? })` returning
  the whole HTML document, and `signInCss`, the stylesheet as a string read from
  `sign-in.css`.
- Docker (T3): the server starts with `node apps/server/src/main.ts`, reads the five
  variables of ruling 5, and answers `GET /health`.

## Tasks

| Task | Owner and model | Files it may touch | Starts after | What done looks like |
| --- | --- | --- | --- | --- |
| T1 Database and store | builder, Sonnet, high effort | `apps/server/src/db/**`, `apps/server/src/migrations/**`, `apps/server/src/accounts/store.ts`, their tests | None | Rulings 1, 2, 15, 16, 17. Store tests against PostgreSQL: the unique key, the hash check, cascades, expired and disabled sessions refused, expired rows deleted |
| T2 Password and limits | builder, Sonnet, high effort | `apps/server/src/accounts/password.ts`, `apps/server/src/accounts/sign-in-limit.ts`, their tests | None | Rulings 2, 9, 10, 11. A hash round-trips, a wrong password and a changed salt fail; the limiter's thresholds, delay, refusal, window and IPv6 /64 tested with a fake clock |
| T3 Docker | builder, Sonnet, high effort | `Dockerfile`, `.dockerignore`, `compose.yaml`, `.gitignore` (one `.env` line) | None | Ruling 18. `docker build .` succeeds with no file in `prototype/` changed; the image runs as `node`; its size is reported |
| T4 Sign-in page | ui-designer, its pinned model | `apps/server/src/accounts/sign-in-page.ts`, `apps/server/src/accounts/sign-in.css`, its test | None | Ruling 14. Dark and light screenshots; the test checks escaping, labels and the alert |
| T5 Server and sign-in | builder, Opus, low effort | `apps/server/src/main.ts`, `server.ts`, `settings.ts`, `guard.ts`, `health.ts`, `static.ts`, `accounts/sessions.ts`, `accounts/routes.ts`, their tests | T1, T2, T4 | Rulings 3 to 9 and 12. Settings refuse each bad value; sign-in, sign-out and the open paths work through `inject` against PostgreSQL |
| T6 Account command | builder, Sonnet, high effort | `apps/server/src/accounts/command.ts`, its test, `apps/server/package.json`, and deleting `apps/server/src/index.ts` and its test | T1, T2 | Ruling 13. Each subcommand and each refusal tested; the password reaches standard output once and nowhere else |
| T7 Security tests | tester, Sonnet, high effort | `apps/server/src/security/*.test.ts` | T5, T6 | The four `Origin` cases of SPEC.md section 1, "Host names" (matching, another, `null`, missing) on every non-GET route, plus the other scheme, another port and a trailing slash; every path but the open ones refused when signed out; the cookie's attributes; limits end to end; a disabled account and an expired session refused |
| T8 Local proof | the main session | Nothing committed; the Caddyfile outside the repository | T3, T7 | Ruling 19, with screenshots, dark first, in the epic pull request |
| T9 Fold | the main session | `docs/STATUS.md`, `docs/SPEC.md` sections 1 and 12, WORKFLOW.md "Local development", CLAUDE.md's commands table, this file (deleted) | T8 and the review fixes | Rulings 1, 3 to 6, 10, 13 and 15 in the spec in a sentence or two each; the Epic 3 entry in STATUS.md; this plan deleted |

Machines, so that tasks run at once: T1 and then T5 on pve1-dev; T2 and then T6 on
Todd-Desktop-2; T3, T4 and T7 here. No task edits the root `package.json` or the
lockfile; nothing new is installed.

Waves, for reading only: T1, T2, T3 and T4; then T5 and T6; then T7; then the proof and
the fold.

## Review

The code reviewer and the security reviewer run over the epic head once T5 and T6 have
landed, and make a short pass over the rest when T7 lands. The accessibility reviewer
reviews the sign-in page once T4 lands.

## Left out on purpose

- Roles and display names: they come with Epic 4 and R1-l, as a cheap new migration.
- Where a launch's course is kept: Epic 4's to design.
- A partitioned cookie for Canvas's frame: Epic 4 decides.
- Counts stored in PostgreSQL: one process per deployment does not need them.
- Re-hashing when the scrypt settings rise: the stored string already allows it.
- A change-password page, second factors, the break-glass password and the files host:
  R1-l and R2-e.
- `_FILE` secrets and a log-level setting: nothing asks for them.
