import config from "./tests/config";
import WebSocket from "ws";

const MAX_WAIT_TIME_MS = 600_000;
const TEST_ROOM_ID = "1292b25e-ffbf-4b77-b5e4-df854b81487b";

export default async function globalSetup() {
  await waitForBackend();
}

export async function waitForBackend() {
  const startTimeMs = Date.now();
  let success = false;
  let error = null;
  while (!success && Date.now() - startTimeMs < MAX_WAIT_TIME_MS) {
    const websocket = new WebSocket(`${config.apiDomain}/${TEST_ROOM_ID}`);

    const connection = new Promise<void>((resolve, reject) => {
      websocket.onopen = () => resolve();
      websocket.onerror = (e) => reject(e);
    });

    try {
      await connection;
      websocket.close();
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
