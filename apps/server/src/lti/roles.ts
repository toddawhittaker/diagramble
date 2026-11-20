import type { CourseRole } from "../db/schema.ts";

const LIS = "http://purl.imsglobal.org/vocab/lis/v2/";

/** Context (membership) roles that make someone teaching staff; a course administrator counts. */
const STAFF = new Set(["Instructor", "TeachingAssistant", "ContentDeveloper", "Administrator"]);

/** Principal roles whose sub-roles are still staff, e.g. `membership/Instructor#TeachingAssistant`. */
const STAFF_PRINCIPALS = new Set(["Instructor", "ContentDeveloper"]);

/** Bare short forms, which LTI 1.3 reads as context roles. */
const SHORT_FORMS = new Set(["Instructor", "TeachingAssistant", "ContentDeveloper"]);

function isInstructorRole(role: string): boolean {
  if (SHORT_FORMS.has(role)) return true;
  if (!role.startsWith(LIS)) return false;
  const rest = role.slice(LIS.length);
  if (rest.startsWith("membership#")) return STAFF.has(rest.slice("membership#".length));
  if (rest.startsWith("membership/")) {
    const principal = rest.slice("membership/".length).split("#")[0] ?? "";
    return STAFF_PRINCIPALS.has(principal);
  }
  // An institution-wide Instructor role says nothing about this course; administrators do run it.
  return rest === "institution/person#Administrator" || rest === "system/person#Administrator";
}

/**
 * The course role an LTI roles claim grants: `instructor` for any instructor,
 * teaching assistant, content developer or administrator role of the context or
 * the institution, and `student` for everything else, including a malformed claim.
 */
export function mapLtiRoles(roles: unknown): CourseRole {
  if (!Array.isArray(roles)) return "student";
  for (const role of roles) {
    if (typeof role === "string" && isInstructorRole(role)) return "instructor";
  }
  return "student";
}
