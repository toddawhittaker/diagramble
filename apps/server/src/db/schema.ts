import type { ColumnType, Generated } from "kysely";

/** A timestamptz column: read as a Date, written as a Date or an ISO string. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;
/** A timestamptz with a database default: optional on insert. */
type TimestampDefault = ColumnType<Date, Date | string | undefined, Date | string>;

/** A person's account. The login is set once and is not a sign-in name (SPEC.md section 3.9). */
export interface AccountsTable {
  id: Generated<string>;
  login: string;
  disabled_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: TimestampDefault;
}

/** One way an account signs in. The `lti` kind joins the `password` kind with the course launch. */
export interface SignInMethodsTable {
  id: Generated<string>;
  account_id: string;
  kind: "password";
  issuer: string;
  subject: string;
  password_hash: string | null;
  created_at: TimestampDefault;
}

/** A signed-in browser. `id` is the SHA-256 hash of the cookie's token, in hex. */
export interface SessionsTable {
  id: string;
  account_id: string;
  method_id: string;
  created_at: TimestampDefault;
  expires_at: Timestamp;
}

/** Every table the server owns. Later epics add theirs here. */
export interface Database {
  accounts: AccountsTable;
  sign_in_methods: SignInMethodsTable;
  sessions: SessionsTable;
}
