import { PlaywrightTestConfig } from "@playwright/test";
import config from "./tests/config";

const playwrightConfig: PlaywrightTestConfig = {
  globalSetup: require.resolve("./global-setup"),
  timeout: 10000,
  use: {
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "Chromium",
      use: { browserName: "chromium" },
    },
    {
      name: "Firefox",
      use: { browserName: "firefox" },
    },
  ],
};
export default playwrightConfig;
