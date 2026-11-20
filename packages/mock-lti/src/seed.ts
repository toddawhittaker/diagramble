// Fixed people and courses. The `sub` values never change, so a repeated launch finds the same person.

export const CLIENT_ID = "diagramble-mock";
export const DEPLOYMENT_ID = "mock-deployment-1";

/** What Canvas sends for a custom field it could not fill in. */
export const UNFILLED_LOGIN_ID = "$Canvas.user.loginId";

export const ROLE_URIS = {
  Instructor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  TeachingAssistant: "http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant",
  Learner: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
  Administrator: "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
} as const;

export type RoleName = keyof typeof ROLE_URIS;
export const ROLE_NAMES = Object.keys(ROLE_URIS) as RoleName[];

export interface Person {
  key: string;
  sub: string;
  givenName: string;
  familyName: string;
  email: string;
  role: RoleName;
  /** The custom claim `login_id`: a login name, the empty string for a person with none, or `UNFILLED_LOGIN_ID`. */
  loginId: string;
}

export interface Course {
  key: string;
  id: string;
  label: string;
  title: string;
}

export const PEOPLE: readonly Person[] = [
  {
    key: "ivy",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2001",
    givenName: "Ivy",
    familyName: "Instructor",
    email: "ivy@mock-lti.test",
    role: "Instructor",
    loginId: "ivy.instructor",
  },
  {
    key: "tom",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2002",
    givenName: "Tom",
    familyName: "Assistant",
    email: "tom@mock-lti.test",
    role: "TeachingAssistant",
    loginId: "tom.assistant",
  },
  {
    key: "sam",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2003",
    givenName: "Sam",
    familyName: "Student",
    email: "sam@mock-lti.test",
    role: "Learner",
    loginId: "sam.student",
  },
  {
    key: "lee",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2004",
    givenName: "Lee",
    familyName: "Learner",
    email: "lee@mock-lti.test",
    role: "Learner",
    loginId: UNFILLED_LOGIN_ID,
  },
  {
    key: "una",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2005",
    givenName: "Una",
    familyName: "Unnamed",
    email: "una@mock-lti.test",
    role: "Learner",
    loginId: "",
  },
  {
    key: "ada",
    sub: "6a3b2f10-7c1d-4e55-8a21-0d4c9e7b2006",
    givenName: "Ada",
    familyName: "Admin",
    email: "ada@mock-lti.test",
    role: "Administrator",
    loginId: "ada.admin",
  },
];

export const COURSES: readonly Course[] = [
  { key: "is301", id: "mock-course-is301", label: "IS 301", title: "IS 301 Systems Analysis" },
  { key: "is420", id: "mock-course-is420", label: "IS 420", title: "IS 420 Database Design" },
];

/** The people on each course's roster, by course key. A roster is every seed person who can launch into the course. */
export const ROSTERS: Record<string, readonly string[]> = {
  is301: ["ivy", "tom", "sam", "lee", "una", "ada"],
  is420: ["ivy", "tom", "sam"],
};

export function findPerson(key: string): Person | undefined {
  return PEOPLE.find((p) => p.key === key);
}

export function findCourse(key: string): Course | undefined {
  return COURSES.find((c) => c.key === key);
}

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as string[]).includes(value);
}
