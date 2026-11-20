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
  kind: "password" | "lti";
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

/** A login's state, kept by the SHA-256 hash of the state; the launch that returns it consumes the row. */
export interface LtiLoginStatesTable {
  state_hash: string;
  nonce: string;
  expires_at: Timestamp;
  created_at: TimestampDefault;
}

/** A course on a platform: `context_id` is the platform's own ID for it, unique per issuer. */
export interface CoursesTable {
  id: Generated<string>;
  issuer: string;
  context_id: string;
  title: string;
  created_at: TimestampDefault;
  updated_at: TimestampDefault;
}

/** What a person is in a course; every launch refreshes the role and `last_launch_at`. */
export type CourseRole = "student" | "instructor";

export interface CourseMembersTable {
  course_id: string;
  account_id: string;
  role: CourseRole;
  first_launch_at: TimestampDefault;
  last_launch_at: TimestampDefault;
}

/** Every table the server owns. Later epics add theirs here. */
export interface Database {
  accounts: AccountsTable;
  sign_in_methods: SignInMethodsTable;
  sessions: SessionsTable;
  lti_login_states: LtiLoginStatesTable;
  courses: CoursesTable;
  course_members: CourseMembersTable;
}
