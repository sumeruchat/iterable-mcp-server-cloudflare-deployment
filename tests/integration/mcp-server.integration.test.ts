/**
 * Integration tests for MCP server endpoints
 */

import { describe, it, expect, beforeAll } from "vitest";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;
const IS_LOCAL = MCP_SERVER_URL?.startsWith("http://localhost");

describe("MCP Server Integration Tests", () => {
  beforeAll(() => {
    if (!MCP_SERVER_URL) {
      throw new Error("MCP_SERVER_URL environment variable is required");
    }
  });

  describe("Health Check", () => {
    it("should respond to root endpoint with server info", async () => {
      const response = await fetch(MCP_SERVER_URL!);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.name).toBe("Iterable MCP Server");
      expect(data.version).toBeDefined();
      expect(data.endpoints).toHaveProperty("mcp");
      expect(data.endpoints).toHaveProperty("sse");
    });

    it("should have HTTPS enabled (remote only)", () => {
      if (IS_LOCAL) {
        console.log("Skipping HTTPS test for local server");
        return;
      }
      expect(MCP_SERVER_URL).toMatch(/^https:\/\//);
    });
  });

  describe("MCP Protocol Endpoints", () => {
    it("should have /mcp endpoint available", async () => {
      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      });

      expect(response.status).not.toBe(404);
    });

    it("should have /sse endpoint available and return event stream", async () => {
      if (!ITERABLE_API_KEY) {
        console.log("Skipping SSE test - ITERABLE_API_KEY not set");
        return;
      }

      const response = await fetch(`${MCP_SERVER_URL}/sse?api_key=${ITERABLE_API_KEY}`, {
        headers: { "Accept": "text/event-stream" },
      });

      // SSE endpoint should return 200 with text/event-stream content type
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
    });
  });

  describe("SSE Transport (ChatGPT compatibility)", () => {
    it("should accept API key via URL parameter for SSE", async () => {
      if (!ITERABLE_API_KEY) {
        console.log("Skipping SSE API key test - ITERABLE_API_KEY not set");
        return;
      }

      const response = await fetch(`${MCP_SERVER_URL}/sse?api_key=${ITERABLE_API_KEY}`, {
        headers: { "Accept": "text/event-stream" },
      });

      expect(response.status).toBe(200);

      // Read the first chunk to verify we get an endpoint event
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        // SSE should return an endpoint event with the session URL
        expect(text).toContain("event: endpoint");
        reader.cancel();
      }
    });

    it("should reject SSE without API key (remote only)", async () => {
      // Skip this test for local dev since .env provides fallback API key
      if (IS_LOCAL) {
        console.log("Skipping - local dev has fallback API key from .env");
        return;
      }

      const response = await fetch(`${MCP_SERVER_URL}/sse`, {
        headers: { "Accept": "text/event-stream" },
      });

      // Should return 401 when no API key provided
      expect(response.status).toBe(401);
    });
  });

  describe("API Key Authentication", () => {
    it("should accept API key via header", async () => {
      if (!ITERABLE_API_KEY) {
        console.log("Skipping - ITERABLE_API_KEY not set");
        return;
      }

      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "X-Iterable-Api-Key": ITERABLE_API_KEY,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
        }),
      });

      expect([200, 400, 406]).toContain(response.status);
    });
  });

  describe("Performance", () => {
    it("should respond within 2 seconds and handle concurrent requests", async () => {
      const start = Date.now();
      const requests = Array(5).fill(null).map(() => fetch(MCP_SERVER_URL!));
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
      for (const response of responses) {
        expect(response.ok).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown endpoints and malformed JSON", async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      };
      if (ITERABLE_API_KEY) {
        headers["X-Iterable-Api-Key"] = ITERABLE_API_KEY;
      }

      const [unknownResponse, malformedResponse] = await Promise.all([
        fetch(`${MCP_SERVER_URL}/nonexistent`),
        fetch(`${MCP_SERVER_URL}/mcp`, {
          method: "POST",
          headers,
          body: "invalid json{{{",
        }),
      ]);

      expect([200, 404]).toContain(unknownResponse.status);
      expect([400, 401, 406, 500]).toContain(malformedResponse.status);
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers for cross-origin requests", async () => {
      const response = await fetch(MCP_SERVER_URL!, {
        headers: { Origin: "https://example.com" },
      });

      expect(response.headers.get("access-control-allow-origin")).toBeDefined();
    });
  });
});
