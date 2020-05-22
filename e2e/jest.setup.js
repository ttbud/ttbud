const config = require("./config");

const THIRTY_SECONDS_MS = 30_000;
const ONE_DAY_MS = 8_670_000_000;

jest.setTimeout(config.debugMode ? ONE_DAY_MS : THIRTY_SECONDS_MS);
