// What the tool's server and its tests use: the platform's signer and key set, the claim
// builder, `signLaunch`, the defect list, and the seed people and courses.
export {
  CLIENT_ID,
  COURSES,
  type Course,
  DEPLOYMENT_ID,
  PEOPLE,
  type Person,
  UNFILLED_LOGIN_ID,
} from "./seed.ts";
export { createSigner, DEFECTS, type Defect, LTI_CLAIM, launchClaims, type Signer, signLaunch } from "./token.ts";
