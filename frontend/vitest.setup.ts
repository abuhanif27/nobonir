import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Extend matchers if needed
afterEach(() => {
  cleanup();
});
