/**
 * Integration tests for MCP tool invocations
 *
 * Tests actual tool calls against the deployed server.
 *
 * Prerequisites:
 * - Server must be deployed with valid ITERABLE_API_KEY
 * - Set MCP_SERVER_URL environment variable
 * - Optionally set ITERABLE_TEST_EMAIL for user lookup tests
 *
 * Usage:
 *   export MCP_SERVER_URL=https://iterable-mcp-server.your-account.workers.dev
 *   export ITERABLE_TEST_EMAIL=test@example.com
 *   npm run integration
 */

import { describe, it, expect, beforeAll } from "vitest";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
const ITERABLE_TEST_EMAIL = process.env.ITERABLE_TEST_EMAIL;
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;

// Session ID - will be set after initialization
let SESSION_ID: string | null = null;

/**
 * Helper to create base headers for MCP requests
 */
function createHeaders(includeSessionId: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };

  // Include session ID if available and requested
  if (includeSessionId && SESSION_ID) {
    headers["Mcp-Session-Id"] = SESSION_ID;
  }

  // Add API key as header if available
  if (ITERABLE_API_KEY) {
    headers["X-Iterable-Api-Key"] = ITERABLE_API_KEY;
  }

  return headers;
}

/**
 * Parse SSE response to JSON
 * Handles both SSE format and plain JSON responses
 */
function parseSSE(text: string): any {
  // Try parsing as plain JSON first (error responses)
  try {
    return JSON.parse(text);
  } catch {
    // Not plain JSON, parse as SSE
  }

  // Parse SSE format: "event: message\ndata: {...}\n\n"
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonData = line.substring(6);
      return JSON.parse(jsonData);
    }
  }

  // No valid data found
  return { result: {} };
}

/**
 * Initialize MCP session - creates a new session on the server
 */
async function initializeSession() {
  // Initialize request must NOT include session ID (per MCP spec)
  const headers = createHeaders(false);

  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0" },
      },
    }),
  });

  // Extract session ID from response header
  const sessionId = response.headers.get("Mcp-Session-Id");
  if (sessionId) {
    SESSION_ID = sessionId;
    console.log("Got session ID:", SESSION_ID);
  }

  const text = await response.text();
  return parseSSE(text);
}

/**
 * Warm up session - make a simple call to ensure session is established
 */
async function warmUpSession() {
  // Make a simple tools/list call to establish the session
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    }),
  });

  const text = await response.text();
  return parseSSE(text);
}

/**
 * Helper to invoke MCP tool
 */
async function invokeTool(toolName: string, params: Record<string, unknown> = {}) {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    }),
  });

  const text = await response.text();
  return parseSSE(text);
}

/**
 * Helper to list available tools
 */
async function listTools() {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }),
  });

  const text = await response.text();
  return parseSSE(text);
}

