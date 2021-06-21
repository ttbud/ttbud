/**
 * Throw an error if the provided environment variable name is not set to a value
 */
function requireEnv(envVarName: string): string {
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`Environment variable ${envVarName} must be specified`);
  }

  return value;
}

const config = {
  domain: requireEnv("DOMAIN"),
  apiDomain: requireEnv("API_DOMAIN"),
  ignoreHTTPSErrors: process.env["IGNORE_CERT_ERRORS"] === "true",
  ci: process.env["CI"] === "true",
  debugMode: process.env["DEBUG"] === "true",
};

export default config;
