# Iterable MCP Server - Cloudflare Workers Deployment

## Project Overview

Deploy the Iterable MCP server on Cloudflare Workers to enable web-based AI clients (ChatGPT, Gemini) to connect remotely, solving the operational burden that currently prevents Iterable from supporting these clients.

### Background

From Slack discussion:
- **Problem**: Iterable doesn't support web-based clients (ChatGPT, Gemini) because hosting the MCP server is an operational burden
- **Solution**: Deploy to Cloudflare Workers - zero ops, auto-scaling, generous free tier (100k requests/day)
- **Target Clients**: ChatGPT (most requested), Gemini CLI (primary test target)
- **Authentication**: Greg Methvin mentions "more granular authentication scheme on the server separate from API keys" would be nice but may be out of scope for v1

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              End Users                                       │
│         (Developers using ChatGPT/Gemini to interact with Iterable)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS (SSE/Streamable HTTP)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers (Global Edge)                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Iterable MCP Server (McpAgent)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Campaigns  │  │  Templates  │  │   Users     │  │   Events    │  │  │
│  │  │   Tools     │  │   Tools     │  │   Tools     │  │   Tools     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Auth Layer (Optional OAuth or API Key via Header/Query Param)      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ REST API Calls
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Iterable API                                        │
│                    (api.iterable.com / api.eu.iterable.com)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools to Implement

Based on the official Iterable MCP server capabilities, the following tools should be implemented:

### Phase 1: Read-Only Tools (MVP)

| Tool Name | Description | Iterable API Endpoint |
|-----------|-------------|----------------------|
| `list_campaigns` | List all campaigns with optional filters | `GET /api/campaigns` |
| `get_campaign` | Get details of a specific campaign | `GET /api/campaigns/{id}` |
| `list_templates` | List email/push/SMS templates | `GET /api/templates` |
| `get_template` | Get a specific template by ID | `GET /api/templates/{templateType}/{templateId}` |
| `get_user` | Look up a user by email or userId | `GET /api/users/{email}` |
| `get_user_events` | Get events for a specific user | `GET /api/events/{email}` |
| `list_lists` | Get all subscriber lists | `GET /api/lists` |
| `list_channels` | Get available message channels | `GET /api/channels` |
| `get_metadata` | Get project metadata tables | `GET /api/metadata` |

### Phase 2: Write Tools (Optional, Gated)

| Tool Name | Description | Iterable API Endpoint |
|-----------|-------------|----------------------|
| `create_user` | Create or update a user profile | `POST /api/users/update` |
| `update_user` | Update user profile fields | `POST /api/users/update` |
| `track_event` | Track a custom event | `POST /api/events/track` |
| `track_purchase` | Track a purchase event | `POST /api/commerce/trackPurchase` |
| `update_cart` | Update user shopping cart | `POST /api/commerce/updateCart` |
| `send_email` | Send a transactional email | `POST /api/email/target` |

### Special Tools for ChatGPT Deep Research

ChatGPT requires specific tools named `search` and `fetch` for Deep Research mode:

| Tool Name | Description | Implementation |
|-----------|-------------|----------------|
| `search` | Search across Iterable resources | Aggregates results from campaigns, templates, users |
| `fetch` | Fetch detailed information about a resource | Routes to appropriate get_* tool based on resource type |

---

## Technical Implementation

### Project Structure

```
iterable-mcp-cloudflare/
├── src/
│   ├── index.ts              # Main entry point with McpAgent
│   ├── tools/
│   │   ├── campaigns.ts      # Campaign-related tools
│   │   ├── templates.ts      # Template tools
│   │   ├── users.ts          # User lookup and management tools
│   │   ├── events.ts         # Event tracking tools
│   │   ├── commerce.ts       # Commerce/purchase tools
│   │   └── search.ts         # ChatGPT search/fetch tools
│   ├── client/
│   │   └── iterable.ts       # Iterable API client wrapper
│   ├── auth/
│   │   └── api-key.ts        # API key validation middleware
│   └── types/
│       └── iterable.ts       # TypeScript types for Iterable API
├── wrangler.jsonc            # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── .dev.vars.example         # Example environment variables
```

### Core McpAgent Implementation

