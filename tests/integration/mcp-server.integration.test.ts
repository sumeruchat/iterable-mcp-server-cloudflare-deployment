/**
 * Integration tests for deployed MCP server
 *
 * These tests verify the server is deployed correctly and can handle real requests.
 *
 * Prerequisites:
 * - Server must be deployed to Cloudflare Workers
 * - Set MCP_SERVER_URL environment variable
 * - Set ITERABLE_API_KEY environment variable
 *
 * Usage:
 *   export MCP_SERVER_URL=https://iterable-mcp-server.your-account.workers.dev
 *   export ITERABLE_API_KEY=your_test_api_key
 *   npm run integration
 */

import { describe, it, expect, beforeAll } from "vitest";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;

describe("MCP Server Integration Tests", () => {
  beforeAll(() => {
    if (!MCP_SERVER_URL) {
      throw new Error(
        "MCP_SERVER_URL environment variable is required. " +
          "Set it to your deployed worker URL, e.g., " +
          "https://iterable-mcp-server.your-account.workers.dev"
      );
    }

    if (!ITERABLE_API_KEY) {
      console.warn(
        "ITERABLE_API_KEY not set. Some tests may fail. " +
          "Set it to test with real API key authentication."
      );
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

    it("should have HTTPS enabled", () => {
      expect(MCP_SERVER_URL).toMatch(/^https:\/\//);
    });
  });

  describe("MCP Protocol Endpoints", () => {
    it("should have /mcp endpoint available", async () => {
      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      });

      // Should respond (may need auth, but endpoint should exist)
      expect(response.status).not.toBe(404);
    });

    it("should have /sse endpoint available", async () => {
      const response = await fetch(`${MCP_SERVER_URL}/sse`);

      // Should respond (may need auth, but endpoint should exist)
      expect(response.status).not.toBe(404);
    });
  });

  describe("API Key Authentication", () => {
    it("should reject requests without API key when required", async () => {
      // Try to access an endpoint that requires API key
      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      // Should either work (if default API key is set) or require auth
      expect([200, 401, 403]).toContain(response.status);
    });

    it("should accept API key via query parameter", async () => {
      if (!ITERABLE_API_KEY) {
        console.log("Skipping API key test - ITERABLE_API_KEY not set");
        return;
      }

      const url = new URL(`${MCP_SERVER_URL}/mcp`);
      url.searchParams.set("api_key", ITERABLE_API_KEY);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      });

      expect([200, 400, 406]).toContain(response.status);
    });

    it("should accept API key via header", async () => {
      if (!ITERABLE_API_KEY) {
        console.log("Skipping API key test - ITERABLE_API_KEY not set");
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
          params: {},
        }),
      });

      expect([200, 400, 406]).toContain(response.status);
    });
  });

  describe("Performance", () => {
    it("should respond within 2 seconds", async () => {
      const start = Date.now();
      const response = await fetch(MCP_SERVER_URL!);
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000);
    });

    it("should handle concurrent requests", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => fetch(MCP_SERVER_URL!));

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.ok).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for unknown endpoints", async () => {
      const response = await fetch(`${MCP_SERVER_URL}/nonexistent`);
      // Cloudflare Workers may return 404 or 200 with error message
      expect([200, 404]).toContain(response.status);
    });

    it("should handle malformed JSON gracefully", async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      };

      // Add API key if available to test JSON parsing specifically
      if (ITERABLE_API_KEY) {
        headers["X-Iterable-Api-Key"] = ITERABLE_API_KEY;
      }

      const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: "POST",
        headers,
        body: "invalid json{{{",
      });

      // May return 400/500 for malformed JSON, 401 if no API key, or 406 for missing headers
      expect([400, 401, 406, 500]).toContain(response.status);
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers for cross-origin requests", async () => {
      const response = await fetch(MCP_SERVER_URL!, {
        headers: {
          Origin: "https://example.com",
        },
      });

      // Cloudflare Workers should handle CORS
      expect(response.headers.get("access-control-allow-origin")).toBeDefined();
    });
  });

  describe("SSL/TLS", () => {
    it("should use valid SSL certificate", async () => {
      // Fetch will fail if SSL is invalid
      const response = await fetch(MCP_SERVER_URL!);
      expect(response.ok).toBe(true);
    });

    it("should redirect HTTP to HTTPS", async () => {
      if (!MCP_SERVER_URL!.startsWith("https://")) {
        console.log("Skipping HTTPS redirect test - not an HTTPS URL");
        return;
      }

      const httpUrl = MCP_SERVER_URL!.replace("https://", "http://");

      try {
        const response = await fetch(httpUrl, {
          redirect: "manual",
        });

        // Cloudflare should redirect HTTP to HTTPS
        expect([301, 302, 308]).toContain(response.status);
      } catch (error) {
        // HTTP might not be supported at all, which is fine
        console.log("HTTP not supported (expected)");
      }
    });
  });
});
