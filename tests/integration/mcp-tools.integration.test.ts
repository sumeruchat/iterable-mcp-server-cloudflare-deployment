/**
 * Integration tests for MCP tool invocations (read-only tools)
 * Minimal test suite for fast verification
 */

import { describe, it, expect, beforeAll } from "vitest";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;

let SESSION_ID: string | null = null;

function createHeaders(includeSessionId = true): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (includeSessionId && SESSION_ID) {
    headers["Mcp-Session-Id"] = SESSION_ID;
  }
  if (ITERABLE_API_KEY) {
    headers["X-Iterable-Api-Key"] = ITERABLE_API_KEY;
  }
  return headers;
}

function parseSSE(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        return JSON.parse(line.substring(6));
      }
    }
    return { result: {} };
  }
}

async function initializeSession() {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: createHeaders(false),
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

  const sessionId = response.headers.get("Mcp-Session-Id");
  if (sessionId) {
    SESSION_ID = sessionId;
  }

  return parseSSE(await response.text());
}

async function invokeTool(toolName: string, params: Record<string, unknown> = {}) {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: params },
    }),
  });
  return parseSSE(await response.text());
}

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
  return parseSSE(await response.text());
}

describe("MCP Tool Invocation Tests", () => {
  let toolsList: any = null;

  beforeAll(async () => {
    if (!MCP_SERVER_URL) {
      throw new Error("MCP_SERVER_URL environment variable is required");
    }

    if (!ITERABLE_API_KEY) {
      console.warn("ITERABLE_API_KEY not set. Tests will fail.");
    }

    const initResult = await initializeSession();
    if (initResult.error) {
      throw new Error(`Failed to initialize session: ${JSON.stringify(initResult.error)}`);
    }
    console.log("Session initialized successfully");

    // Pre-fetch tools list
    toolsList = await listTools();
  });

  it("should list read-only tools", async () => {
    expect(toolsList).toHaveProperty("result");
    expect(toolsList.result).toHaveProperty("tools");
    expect(Array.isArray(toolsList.result.tools)).toBe(true);
    expect(toolsList.result.tools.length).toBeGreaterThanOrEqual(20);

    const toolNames = toolsList.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("get_campaigns");
    expect(toolNames).toContain("get_templates");
    expect(toolNames).toContain("get_lists");
  });

  it("get_campaigns should return campaigns", async () => {
    const result = await invokeTool("get_campaigns", { page: 1, pageSize: 5 });
    expect(result).toHaveProperty("result");
    const text = result.result.content[0].text;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse response as JSON: ${text.substring(0, 200)}`);
    }
    expect(data).toHaveProperty("campaigns");
    expect(Array.isArray(data.campaigns)).toBe(true);
  });

  it("get_lists should return lists", async () => {
    const result = await invokeTool("get_lists");
    expect(result).toHaveProperty("result");
    const text = result.result.content[0].text;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse response as JSON: ${text.substring(0, 200)}`);
    }
    expect(data).toHaveProperty("lists");
    expect(Array.isArray(data.lists)).toBe(true);
  });

  it("get_channels should return channels", async () => {
    const result = await invokeTool("get_channels");
    expect(result).toHaveProperty("result");
    const text = result.result.content[0].text;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse response as JSON: ${text.substring(0, 200)}`);
    }
    expect(data).toHaveProperty("channels");
    expect(Array.isArray(data.channels)).toBe(true);
  });
});
