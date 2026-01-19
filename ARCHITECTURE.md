# Architecture: Iterable MCP Server on Cloudflare Workers

## Overview

This document describes the architecture for porting the Iterable MCP server from a local stdio-based server to a remote HTTP-based server running on Cloudflare Workers.

## Original Architecture (Local MCP Server)

The official `@iterable/mcp` server runs locally and communicates via stdio:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's Machine                          │
│                                                                  │
│  ┌──────────────┐     stdio      ┌──────────────────────────┐   │
│  │ Claude Code  │ ◄────────────► │  @iterable/mcp Server    │   │
│  │ Cursor       │                │  (Node.js process)       │   │
│  │ Claude Desktop│               │                          │   │
│  └──────────────┘                │  ┌────────────────────┐  │   │
│                                  │  │ @iterable/api      │  │   │
│                                  │  │ (axios-based)      │  │   │
│                                  │  └─────────┬──────────┘  │   │
│                                  └────────────┼─────────────┘   │
└───────────────────────────────────────────────┼─────────────────┘
                                                │ HTTPS
                                                ▼
                                    ┌──────────────────────┐
                                    │   Iterable API       │
                                    │ api.iterable.com     │
                                    └──────────────────────┘
```

**Key Components:**
- `StdioServerTransport` - MCP SDK's stdio transport for local IPC
- `@iterable/api` - Axios-based client library with Zod schemas
- `KeyManager` - Local encrypted storage for API keys
- Tool filtering - PII, write, and send permission gating

**Why this can't run on Cloudflare Workers:**
1. **stdio transport** - Workers are HTTP-based, no stdin/stdout
2. **axios** - Uses Node.js `http` module, not available in Workers
3. **fs operations** - Key manager uses local filesystem
4. **Node.js APIs** - `AsyncLocalStorage`, `process.env`, etc.

---

## Target Architecture (Cloudflare Workers)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AI Clients                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Gemini CLI  │  │  ChatGPT    │  │ Claude Code │  │ MCP Inspector │  │
│  │ (primary)   │  │  (Pro)      │  │ (mcp-remote)│  │  (testing)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │
└─────────┼────────────────┼────────────────┼─────────────────┼──────────┘
          │                │                │                 │
          │ httpUrl        │ SSE            │ mcp-remote      │ HTTP
          │                │                │ proxy           │
          ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers (Global Edge)                     │
│                                                                          │
│  Endpoints:                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /mcp  - Streamable HTTP transport (recommended)                 │    │
│  │  /sse  - Server-Sent Events transport (legacy)                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      IterableMcpAgent                            │    │
│  │                   (extends McpAgent)                             │    │
│  │                                                                  │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │    │
│  │  │ Campaign   │ │ Template   │ │   User     │ │   List     │   │    │
│  │  │  Tools     │ │  Tools     │ │  Tools     │ │  Tools     │   │    │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │    │
│  │                                                                  │    │
│  │  ┌────────────────────────────────────────────────────────────┐ │    │
│  │  │                    Tool Filter                              │ │    │
│  │  │  (PII gating, write gating, send gating)                   │ │    │
│  │  └────────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────┬───────────────────────────────┘    │
│                                     │                                    │
│  ┌──────────────────────────────────▼───────────────────────────────┐   │
│  │                    IterableClient                                 │   │
│  │              (fetch-based, Workers-compatible)                    │   │
│  │                                                                   │   │
│  │  - Uses native fetch() API                                        │   │
│  │  - Reuses Zod schemas from @iterable/api                         │   │
│  │  - Handles auth via X-Api-Key header                             │   │
│  └──────────────────────────────────┬───────────────────────────────┘   │
│                                     │                                    │
└─────────────────────────────────────┼────────────────────────────────────┘
                                      │ HTTPS (native fetch)
                                      ▼
                          ┌──────────────────────┐
                          │    Iterable API      │
                          │  api.iterable.com    │
                          │  api.eu.iterable.com │
                          └──────────────────────┘
```

---

## Key Design Decisions

### 1. Transport Layer

| Aspect | Original | Workers Version |
|--------|----------|-----------------|
| Transport | stdio | HTTP/SSE |
| MCP SDK Class | `Server` + `StdioServerTransport` | `McpAgent` (Cloudflare Agents SDK) |
| Endpoints | N/A (local process) | `/mcp` (streamable), `/sse` (legacy) |

**Cloudflare's `McpAgent`** extends their Agents SDK and handles:
- HTTP request routing
- SSE connection management
- Session state via Durable Objects
- MCP protocol serialization

### 2. HTTP Client

| Aspect | Original | Workers Version |
|--------|----------|-----------------|
| Client | `@iterable/api` (axios) | Custom `IterableClient` (fetch) |
| HTTP Library | axios | Native `fetch()` |
| Schemas | Zod (from @iterable/api) | Zod (imported from @iterable/api) |