```typescript
// src/index.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IterableClient } from "./client/iterable";
import { registerCampaignTools } from "./tools/campaigns";
import { registerTemplateTools } from "./tools/templates";
import { registerUserTools } from "./tools/users";
import { registerSearchTools } from "./tools/search";

export class IterableMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "iterable-mcp",
    version: "1.0.0",
  });

  async init() {
    const client = new IterableClient(this.env.ITERABLE_API_KEY, {
      baseUrl: this.env.ITERABLE_API_BASE_URL || "https://api.iterable.com",
    });

    // Register all tool categories
    registerCampaignTools(this.server, client);
    registerTemplateTools(this.server, client);
    registerUserTools(this.server, client, {
      enablePII: this.env.ITERABLE_USER_PII === "true",
    });
    registerSearchTools(this.server, client); // For ChatGPT Deep Research

    if (this.env.ITERABLE_ENABLE_WRITES === "true") {
      // Only register write tools if explicitly enabled
      registerWriteTools(this.server, client);
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Support API key via query param or header
    const apiKey = url.searchParams.get("api_key") ||
                   request.headers.get("X-Iterable-Api-Key") ||
                   env.ITERABLE_API_KEY;

    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Override env with provided API key
    const envWithKey = { ...env, ITERABLE_API_KEY: apiKey };

    return IterableMCP.fetch(request, envWithKey, ctx);
  },
};
```

### Wrangler Configuration

```jsonc
// wrangler.jsonc
{
  "name": "iterable-mcp-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-15",
  "compatibility_flags": ["nodejs_compat"],

  // Default: read-only, no PII
  "vars": {
    "ITERABLE_USER_PII": "false",
    "ITERABLE_ENABLE_WRITES": "false",
    "ITERABLE_API_BASE_URL": "https://api.iterable.com"
  },

  // Optional: Durable Objects for session state (if needed)
  "durable_objects": {
    "bindings": [
      {
        "name": "MCP_SESSIONS",
        "class_name": "IterableMCP"
      }
    ]
  },

  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["IterableMCP"]
    }
  ]
}
```

### Example Tool Implementation

```typescript
// src/tools/campaigns.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IterableClient } from "../client/iterable";

export function registerCampaignTools(server: McpServer, client: IterableClient) {
  server.tool(
    "list_campaigns",
    "List Iterable campaigns with optional filtering",
    {
      status: z.enum(["Draft", "Scheduled", "Running", "Finished", "Cancelled"]).optional(),
      type: z.enum(["Blast", "Triggered", "Workflow"]).optional(),
      limit: z.number().min(1).max(100).default(20),
    },
    async ({ status, type, limit }) => {
      const campaigns = await client.listCampaigns({ status, type, limit });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(campaigns, null, 2),
        }],
      };
    }
  );

  server.tool(
    "get_campaign",
    "Get detailed information about a specific campaign",
    {
      campaign_id: z.number().describe("The campaign ID to retrieve"),
    },
    async ({ campaign_id }) => {
      const campaign = await client.getCampaign(campaign_id);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(campaign, null, 2),
        }],
      };
    }
  );
}
```

---

## API Key Handling Strategy

### Option 1: Environment Variable (Simplest)
- Single API key stored as Cloudflare secret
- Good for single-tenant or internal use
- Configured via `wrangler secret put ITERABLE_API_KEY`

### Option 2: Per-Request API Key (Flexible)
- Client passes API key via header or query param
- Supports multi-tenant usage
- Each user/org brings their own Iterable credentials

```typescript
// Client passes key in request
const mcpUrl = "https://iterable-mcp.workers.dev/sse?api_key=YOUR_KEY";
// OR via header
headers: { "X-Iterable-Api-Key": "YOUR_KEY" }
```

### Option 3: OAuth + User Mapping (Advanced - Future)
- OAuth login (GitHub/Google) to identify user
- Map OAuth identity to stored Iterable API key
- Requires KV storage for credential mapping

---

## ChatGPT Integration

### Connection Setup

1. **Enable Developer Mode** in ChatGPT Settings
2. Navigate to **Settings > Connectors > Create**
3. Enter the MCP server URL: `https://iterable-mcp.your-account.workers.dev/sse`
4. Configure API key (if using per-request auth)

### Required Endpoints

ChatGPT expects these MCP transport endpoints:
- `/sse` - Server-Sent Events endpoint for MCP protocol
- `/mcp` - Streamable HTTP endpoint (newer transport)

### Deep Research Support

For ChatGPT Deep Research mode, implement these specific tools:

```typescript
// src/tools/search.ts
server.tool(
  "search",
  "Search across Iterable campaigns, templates, and users",
  {
    query: z.string().describe("Search query"),
    resource_type: z.enum(["campaigns", "templates", "users", "all"]).default("all"),
  },
  async ({ query, resource_type }) => {
    // Aggregate search across multiple Iterable endpoints
    const results = await client.search(query, resource_type);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "fetch",
  "Fetch detailed information about an Iterable resource",
  {
    resource_type: z.enum(["campaign", "template", "user"]),
    resource_id: z.string().describe("The resource identifier"),
  },
  async ({ resource_type, resource_id }) => {
    const resource = await client.getResource(resource_type, resource_id);
    return {
      content: [{ type: "text", text: JSON.stringify(resource, null, 2) }],
    };
  }
);
```

