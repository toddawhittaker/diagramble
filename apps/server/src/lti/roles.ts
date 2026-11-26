import type { CourseRole } from "../db/schema.ts";

const LIS = "http://purl.imsglobal.org/vocab/lis/v2/";

/**
 * The context (membership) roles that make someone teaching staff; a course administrator
 * counts. One list serves the bare short forms (which LTI 1.3 reads as context roles), the
 * `membership#` URIs, and the principals whose sub-roles are still staff, such as
 * `membership/Instructor#TeachingAssistant` or `membership/TeachingAssistant#Grader`.
 */
const STAFF = new Set(["Instructor", "TeachingAssistant", "ContentDeveloper", "Administrator"]);

function isInstructorRole(role: string): boolean {
  if (STAFF.has(role)) return true;
  if (!role.startsWith(LIS)) return false;
  const rest = role.slice(LIS.length);
  if (rest.startsWith("membership#")) return STAFF.has(rest.slice("membership#".length));
  if (rest.startsWith("membership/")) {
    const principal = rest.slice("membership/".length).split("#")[0] ?? "";
    return STAFF.has(principal);
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
