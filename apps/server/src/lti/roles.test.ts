import { describe, expect, test } from "vitest";
import { mapLtiRoles } from "./roles.ts";

const LIS = "http://purl.imsglobal.org/vocab/lis/v2/";

describe("mapLtiRoles", () => {
  test.each([
    [[`${LIS}membership#Instructor`], "instructor"],
    [[`${LIS}membership#TeachingAssistant`], "instructor"],
    [[`${LIS}membership/Instructor#TeachingAssistant`], "instructor"],
    [[`${LIS}membership#ContentDeveloper`], "instructor"],
    [[`${LIS}membership/ContentDeveloper#ExternalDeveloper`], "instructor"],
    [[`${LIS}membership#Administrator`], "instructor"],
    [[`${LIS}institution/person#Administrator`], "instructor"],
    [[`${LIS}system/person#Administrator`], "instructor"],
    [["Instructor"], "instructor"],
    [["TeachingAssistant"], "instructor"],
    [["ContentDeveloper"], "instructor"],
    [[`${LIS}institution/person#Student`, `${LIS}membership#Instructor`], "instructor"],
    [[`${LIS}institution/person#Instructor`], "student"],
    [[`${LIS}membership/Learner#Instructor`], "student"],
    [[`${LIS}membership/Mentor#TeachingAssistant`], "student"],
    [[`${LIS}institution/person#Instructor`, `${LIS}membership#Learner`], "student"],
    [["Administrator"], "student"],
    [["http://example.com/vocab#Instructor"], "student"],
    [[`${LIS}membership#Learner`], "student"],
    [["Learner"], "student"],
    [[`${LIS}membership#Mentor`], "student"],
    [[`${LIS}system/person#SysAdmin`], "student"],
    [[], "student"],
    [[42, null], "student"],
    [undefined, "student"],
    [null, "student"],
    ["Instructor", "student"],
  ])("%j maps to %s", (roles, expected) => {
    expect(mapLtiRoles(roles)).toBe(expected);
  });
});
