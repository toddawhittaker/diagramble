import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { parseOptions, settingsLines, start } from "./main.ts";

let running: Server | undefined;
afterEach(async () => {
  const server = running;
  running = undefined;
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe("the flags", () => {
  it("defaults the public address, the key set address, the port and the host", () => {
    expect(parseOptions(["--tool-url", "http://tool.test/"])).toEqual({
      host: "127.0.0.1",
      port: 4000,
      publicUrl: "http://localhost:4000",
      toolUrl: "http://tool.test",
      keysUrl: "http://localhost:4000/jwks",
    });
  });

  it("takes every flag and drops a trailing slash", () => {
    expect(
      parseOptions([
        "--tool-url",
        "https://tool.test/",
        "--public-url",
        "http://localhost:4100/",
        "--keys-url",
        "http://mock-lti:4000/jwks",
        "--port",
        "4100",
        "--host",
        "0.0.0.0",
      ]),
    ).toEqual({
      host: "0.0.0.0",
      port: 4100,
      publicUrl: "http://localhost:4100",
      toolUrl: "https://tool.test",
      keysUrl: "http://mock-lti:4000/jwks",
    });
  });

  it("follows the public address for the default key set address", () => {
    expect(parseOptions(["--tool-url", "http://t.test", "--public-url", "https://mock.test"]).keysUrl).toBe(
      "https://mock.test/jwks",
    );
  });

  it.each([
    [[], /--tool-url is required/],
    [["--tool-url", "nope"], /--tool-url must be a URL/],
    [["--tool-url", "ftp://x.test"], /--tool-url must be an http or https URL/],
    [["--tool-url", "http://t.test", "--public-url", "x"], /--public-url must be a URL/],
    [["--tool-url", "http://t.test", "--keys-url", "x"], /--keys-url must be a URL/],
    [["--tool-url", "http://t.test", "--port", "70000"], /--port must be/],
    [["--tool-url", "http://t.test", "--port", "abc"], /--port must be/],
    [["--tool-url", "http://t.test", "--bogus", "1"], /bogus/],
  ])("refuses %j", (argv, message) => {
    expect(() => parseOptions(argv)).toThrow(message);
  });
});

describe("the settings lines", () => {
  it("prints the seven LTI settings, with a placeholder note for the tool's key", () => {
    const lines = settingsLines(
      parseOptions(["--tool-url", "http://tool.test", "--public-url", "http://localhost:4000", "--keys-url", "http://mock-lti:4000/jwks"]),
    );
    expect(lines).toHaveLength(7);
    expect(lines.slice(0, 6)).toEqual([
      "LTI_ISSUER=http://localhost:4000",
      "LTI_CLIENT_ID=diagramble-mock",
      "LTI_DEPLOYMENT_ID=mock-deployment-1",
      "LTI_AUTH_URL=http://localhost:4000/authorize",
      "LTI_KEYS_URL=http://mock-lti:4000/jwks",
      "LTI_FRAME_ORIGINS=http://localhost:4000",
    ]);
    expect(lines[6]).toMatch(/^LTI_TOOL_KEY=.*openssl genpkey/);
  });
});

describe("starting the server", () => {
  it("listens, prints the settings and serves the launch page and the key set", async () => {
    const out: string[] = [];
    running = await start(
      ["--tool-url", "http://tool.test", "--port", "0", "--public-url", "http://localhost:4000"],
      (line) => out.push(line),
    );
    const port = (running.address() as AddressInfo).port;
    expect(out.join("\n")).toMatch(/listening on 127\.0\.0\.1:\d+/);
    expect(out).toContain(
      "roster service token endpoint: http://localhost:4000/token (informational; the tool's server has no setting for it)",
    );
    for (const name of ["LTI_ISSUER", "LTI_CLIENT_ID", "LTI_DEPLOYMENT_ID", "LTI_AUTH_URL", "LTI_KEYS_URL", "LTI_FRAME_ORIGINS", "LTI_TOOL_KEY"]) {
      expect(out.some((line) => line.startsWith(`${name}=`))).toBe(true);
    }
    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200);
    const keys = (await (await fetch(`http://127.0.0.1:${port}/jwks`)).json()) as { keys: unknown[] };
    expect(keys.keys).toHaveLength(1);
  });

  it("rejects when the port is taken", async () => {
    running = await start(["--tool-url", "http://tool.test", "--port", "0"], () => {});
    const port = (running.address() as AddressInfo).port;
    await expect(start(["--tool-url", "http://tool.test", "--port", String(port)], () => {})).rejects.toThrow(/EADDRINUSE/);
  });

  it("rejects bad flags before it listens", async () => {
    await expect(start([], () => {})).rejects.toThrow(/--tool-url is required/);
  });
});