**Why custom client:**
- `@iterable/api` uses axios which depends on Node.js `http`/`https` modules
- Cloudflare Workers only support native `fetch()`
- **We import and reuse the Zod schemas directly from `@iterable/api`** - they're pure Zod with no Node dependencies

**What we reuse from `@iterable/api`:**
```typescript
// These imports work in Workers - pure Zod schemas
import {
  GetCampaignsParamsSchema,
  GetCampaignsResponseSchema,
  CampaignDetailsSchema,
  // ... all other schemas
} from "@iterable/api";
```

**What we replace:**
```typescript
// Original (won't work in Workers)
import { IterableClient } from "@iterable/api";  // Uses axios

// Our replacement (fetch-based)
import { IterableClient } from "./client/iterable";  // Uses fetch
```

### 3. Authentication

| Aspect | Original | Workers Version |
|--------|----------|-----------------|
| Key Storage | Local encrypted file (KeyManager) | Cloudflare Secrets / Request header |
| Multi-tenant | Single key per install | Per-request key support |

**Three authentication modes:**

```typescript
// Mode 1: Environment secret (single tenant)
// Set via: wrangler secret put ITERABLE_API_KEY
const apiKey = env.ITERABLE_API_KEY;

// Mode 2: Per-request header (multi-tenant)
const apiKey = request.headers.get("X-Iterable-Api-Key");

// Mode 3: Per-request query param (convenience)
const apiKey = url.searchParams.get("api_key");
```

### 4. Tool Filtering

Preserved from original implementation:

```typescript
// Environment variables control tool availability
ITERABLE_USER_PII=false     // Block tools that expose user PII
ITERABLE_ENABLE_WRITES=false // Block tools that modify data
ITERABLE_ENABLE_SENDS=false  // Block tools that send messages
```

Tool categories (from `tool-filter.ts`):
- **NON_PII_TOOLS** - Safe tools that don't expose user data
- **READ_ONLY_TOOLS** - Tools that only read data
- **SEND_TOOLS** - Tools that can trigger message sends

---

## Component Details

### IterableMcpAgent

The main MCP server class extending Cloudflare's `McpAgent`:

```typescript
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class IterableMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: "iterable-mcp",
    version: "1.0.0",
  });

  async init() {
    const client = new IterableClient({
      apiKey: this.env.ITERABLE_API_KEY,
      baseUrl: this.env.ITERABLE_API_BASE_URL || "https://api.iterable.com",
    });

    // Register tools directly on the server
    // Example: get_campaigns tool
    this.server.tool(
      "get_campaigns",
      { page: z.number().optional(), pageSize: z.number().optional() },
      async (params) => {
        const result = await client.getCampaigns(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
    );

    // ... more tools registered here
  }
}

// Worker entry point with routing
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // SSE transport (legacy, for compatibility)
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return IterableMcpAgent.serveSSE("/sse").fetch(request, env, ctx);
    }

    // Streamable HTTP transport (recommended)
    if (url.pathname === "/mcp") {
      return IterableMcpAgent.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Iterable MCP Server. Use /mcp or /sse endpoint.", {
      status: 200,
    });
  },
};
```

### IterableClient

Fetch-based API client:

```typescript
export class IterableClient {
  constructor(private config: { apiKey: string; baseUrl: string }) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        "Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Iterable API error: ${response.status}`);
    }

    return response.json();
  }

  // Campaign methods
  async getCampaigns(params?: GetCampaignsParams) { ... }
  async getCampaign(id: number) { ... }

  // Template methods
  async getTemplates(params?: GetTemplatesParams) { ... }
  async getEmailTemplate(params: GetTemplateParams) { ... }

  // User methods
  async getUserByEmail(email: string) { ... }
  async getUserEvents(email: string) { ... }
}
```

### Tool Registration

Tools are registered using Cloudflare's McpServer API:

```typescript
// Using Zod schemas from @iterable/api
import { GetCampaignsParamsSchema } from "@iterable/api";