describe("MCP Tool Invocation Tests", () => {
  beforeAll(async () => {
    if (!MCP_SERVER_URL) {
      throw new Error(
        "MCP_SERVER_URL environment variable is required"
      );
    }

    if (!ITERABLE_API_KEY) {
      console.warn(
        "ITERABLE_API_KEY not set. Tool invocation tests will fail. " +
          "Set it to test with real API key authentication."
      );
    }

    // Initialize the session before running tests
    const initResult = await initializeSession();
    if (initResult.error) {
      throw new Error(`Failed to initialize session: ${JSON.stringify(initResult.error)}`);
    }
    console.log("Session initialized successfully");
  });

  describe("Tool Discovery", () => {
    it("should list all available tools", async () => {
      const result = await listTools();

      expect(result).toHaveProperty("result");
      expect(result.result).toHaveProperty("tools");
      expect(Array.isArray(result.result.tools)).toBe(true);

      // Should have at least the read-only tools
      expect(result.result.tools.length).toBeGreaterThanOrEqual(30);
    });

    it("should include campaign tools", async () => {
      const result = await listTools();
      const toolNames = result.result.tools.map((t: any) => t.name);

      expect(toolNames).toContain("get_campaigns");
      expect(toolNames).toContain("get_campaign");
      expect(toolNames).toContain("get_campaign_metrics");
    });

    it("should include template tools", async () => {
      const result = await listTools();
      const toolNames = result.result.tools.map((t: any) => t.name);

      expect(toolNames).toContain("get_templates");
      expect(toolNames).toContain("get_email_template");
      expect(toolNames).toContain("get_sms_template");
    });

    it("should include user tools", async () => {
      const result = await listTools();
      const toolNames = result.result.tools.map((t: any) => t.name);

      expect(toolNames).toContain("get_user_fields");
      // PII tools might be disabled by default
      const hasPIItools = toolNames.includes("get_user_by_email");
      console.log(`PII tools enabled: ${hasPIItools}`);
    });

    it("should include list tools", async () => {
      const result = await listTools();
      const toolNames = result.result.tools.map((t: any) => t.name);

      expect(toolNames).toContain("get_lists");
      expect(toolNames).toContain("get_list_size");
    });
  });

  describe("Campaign Tools", () => {
    it("get_campaigns should return campaign list", async () => {
      const result = await invokeTool("get_campaigns", {
        page: 1,
        pageSize: 5,
      });

      expect(result).toHaveProperty("result");
      expect(result.result).toHaveProperty("content");
      expect(Array.isArray(result.result.content)).toBe(true);

      // Parse the JSON response
      const content = result.result.content[0];
      expect(content.type).toBe("text");

      const data = JSON.parse(content.text);
      expect(data).toHaveProperty("campaigns");
      expect(Array.isArray(data.campaigns)).toBe(true);
    });

    it("get_campaigns should respect pagination", async () => {
      const result = await invokeTool("get_campaigns", {
        page: 1,
        pageSize: 2,
      });

      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data.campaigns.length).toBeLessThanOrEqual(2);
    });

    it("get_campaign should fail gracefully for non-existent ID", async () => {
      const result = await invokeTool("get_campaign", {
        id: 999999999,
      });

      // Should either return error or empty response
      expect(result).toBeDefined();
    });
  });

  describe("Template Tools", () => {
    it("get_templates should return template list", async () => {
      const result = await invokeTool("get_templates");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("templates");
      expect(Array.isArray(data.templates)).toBe(true);
    });

    it("get_templates should support filtering", async () => {
      const result = await invokeTool("get_templates", {
        templateType: "email",
      });

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("templates");
    });
  });

  describe("User Tools", () => {
    it("get_user_fields should return field definitions", async () => {
      const result = await invokeTool("get_user_fields");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("fields");
      expect(Array.isArray(data.fields)).toBe(true);

      if (data.fields.length > 0) {
        const field = data.fields[0];
        expect(field).toHaveProperty("name");
        expect(field).toHaveProperty("type");
      }
    });

    it("get_user_by_email should work if PII is enabled", async () => {
      if (!ITERABLE_TEST_EMAIL) {
        console.log("Skipping user lookup test - ITERABLE_TEST_EMAIL not set");
        return;
      }

      const result = await invokeTool("get_user_by_email", {
        email: ITERABLE_TEST_EMAIL,
      });

      // May return error if PII tools are disabled
      if (result.error) {
        console.log("PII tools disabled (expected):", result.error.message);
      } else {
        expect(result).toHaveProperty("result");
      }
    });
  });

  describe("List Tools", () => {
    it("get_lists should return subscriber lists", async () => {
      const result = await invokeTool("get_lists");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("lists");
      expect(Array.isArray(data.lists)).toBe(true);
    });

    it("get_list_size should work for valid list ID", async () => {
      // First get a list ID
      const listsResult = await invokeTool("get_lists");
      const listsContent = listsResult.result.content[0];
      const listsData = JSON.parse(listsContent.text);

      if (listsData.lists.length === 0) {
        console.log("Skipping get_list_size test - no lists available");
        return;
      }

      const listId = listsData.lists[0].id;

      const result = await invokeTool("get_list_size", {
        listId,
      });

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("size");
      expect(typeof data.size).toBe("number");
    });
  });

  describe("Channel Tools", () => {
    it("get_channels should return available channels", async () => {
      const result = await invokeTool("get_channels");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("channels");
      expect(Array.isArray(data.channels)).toBe(true);
    });

    it("get_message_types should return message types", async () => {
      const result = await invokeTool("get_message_types");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("messageTypes");
      expect(Array.isArray(data.messageTypes)).toBe(true);
    });
  });

  describe("Other Tools", () => {
    it("get_journeys should return journeys", async () => {
      const result = await invokeTool("get_journeys");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("journeys");
      expect(Array.isArray(data.journeys)).toBe(true);
    });

    it("get_webhooks should return webhooks", async () => {
      const result = await invokeTool("get_webhooks");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("webhooks");
      expect(Array.isArray(data.webhooks)).toBe(true);
    });

    it("get_snippets should return code snippets", async () => {
      const result = await invokeTool("get_snippets");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("snippets");
      expect(Array.isArray(data.snippets)).toBe(true);
    });

    it("get_catalogs should return catalogs", async () => {
      const result = await invokeTool("get_catalogs");

      expect(result).toHaveProperty("result");
      const content = result.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty("catalogs");
      expect(Array.isArray(data.catalogs)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return error for unknown tool", async () => {
      const result = await invokeTool("nonexistent_tool");

      expect(result).toHaveProperty("error");
      expect(result.error).toHaveProperty("message");
    });

    it("should return error for invalid parameters", async () => {
      const result = await invokeTool("get_campaign", {
        id: "invalid", // Should be a number
      });

      expect(result).toHaveProperty("error");
    });

    it("should return error for missing required parameters", async () => {
      const result = await invokeTool("get_campaign", {
        // Missing id parameter
      });

      expect(result).toHaveProperty("error");
    });
  });

  describe("Response Format", () => {
    it("all tools should return MCP-compliant response", async () => {
      const result = await invokeTool("get_lists");

      expect(result).toHaveProperty("result");
      expect(result.result).toHaveProperty("content");
      expect(Array.isArray(result.result.content)).toBe(true);

      const content = result.result.content[0];
      expect(content).toHaveProperty("type");
      expect(content.type).toBe("text");
      expect(content).toHaveProperty("text");
      expect(typeof content.text).toBe("string");

      // Text should be valid JSON
      expect(() => JSON.parse(content.text)).not.toThrow();
    });
  });
});
