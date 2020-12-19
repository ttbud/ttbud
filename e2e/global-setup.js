const { setup: setupPuppeteer } = require("jest-environment-puppeteer");
const config = require("./config");
const WebSocket = require("ws");

const MAX_WAIT_TIME_MS = 600_000;

module.exports = async (globalConfig) => {
  await setupPuppeteer(globalConfig);
  await waitForBackend();
};

async function waitForBackend() {
  const startTimeMs = Date.now();
  let success = false;
  let error = null;
  while (!success && Date.now() - startTimeMs < MAX_WAIT_TIME_MS) {
    const websocket = new WebSocket(config.apiDomain);

    const connection = new Promise((resolve, reject) => {
      websocket.onopen = () => resolve();
      websocket.onerror = (e) => reject(e);
    });

    try {
      await connection;
      success = true;
    } catch (e) {
      // Record the error, but try again until we run out of time or succeed
      error = e;
    }
  }

  if (!success) {
    console.error(error);
    throw Error("Unable to reach API Server");
  }
}
