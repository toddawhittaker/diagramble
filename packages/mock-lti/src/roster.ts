import { COURSES, findPerson, ROLE_URIS, ROSTERS } from "./seed.ts";

export const NRPS_CLAIM = "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice";
export const NRPS_SCOPE = "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";
export const NRPS_MEDIA_TYPE = "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";

// Small, so a client that ignores the `next` link shows up at once.
const DEFAULT_PAGE_SIZE = 3;
const MAX_PAGE_SIZE = 100;

export function membershipsUrl(issuer: string, courseId: string): string {
  return `${issuer}/nrps/${courseId}/memberships`;
}

/** One page of a course's class list and the next page's address, or undefined for an unknown course. */
export function rosterPage(issuer: string, courseId: string, pageParam: string | null, limitParam: string | null) {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return undefined;
  const people = (ROSTERS[course.key] ?? []).flatMap((key) => findPerson(key) ?? []);
  const limit = Math.min(Math.max(Number.parseInt(limitParam ?? "", 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const pageNumber = Math.max(Number.parseInt(pageParam ?? "", 10) || 1, 1);
  const base = membershipsUrl(issuer, course.id);
  return {
    next: pageNumber * limit < people.length ? `${base}?page=${pageNumber + 1}&limit=${limit}` : undefined,
    body: {
      id: base,
      context: { id: course.id, label: course.label, title: course.title },
      // No email: a roster service shares less than a launch does.
      members: people.slice((pageNumber - 1) * limit, pageNumber * limit).map((person) => ({
        status: "Active",
        user_id: person.sub,
        name: `${person.givenName} ${person.familyName}`,
        given_name: person.givenName,
        family_name: person.familyName,
        roles: [ROLE_URIS[person.role]],
      })),
    },
  };
}
