import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTheme, resolveTheme } from "../src/lib/theme-core.ts";

test("resolveTheme: explicit choices win, system follows the device", () => {
  assert.equal(resolveTheme("light", true), "light"); // forced light even on a dark device
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("parseTheme: only the three known values are accepted", () => {
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("system"), "system");
  assert.equal(parseTheme("light"), "light");
  for (const bad of ["Dark", "auto", "", null, undefined, 1, {}]) assert.equal(parseTheme(bad), null);
});
