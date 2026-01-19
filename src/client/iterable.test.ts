/**
 * Unit tests for IterableClient
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IterableClient, IterableApiError } from "./iterable";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as any;

describe("IterableClient", () => {
  let client: IterableClient;

  beforeEach(() => {
    client = new IterableClient({
      apiKey: "test-api-key",
      baseUrl: "https://api.iterable.com",
    });
    mockFetch.mockClear();
  });

  describe("Constructor", () => {
    it("should use default baseUrl when not provided", () => {
      const defaultClient = new IterableClient({ apiKey: "test-key" });
      expect(defaultClient).toBeInstanceOf(IterableClient);
    });

    it("should use custom baseUrl when provided", () => {
      const euClient = new IterableClient({
        apiKey: "test-key",
        baseUrl: "https://api.eu.iterable.com",
      });
      expect(euClient).toBeInstanceOf(IterableClient);
    });
  });

  describe("Request handling", () => {
    it("should make GET request with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ campaigns: [] }),
      });

      await client.getCampaigns();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/campaigns"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Api-Key": "test-api-key",
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should throw IterableApiError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API key",
      });

      await expect(client.getCampaigns()).rejects.toThrow(IterableApiError);
    });

    it("should handle empty responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      });

      const result = await client.getCampaigns();
      expect(result).toEqual({});
    });

    it("should parse JSON responses", async () => {
      const mockResponse = { campaigns: [{ id: 1, name: "Test" }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.getCampaigns();
      expect(result).toEqual(mockResponse);
    });

    it("should handle non-JSON text responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "1234",
      });

      const result = await client.getListSize(1);
      expect(result.size).toBe(1234);
    });
  });

  describe("Campaign methods", () => {
    it("getCampaigns should add default pagination params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ campaigns: [], totalCampaignsCount: 0 }),
      });

      await client.getCampaigns();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("pageSize=20"),
        expect.anything()
      );
    });

    it("getCampaigns should accept custom pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ campaigns: [] }),
      });

      await client.getCampaigns({ page: 2, pageSize: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("pageSize=50"),
        expect.anything()
      );
    });

    it("getCampaign should fetch by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 123, name: "Test Campaign" }),
      });

      const result = await client.getCampaign(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.iterable.com/api/campaigns/123",
        expect.anything()
      );
      expect(result.id).toBe(123);
    });

    it("getCampaignMetrics should return CSV string", async () => {
      const csvData = "campaignId,metric,value\n123,opens,100";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => csvData,
      });

      const result = await client.getCampaignMetrics({ campaignId: 123 });
      expect(result).toBe(csvData);
    });
  });

  describe("Template methods", () => {
    it("getTemplates should handle query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ templates: [] }),
      });

      await client.getTemplates({
        templateType: "email",
        messageMedium: "Email",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("templateType=email"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("messageMedium=Email"),
        expect.anything()
      );
    });

    it("getEmailTemplate should fetch by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ templateId: 456, name: "Welcome Email" }),
      });

      const result = await client.getEmailTemplate({ templateId: 456 });
      expect(result.templateId).toBe(456);
    });
  });

  describe("User methods", () => {
    it("getUserByEmail should URL encode email", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ user: { email: "test+user@example.com" } }),
      });

      await client.getUserByEmail("test+user@example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("test+user@example.com")),
        expect.anything()
      );
    });

    it("getUserByUserId should fetch by userId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ user: { userId: "user123" } }),
      });

      const result = await client.getUserByUserId("user123");
      expect(result.user.userId).toBe("user123");
    });

    it("getSentMessages should handle array params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ messages: [] }),
      });

      await client.getSentMessages({
        email: "test@example.com",
        campaignIds: [1, 2, 3],
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("campaignIds=1");
      expect(callUrl).toContain("campaignIds=2");
      expect(callUrl).toContain("campaignIds=3");
    });
  });

  describe("List methods", () => {
    it("getLists should return lists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ lists: [{ id: 1, name: "Test List" }] }),
      });

      const result = await client.getLists();
      expect(result.lists).toHaveLength(1);
    });

    it("getListSize should parse number response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "1234",
      });

      const result = await client.getListSize(1);
      expect(result.size).toBe(1234);
    });

    it("getListUsers should parse newline-delimited emails", async () => {
      const emailList = "user1@example.com\nuser2@example.com\nuser3@example.com";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => emailList,
      });

      const result = await client.getListUsers({ listId: 1 });
      expect(result.users).toHaveLength(3);
      expect(result.users[0].email).toBe("user1@example.com");
    });
  });

  describe("Error handling", () => {
    it("should include status and statusText in error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Resource not found",
      });

      try {
        await client.getCampaign(999);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(IterableApiError);
        expect((error as IterableApiError).status).toBe(404);
        expect((error as IterableApiError).statusText).toBe("Not Found");
      }
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.getCampaigns()).rejects.toThrow(IterableApiError);
    });
  });

  describe("Catalog methods", () => {
    it("getCatalogs should return catalogs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ catalogs: [{ name: "Products" }] }),
      });

      const result = await client.getCatalogs();
      expect(result.catalogs).toHaveLength(1);
    });

    it("getCatalogItems should include pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ items: [], totalItemsCount: 0 }),
      });

      await client.getCatalogItems({ catalogName: "products", page: 1, pageSize: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.anything()
      );
    });

    it("getCatalogItem should fetch specific item", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "item123", name: "Product 1" }),
      });

      const result = await client.getCatalogItem({
        catalogName: "products",
        itemId: "item123",
      });

      expect(result.id).toBe("item123");
    });
  });
});
