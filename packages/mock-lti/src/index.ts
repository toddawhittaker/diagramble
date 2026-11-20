export { createHandler, type MockPlatformOptions } from "./server.ts";
export {
  CLIENT_ID,
  COURSES,
  type Course,
  DEPLOYMENT_ID,
  findCourse,
  findPerson,
  PEOPLE,
  type Person,
  ROLE_NAMES,
  ROLE_URIS,
  type RoleName,
  UNFILLED_LOGIN_ID,
} from "./seed.ts";
export {
  CUSTOM_CLAIM,
  createSigner,
  DEFECTS,
  type Defect,
  isDefect,
  LTI_CLAIM,
  type LaunchClaimsInput,
  launchClaims,
  type Signer,
  signLaunch,
} from "./token.ts";
