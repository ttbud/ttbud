/**
 * Throw an error if the provided environment variable name is not set to a value
 *
 * @returns string
 */
function requireEnv(envVarName) {
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`Environment variable ${envVarName} must be specified`);
  }

  return value;
}

module.exports = {
  domain: requireEnv("DOMAIN"),
  apiDomain: requireEnv("API_DOMAIN"),
  ci: process.env["CI"] === "true",
  debugMode: process.env["DEBUG"] === "true",
};
