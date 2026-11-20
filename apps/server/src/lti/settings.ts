// The LTI settings of SPEC.md section 1, "Canvas launch": seven variables, set all
// together or not at all.

import { createPrivateKey } from "node:crypto";
import { z } from "zod";

export interface LtiSettings {
  issuer: string;
  clientId: string;
  deploymentId: string;
  authUrl: string;
  keysUrl: string;
  /** Origins allowed to frame the app. */
  frameOrigins: string[];
  /** The tool's RSA private key, in PEM. */
  toolKey: string;
}

/** An address is https unless its host is local: `localhost`, `*.localhost`, or a single-label name. */
function isLocalHost(hostname: string): boolean {
  if (hostname.startsWith("[")) return false;
  return hostname === "localhost" || hostname.endsWith(".localhost") || !hostname.includes(".");
}

function isAddress(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLocalHost(url.hostname);
}

function isOrigin(value: string): boolean {
  return isAddress(value) && new URL(value).origin === value;
}

function frameOrigins(value: string): string[] {
  return value.trim().split(/\s+/);
}

function isRsaKeyOfAtLeast2048Bits(pem: string): boolean {
  try {
    const key = createPrivateKey(pem);
    return key.asymmetricKeyType === "rsa" && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048;
  } catch {
    return false;
  }
}

const present = z.string().min(1);

export const ltiSettingsSchema = z.object({
  LTI_ISSUER: present,
  LTI_CLIENT_ID: present,
  LTI_DEPLOYMENT_ID: present,
  LTI_AUTH_URL: z.string().refine(isAddress),
  LTI_KEYS_URL: z.string().refine(isAddress),
  LTI_FRAME_ORIGINS: z.string().refine((v) => v.trim() !== "" && frameOrigins(v).every(isOrigin)),
  LTI_TOOL_KEY: z.string().refine(isRsaKeyOfAtLeast2048Bits),
});

type LtiVariable = keyof z.input<typeof ltiSettingsSchema>;

const VARIABLES = Object.keys(ltiSettingsSchema.shape) as LtiVariable[];

const ADDRESS = "an address that is https unless its host is localhost, ends in .localhost, or is a single name";

/** What each variable must be, said when it is not. */
const rules: Record<LtiVariable, string> = {
  LTI_ISSUER: "must be the platform's issuer, exactly as it sends it",
  LTI_CLIENT_ID: "must be the tool's client ID at the platform",
  LTI_DEPLOYMENT_ID: "must be the platform's deployment ID",
  LTI_AUTH_URL: `must be the platform's authorization endpoint, ${ADDRESS}`,
  LTI_KEYS_URL: `must be the platform's public key set, ${ADDRESS}`,
  LTI_FRAME_ORIGINS:
    "must be one or more origins separated by spaces, such as https://canvas.example.edu, with no path, and https unless the host is local",
  LTI_TOOL_KEY: "must be an RSA private key in PEM form of at least 2048 bits",
};

/**
 * The LTI settings from `env`, or `null` when none of the seven variables is set
 * (an empty value counts as not set). Throws one sentence naming the missing
 * variables when only some are set, or the first bad one.
 */
export function readLtiSettings(env: Record<string, string | undefined>): LtiSettings | null {
  const missing = VARIABLES.filter((name) => !env[name]);
  if (missing.length === VARIABLES.length) return null;
  if (missing.length > 0) {
    throw new Error(
      `The LTI settings are set all together or not at all, and ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.`,
    );
  }
  const result = ltiSettingsSchema.safeParse(env);
  if (!result.success) {
    const name = result.error.issues[0]?.path[0] as LtiVariable;
    throw new Error(`The setting ${name} ${rules[name]}.`);
  }
  const s = result.data;
  return {
    issuer: s.LTI_ISSUER,
    clientId: s.LTI_CLIENT_ID,
    deploymentId: s.LTI_DEPLOYMENT_ID,
    authUrl: s.LTI_AUTH_URL,
    keysUrl: s.LTI_KEYS_URL,
    frameOrigins: frameOrigins(s.LTI_FRAME_ORIGINS),
    toolKey: s.LTI_TOOL_KEY,
  };
}
