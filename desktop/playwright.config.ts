import { defineConfig } from "@playwright/test";

// The Windows app's smoke suite, run against the packaged app in
// dist-desktop/release/ that `pnpm run package:desktop` builds. CI runs it
// before publishing a release, because a release installs itself on every copy.
export default defineConfig({
  testDir: ".",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    trace: "retain-on-failure"
  }
});
