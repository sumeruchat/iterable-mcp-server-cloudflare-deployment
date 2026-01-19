/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // Iterable API key (optional) - users provide their own via query param or header
  ITERABLE_API_KEY?: string;

  // Iterable API base URL (optional, defaults to US region)
  ITERABLE_API_BASE_URL?: string;

  // Permission flags (default: all false for safety)
  ITERABLE_USER_PII: string;
  ITERABLE_ENABLE_WRITES: string;
  ITERABLE_ENABLE_SENDS: string;

  // Durable Object binding for MCP sessions (required by McpAgent SDK)
  MCP_OBJECT: DurableObjectNamespace;
}

/**
 * Configuration parsed from environment
 */
export interface McpServerConfig {
  allowUserPii: boolean;
  allowWrites: boolean;
  allowSends: boolean;
}

/**
 * Parse environment variables into typed config
 */
export function parseConfig(env: Env): McpServerConfig {
  return {
    allowUserPii: env.ITERABLE_USER_PII === "true",
    allowWrites: env.ITERABLE_ENABLE_WRITES === "true",
    allowSends: env.ITERABLE_ENABLE_SENDS === "true",
  };
}
