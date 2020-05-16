const args =
  process.env.IN_DOCKER !== "true"
    ? []
    : [
        // Disabling the sandbox is required in the circleci docker environment
        // This is scary but okay because we're only ever navigating to content
        // on our website, which we trust
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // This will write shared memory files into /tmp instead of /dev/shm,
        // because Docker’s default for /dev/shm is 64MB
        "--disable-dev-shm-usage",
      ];

module.exports = {
  launch: {
    dumpio: true,
    headless: process.env.HEADLESS !== "false",
    ignoreHTTPSErrors: true,
    args,
  },
  browser: "chromium",
  browserContext: "default",
};
