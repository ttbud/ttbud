import { assert } from "./invariants";

function requireEnv(envVarName: string): string {
  const value = process.env[envVarName];
  assert(value, `Environment variable ${envVarName} must be specified`);

  return value;
}

export default {
  domain: requireEnv("DOMAIN"),
};
