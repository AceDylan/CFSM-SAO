import { expect, test } from "vitest";

// Temporary, explicitly authorized release E2E: CI must fail before artifact publication.
test("intentional automatic-release failure canary", () => {
  expect(false).toBe(true);
});
