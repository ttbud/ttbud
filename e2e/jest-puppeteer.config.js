module.exports = {
  launch: {
    dumpio: true,
    headless: process.env.HEADLESS !== "false",
    ignoreHTTPSErrors: true,
  },
  browser: "chromium",
  browserContext: "default",
};
