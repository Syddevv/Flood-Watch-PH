/**
 * A deployment is missing or malformed configuration.
 *
 * Distinct from a runtime outage on purpose. An outage is temporary and worth
 * retrying; a missing environment variable is permanent until somebody fixes
 * the deployment, and telling a user to "check your connection" sends them
 * looking in the wrong place. Callers should surface these as a server error
 * and log loudly enough that the actual variable name is discoverable.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}
