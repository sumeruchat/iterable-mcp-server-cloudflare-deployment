/**
 * Iterable MCP Server for Cloudflare Workers
 * Enables ChatGPT, Gemini CLI, and other web clients to connect to Iterable
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { IterableClient } from "./client/iterable.js";
import { isToolAllowed } from "./tools/filter.js";
import type { Env } from "./types/env.js";
import { parseConfig } from "./types/env.js";

/**
 * Main MCP Agent for Iterable
 */
export class IterableMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: "iterable-mcp",
    version: "1.0.0",
  });

  /**
   * Get a client instance with the current API key from the environment.
   * This ensures each request uses the correct API key.
   */
  private getClient(): IterableClient {
    const apiKey = this.env.ITERABLE_API_KEY || "";
    return new IterableClient({
      apiKey,
      baseUrl: this.env.ITERABLE_API_BASE_URL || "https://api.iterable.com",
    });
  }

  async init() {
    const config = parseConfig(this.env);

    // ==================== CAMPAIGN TOOLS ====================

    if (isToolAllowed("get_campaigns", config)) {
      this.server.tool(
        "get_campaigns",
        "Retrieve campaigns with optional filtering and pagination",
        {
          page: z.number().int().min(1).optional().describe("Page number (starting at 1)"),
          pageSize: z.number().int().min(1).max(1000).optional().describe("Results per page (max 1000)"),
          sort: z.string().optional().describe("Field to sort by with optional direction (e.g., 'id', 'name:desc')"),
        },
        async (params) => {
          const result = await this.getClient().getCampaigns(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_campaign", config)) {
      this.server.tool(
        "get_campaign",
        "Get detailed information about a specific campaign by ID",
        {
          id: z.number().describe("Campaign ID to retrieve"),
        },
        async (params) => {
          const result = await this.getClient().getCampaign(params.id);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_campaign_metrics", config)) {
      this.server.tool(
        "get_campaign_metrics",
        "Get campaign performance metrics (CSV format)",
        {
          campaignId: z.number().describe("Campaign ID to get metrics for"),
          startDateTime: z.string().optional().describe("Start date (YYYY-MM-DD HH:MM:SS)"),
          endDateTime: z.string().optional().describe("End date (YYYY-MM-DD HH:MM:SS)"),
        },
        async (params) => {
          const result = await this.getClient().getCampaignMetrics(params);
          return {
            content: [{ type: "text", text: result }],
          };
        }
      );
    }

    if (isToolAllowed("get_child_campaigns", config)) {
      this.server.tool(
        "get_child_campaigns",
        "Get child campaigns of a recurring campaign",
        {
          id: z.number().describe("ID of the recurring campaign"),
          page: z.number().int().min(1).optional(),
          pageSize: z.number().int().min(1).max(1000).optional(),
        },
        async (params) => {
          const result = await this.getClient().getChildCampaigns(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== TEMPLATE TOOLS ====================

    if (isToolAllowed("get_templates", config)) {
      this.server.tool(
        "get_templates",
        "Retrieve templates with optional filtering",
        {
          templateType: z.string().optional().describe("Filter by template type"),
          messageMedium: z.string().optional().describe("Filter by message medium"),
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
        },
        async (params) => {
          const result = await this.getClient().getTemplates(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_email_template", config)) {
      this.server.tool(
        "get_email_template",
        "Get details for a specific email template by ID",
        {
          templateId: z.number().describe("Email template ID to retrieve"),
          locale: z.string().optional().describe("Locale for localized templates"),
        },
        async (params) => {
          const result = await this.getClient().getEmailTemplate(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_sms_template", config)) {
      this.server.tool(
        "get_sms_template",
        "Get details for a specific SMS template by ID",
        {
          templateId: z.number().describe("SMS template ID to retrieve"),
          locale: z.string().optional(),
        },
        async (params) => {
          const result = await this.getClient().getSMSTemplate(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_push_template", config)) {
      this.server.tool(
        "get_push_template",
        "Get details for a specific push notification template by ID",
        {
          templateId: z.number().describe("Push template ID to retrieve"),
          locale: z.string().optional(),
        },
        async (params) => {
          const result = await this.getClient().getPushTemplate(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_inapp_template", config)) {
      this.server.tool(
        "get_inapp_template",
        "Get details for a specific in-app message template by ID",
        {
          templateId: z.number().describe("In-app template ID to retrieve"),
          locale: z.string().optional(),
        },
        async (params) => {
          const result = await this.getClient().getInAppTemplate(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_template_by_client_id", config)) {
      this.server.tool(
        "get_template_by_client_id",
        "Get template by client template ID",
        {
          clientTemplateId: z.string().describe("Client template ID to look up"),
        },
        async (params) => {
          const result = await this.getClient().getTemplateByClientId(params.clientTemplateId);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== USER TOOLS ====================

    if (isToolAllowed("get_user_by_email", config)) {
      this.server.tool(
        "get_user_by_email",
        "Look up a user by email address",
        {
          email: z.string().email().describe("User's email address"),
        },
        async (params) => {
          const result = await this.getClient().getUserByEmail(params.email);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_user_by_user_id", config)) {
      this.server.tool(
        "get_user_by_user_id",
        "Look up a user by user ID",
        {
          userId: z.string().describe("User's unique ID"),
        },
        async (params) => {
          const result = await this.getClient().getUserByUserId(params.userId);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_user_fields", config)) {
      this.server.tool(
        "get_user_fields",
        "Get all available user data fields in the project",
        {},
        async () => {
          const result = await this.getClient().getUserFields();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_sent_messages", config)) {
      this.server.tool(
        "get_sent_messages",
        "Get messages sent to a specific user",
        {
          email: z.string().email().optional().describe("User's email"),
          userId: z.string().optional().describe("User's ID"),
          limit: z.number().int().min(1).optional().describe("Max number of messages to return"),
          campaignIds: z.array(z.number()).optional().describe("Filter by campaign IDs"),
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
          messageMedium: z.string().optional().describe("Filter by message type (Email, SMS, etc.)"),
        },
        async (params) => {
          const result = await this.getClient().getSentMessages(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_user_events_by_email", config)) {
      this.server.tool(
        "get_user_events_by_email",
        "Get events for a user by email",
        {
          email: z.string().email().describe("User's email address"),
          limit: z.number().int().min(1).optional().describe("Max events to return"),
        },
        async (params) => {
          const result = await this.getClient().getUserEventsByEmail(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_user_events_by_user_id", config)) {
      this.server.tool(
        "get_user_events_by_user_id",
        "Get events for a user by user ID",
        {
          userId: z.string().describe("User's unique ID"),
          limit: z.number().int().min(1).optional().describe("Max events to return"),
        },
        async (params) => {
          const result = await this.getClient().getUserEventsByUserId(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== LIST TOOLS ====================

    if (isToolAllowed("get_lists", config)) {
      this.server.tool(
        "get_lists",
        "Get all subscriber lists in the project",
        {},
        async () => {
          const result = await this.getClient().getLists();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_list_size", config)) {
      this.server.tool(
        "get_list_size",
        "Get the number of users in a list",
        {
          listId: z.number().describe("List ID to get size for"),
        },
        async (params) => {
          const result = await this.getClient().getListSize(params.listId);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_list_users", config)) {
      this.server.tool(
        "get_list_users",
        "Get users in a list (returns email addresses)",
        {
          listId: z.number().describe("List ID to get users from"),
          maxResults: z.number().int().min(1).optional().describe("Max users to return"),
        },
        async (params) => {
          const result = await this.getClient().getListUsers(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== CHANNEL TOOLS ====================

    if (isToolAllowed("get_channels", config)) {
      this.server.tool(
        "get_channels",
        "Get all available message channels",
        {},
        async () => {
          const result = await this.getClient().getChannels();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_message_types", config)) {
      this.server.tool(
        "get_message_types",
        "Get all available message types",
        {},
        async () => {
          const result = await this.getClient().getMessageTypes();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== JOURNEY TOOLS ====================

    if (isToolAllowed("get_journeys", config)) {
      this.server.tool(
        "get_journeys",
        "Get all journeys in the project",
        {},
        async () => {
          const result = await this.getClient().getJourneys();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== EXPERIMENT TOOLS ====================

    if (isToolAllowed("get_experiment_metrics", config)) {
      this.server.tool(
        "get_experiment_metrics",
        "Get metrics for a specific experiment",
        {
          experimentId: z.number().describe("Experiment ID to get metrics for"),
        },
        async (params) => {
          const result = await this.getClient().getExperimentMetrics(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== WEBHOOK TOOLS ====================

    if (isToolAllowed("get_webhooks", config)) {
      this.server.tool(
        "get_webhooks",
        "Get all webhooks configured in the project",
        {},
        async () => {
          const result = await this.getClient().getWebhooks();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== SNIPPET TOOLS ====================

    if (isToolAllowed("get_snippets", config)) {
      this.server.tool(
        "get_snippets",
        "Get all code snippets in the project",
        {},
        async () => {
          const result = await this.getClient().getSnippets();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_snippet", config)) {
      this.server.tool(
        "get_snippet",
        "Get a specific code snippet by ID",
        {
          id: z.number().describe("Snippet ID to retrieve"),
        },
        async (params) => {
          const result = await this.getClient().getSnippet(params.id);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    // ==================== CATALOG TOOLS ====================

    if (isToolAllowed("get_catalogs", config)) {
      this.server.tool(
        "get_catalogs",
        "Get all catalogs in the project",
        {},
        async () => {
          const result = await this.getClient().getCatalogs();
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_catalog_items", config)) {
      this.server.tool(
        "get_catalog_items",
        "Get items from a specific catalog",
        {
          catalogName: z.string().describe("Name of the catalog"),
          page: z.number().int().min(1).optional(),
          pageSize: z.number().int().min(1).max(1000).optional(),
        },
        async (params) => {
          const result = await this.getClient().getCatalogItems(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }

    if (isToolAllowed("get_catalog_item", config)) {
      this.server.tool(
        "get_catalog_item",
        "Get a specific item from a catalog",
        {
          catalogName: z.string().describe("Name of the catalog"),
          itemId: z.string().describe("ID of the item to retrieve"),
        },
        async (params) => {
          const result = await this.getClient().getCatalogItem(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );
    }
  }
}

/**
 * Cloudflare Worker entry point
 */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Extract API key from request
    // Priority: query param > header > environment variable
    const apiKey =
      url.searchParams.get("api_key") ||
      request.headers.get("X-Iterable-Api-Key") ||
      env.ITERABLE_API_KEY;

    // Check if API key is provided
    if (!apiKey && (url.pathname === "/mcp" || url.pathname === "/sse" || url.pathname === "/sse/message")) {
      return new Response(
        JSON.stringify({
          error: "API key required",
          message: "Provide your Iterable API key via X-Iterable-Api-Key header or ?api_key query parameter",
          example: "https://iterable-mcp.workers.dev/mcp?api_key=YOUR_KEY",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Override environment with user's API key
    const envWithKey = { ...env, ITERABLE_API_KEY: apiKey };

    // SSE transport (for backward compatibility)
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return IterableMcpAgent.serveSSE("/sse").fetch(request, envWithKey, ctx);
    }

    // Streamable HTTP transport (recommended)
    if (url.pathname === "/mcp") {
      return IterableMcpAgent.serve("/mcp").fetch(request, envWithKey, ctx);
    }

    // Health check / info endpoint
    return new Response(
      JSON.stringify({
        name: "Iterable MCP Server",
        version: "1.0.0",
        endpoints: {
          mcp: "/mcp?api_key=YOUR_KEY (recommended)",
          sse: "/sse?api_key=YOUR_KEY (legacy)",
        },
        authentication: {
          methods: ["Query parameter (api_key)", "Header (X-Iterable-Api-Key)"],
          example: "curl https://iterable-mcp.workers.dev/mcp?api_key=YOUR_ITERABLE_API_KEY",
        },
        documentation: "https://github.com/iterable/mcp-server-cloudflare",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};
