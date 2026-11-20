import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { parseArgs } from "node:util";
import { CLIENT_ID, DEPLOYMENT_ID } from "./seed.ts";
import { createHandler } from "./server.ts";
import { createSigner } from "./token.ts";

export interface Options {
  host: string;
  port: number;
  /** The platform's `iss`, and where the browser reaches this mock. */
  publicUrl: string;
  /** Where the browser reaches the tool. */
  toolUrl: string;
  /** Where the tool's server fetches the key set; it may differ from the public address inside a container network. */
  keysUrl: string;
}

export const USAGE =
  "Usage: node src/main.ts --tool-url <tool address> [--public-url <this mock's address>] [--keys-url <key set address>] [--port 4000] [--host 127.0.0.1]";

function httpUrl(value: string, flag: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${flag} must be a URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${flag} must be an http or https URL`);
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export function parseOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      "public-url": { type: "string" },
      "tool-url": { type: "string" },
      "keys-url": { type: "string" },
      port: { type: "string" },
      host: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const port = values.port === undefined ? 4000 : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("--port must be 0 to 65535");
  if (values["tool-url"] === undefined) throw new Error("--tool-url is required");
  const publicUrl = httpUrl(values["public-url"] ?? `http://localhost:${port}`, "--public-url");
  return {
    host: values.host ?? "127.0.0.1",
    port,
    publicUrl,
    toolUrl: httpUrl(values["tool-url"], "--tool-url"),
    keysUrl: httpUrl(values["keys-url"] ?? `${publicUrl}/jwks`, "--keys-url"),
  };
}

/** The `LTI_*` lines the tool's server needs to trust this mock. */
export function settingsLines(options: Options): string[] {
  return [
    `LTI_ISSUER=${options.publicUrl}`,
    `LTI_CLIENT_ID=${CLIENT_ID}`,
    `LTI_DEPLOYMENT_ID=${DEPLOYMENT_ID}`,
    `LTI_AUTH_URL=${options.publicUrl}/authorize`,
    `LTI_KEYS_URL=${options.keysUrl}`,
    `LTI_FRAME_ORIGINS=${new URL(options.publicUrl).origin}`,
    "LTI_TOOL_KEY=<make a key with: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048, and paste its PEM>",
  ];
}

export async function start(argv: string[], out: (line: string) => void = console.log): Promise<Server> {
  const options = parseOptions(argv);
  const handler = createHandler({
    issuer: options.publicUrl,
    toolUrl: options.toolUrl,
    signer: await createSigner(),
    log: out,
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, resolve);
  });
  out(`mock LTI platform listening on ${options.host}:${(server.address() as AddressInfo).port}`);
  out(`open ${options.publicUrl}/ to start a launch`);
  out("Settings for the tool's server:");
  for (const line of settingsLines(options)) out(line);
  return server;
}

if (import.meta.main) {
  try {
    const server = await start(process.argv.slice(2));
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : error}\n${USAGE}`);
    process.exitCode = 2;
  }
}