---

## Testing Strategy

### 1. Local Development Testing

```bash
# Start local dev server
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector@latest
# Connect to http://localhost:8788/sse
```

### 2. Integration Test with Gemini CLI (Primary)

Gemini CLI is the primary test target as it supports remote MCP servers via `httpUrl`.

**Setup: Configure Gemini CLI**
```bash
# Edit ~/.gemini/settings.json
{
  "mcpServers": {
    "iterable": {
      "httpUrl": "https://iterable-mcp.your-account.workers.dev/mcp"
    }
  }
}
```

**Test Scenario: List Campaigns**
1. Open Gemini CLI: `gemini`
2. Ask: "What campaigns do I have in Iterable?"
3. Expected: Gemini invokes `list_campaigns` tool and displays results

**Test Scenario: User Lookup**
1. Ask: "Look up the user with email test@example.com in Iterable"
2. Expected: Gemini invokes `get_user` tool with email parameter

**Test Scenario: Template Management**
1. Ask: "Show me my email templates in Iterable"
2. Expected: Gemini invokes `list_templates` tool

### 3. Integration Test with ChatGPT (Secondary - Requires Pro)

**Test Scenario: List Campaigns**
1. Enable Developer Mode in ChatGPT Settings
2. Navigate to Settings > Connectors > Create
3. Enter MCP server URL: `https://iterable-mcp.your-account.workers.dev/sse`
4. Ask: "What campaigns do I have in Iterable?"
5. Expected: ChatGPT invokes `list_campaigns` tool and displays results

### 4. Automated E2E Tests

```typescript
// tests/e2e/mcp.test.ts
describe("MCP Server Integration", () => {
  it("should list campaigns via MCP", async () => {
    const client = new MCPClient("https://iterable-mcp.workers.dev/mcp");
    await client.connect();

    const result = await client.callTool("list_campaigns", { limit: 5 });
    expect(result.content[0].text).toContain("campaigns");
  });
});
```

---

## Deployment Steps

### Phase 1: Initial Deployment

```bash
# 1. Create project from template
npm create cloudflare@latest -- iterable-mcp-server \
  --template=cloudflare/ai/demos/remote-mcp-authless

# 2. Install dependencies
cd iterable-mcp-server
npm install

# 3. Add Iterable API key as secret
wrangler secret put ITERABLE_API_KEY

# 4. Deploy
wrangler deploy

# 5. Verify deployment
curl https://iterable-mcp-server.your-account.workers.dev/sse
```

### Phase 2: Enable OAuth (Optional)

```bash
# Use OAuth template instead
npm create cloudflare@latest -- iterable-mcp-server \
  --template=cloudflare/ai/demos/remote-mcp-github-oauth

# Configure GitHub OAuth credentials
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY

# Create KV namespace for sessions
wrangler kv namespace create "OAUTH_KV"
```

---

## Success Criteria

### MVP (Phase 1)
- [ ] MCP server deployed on Cloudflare Workers
- [ ] Read-only tools working (campaigns, templates, users)
- [ ] **Gemini CLI can connect and invoke tools** (primary test)
- [ ] MCP Inspector validation passes
- [ ] API key authentication via header/query param

### Extended (Phase 2)
- [ ] Write tools implemented (gated by env var)
- [ ] `search` and `fetch` tools for ChatGPT Deep Research
- [ ] ChatGPT Pro integration tested (secondary)
- [ ] OAuth authentication option
- [ ] EU region support (api.eu.iterable.com)

### Nice to Have
- [ ] Claude Code / Cursor integration preserved (via mcp-remote)
- [ ] Rate limiting / usage tracking
- [ ] Multiple project support (key per project)

---

## Security Considerations

1. **API Key Protection**: Never log or expose API keys in responses
2. **PII Gating**: User PII tools disabled by default
3. **Write Protection**: Write operations disabled by default
4. **Rate Limiting**: Rely on Iterable's existing API rate limits
5. **Input Validation**: All tool inputs validated via Zod schemas
6. **HTTPS Only**: Cloudflare Workers enforce HTTPS

---

## References

- [Cloudflare MCP Server Guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Gemini CLI MCP Server Docs](https://geminicli.com/docs/tools/mcp-server/) (Primary test target)
- [Iterable MCP Server Docs](https://support.iterable.com/hc/en-us/articles/42936800222612-Overview-of-Iterable-s-MCP-Server)
- [Iterable API Reference](https://api.iterable.com/api/docs)
- [OpenAI MCP Integration](https://platform.openai.com/docs/guides/tools-connectors-mcp)
- [ChatGPT Remote MCP Setup](https://community.openai.com/t/how-to-set-up-a-remote-mcp-server-and-connect-it-to-chatgpt-deep-research/1278375)