server.tool(
  "get_campaigns",
  "Retrieve campaigns with optional filtering",
  zodToJsonSchema(GetCampaignsParamsSchema),
  async (params) => {
    const result = await client.getCampaigns(params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

---

## Request Flow

```
1. Client Request
   │
   ▼
2. Cloudflare Edge (nearest PoP)
   │
   ▼
3. Worker receives request at /mcp or /sse
   │
   ▼
4. Extract API key from:
   - env.ITERABLE_API_KEY (default)
   - X-Iterable-Api-Key header (override)
   - ?api_key query param (override)
   │
   ▼
5. McpAgent handles MCP protocol
   │
   ▼
6. Tool invocation with validated params
   │
   ▼
7. IterableClient makes fetch() to Iterable API
   │
   ▼
8. Response formatted as MCP tool result
   │
   ▼
9. Returned to client via HTTP/SSE
```

---

## File Structure

```
src/
├── index.ts                 # Worker entry point + McpAgent export
├── client/
│   └── iterable.ts          # Fetch-based Iterable API client
├── tools/
│   ├── index.ts             # Tool registration aggregator
│   ├── campaigns.ts         # Campaign tools
│   ├── templates.ts         # Template tools
│   ├── users.ts             # User tools
│   ├── lists.ts             # List tools
│   └── filter.ts            # Tool filtering logic
└── types/
    └── env.ts               # Cloudflare env type definitions

wrangler.jsonc               # Cloudflare Workers configuration
package.json
tsconfig.json
.dev.vars.example            # Example local env vars
```

---

## Differences from Original

| Feature | Original @iterable/mcp | Workers Version |
|---------|------------------------|-----------------|
| Runtime | Node.js 20+ | Cloudflare Workers |
| Transport | stdio | HTTP/SSE |
| HTTP Client | axios | fetch |
| Key Storage | Encrypted local file | Cloudflare Secrets |
| Multi-tenant | No | Yes (per-request keys) |
| Deployment | `npx @iterable/mcp` | `wrangler deploy` |
| Cold Start | ~500ms (Node startup) | ~5ms (Workers) |
| Global Distribution | No (local only) | Yes (Cloudflare edge) |
| Setup Wizard | Interactive CLI | Manual config |
| Client Detection | Auto-detects Claude/Cursor | N/A (remote) |

---

## What We Reuse from Original

### From `@iterable/api` (npm package)
```typescript
// All Zod schemas - these are pure Zod with zero Node.js dependencies
import {
  // Campaign schemas
  GetCampaignsParamsSchema,
  GetCampaignParamsSchema,
  CampaignDetailsSchema,

  // Template schemas
  GetTemplatesParamsSchema,
  GetTemplateParamsSchema,
  UpsertEmailTemplateParamsSchema,

  // User schemas
  GetUserByEmailParamsSchema,
  UpdateUserParamsSchema,

  // ... 50+ more schemas
} from "@iterable/api";
```

### From `@iterable/mcp` (reference implementation)
- **Tool names and descriptions** - Maintain API compatibility
- **Tool filtering logic** - PII/write/send permission gating
- **Tool categories** - `NON_PII_TOOLS`, `READ_ONLY_TOOLS`, `SEND_TOOLS`

---

## What We Build New

1. **IterableClient** - Fetch-based replacement for axios client
2. **McpAgent Integration** - Cloudflare's MCP server class
3. **Auth Middleware** - Per-request API key support
4. **Worker Entry Point** - HTTP routing and request handling

---

## Dependency Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Our Cloudflare Worker                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────┐         │
│  │   @iterable/api      │     │  agents (cloudflare) │         │
│  │   (schemas only)     │     │  (McpAgent class)    │         │
│  │                      │     │                      │         │
│  │  ✓ Zod schemas       │     │  ✓ HTTP transport    │         │
│  │  ✓ Type definitions  │     │  ✓ SSE handling      │         │
│  │  ✗ IterableClient    │     │  ✓ MCP protocol      │         │
│  │    (uses axios)      │     │                      │         │
│  └──────────────────────┘     └──────────────────────┘         │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────┐         │
│  │ @modelcontextprotocol│     │  Our code            │         │
│  │ /sdk                 │     │                      │         │
│  │                      │     │  ✓ IterableClient    │         │
│  │  ✓ McpServer         │     │    (fetch-based)     │         │
│  │  ✓ Tool types        │     │  ✓ Tool registration │         │
│  │  ✓ Protocol types    │     │  ✓ Auth handling     │         │
│  └──────────────────────┘     └──────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** We import `@iterable/api` for its Zod schemas only. The `IterableClient` class from that package uses axios and won't work - we create our own fetch-based version.

---

## Configuration

### Environment Variables

```bash
# Required
ITERABLE_API_KEY=your_api_key_here

# Optional (defaults shown)
ITERABLE_API_BASE_URL=https://api.iterable.com
ITERABLE_USER_PII=false
ITERABLE_ENABLE_WRITES=false
ITERABLE_ENABLE_SENDS=false
```

### wrangler.jsonc

```jsonc
{
  "name": "iterable-mcp-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-15",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "ITERABLE_USER_PII": "false",
    "ITERABLE_ENABLE_WRITES": "false",
    "ITERABLE_ENABLE_SENDS": "false",
    "ITERABLE_API_BASE_URL": "https://api.iterable.com"
  }
}
```

---

## Security Model

1. **API Key Isolation** - Keys never logged, never in responses
2. **Permission Defaults** - Most restrictive by default (no PII, no writes, no sends)
3. **HTTPS Enforced** - Cloudflare Workers only accept HTTPS
4. **Input Validation** - All inputs validated via Zod schemas
5. **No Persistent State** - Stateless by default, no data stored on Workers
