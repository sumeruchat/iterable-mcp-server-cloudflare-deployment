# Iterable MCP Server - Cloudflare Workers

Remote MCP server for Iterable that runs on Cloudflare Workers, enabling ChatGPT, Gemini CLI, and other web-based AI clients to connect to your Iterable account.

## Features

- ✅ **Remote MCP Server** - HTTP/SSE transport for web clients
- ✅ **30+ Read Tools** - Campaigns, templates, users, lists, journeys, etc.
- ✅ **Permission Gating** - PII, write, and send restrictions
- ✅ **Multi-tenant** - Per-request API keys or environment secrets
- ✅ **Global Edge** - Deployed on Cloudflare's network
- ✅ **Zero Ops** - No servers to maintain

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key (Optional for Testing)

For local development, you can optionally create `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
# Edit and add: ITERABLE_API_KEY=your_test_key
```

**Note:** In production, users provide their OWN API keys when connecting (see Client Integration section).

### 3. Run Locally

```bash
npm run dev
```

The server will start at `http://localhost:8788`

### 4. Test with MCP Inspector

In another terminal:

```bash
npx @modelcontextprotocol/inspector@latest
```

Open http://localhost:5173 and connect to `http://localhost:8788/mcp`

## Deployment

### Deploy to Cloudflare Workers

```bash
npm run deploy
```

Your server will be live at `https://iterable-mcp-server.your-account.workers.dev`

**No API key needed on the server** - users provide their own keys when connecting!

### Test Deployed Server

```bash
curl https://iterable-mcp-server.your-account.workers.dev
```

## Client Integration

### Gemini CLI (Primary Test Target)

Edit `~/.gemini/settings.json` (or copy from `gemini-settings.json.example`):

```json
{
  "mcpServers": {
    "iterable": {
      "httpUrl": "https://iterable-mcp-server.your-account.workers.dev/mcp?api_key=YOUR_ITERABLE_API_KEY"
    }
  }
}
```

Replace `YOUR_ITERABLE_API_KEY` with your actual Iterable API key.

Test:
```bash
gemini
# Ask: "What campaigns do I have in Iterable?"
```

### ChatGPT (Requires Pro)

1. Enable **Developer Mode** in ChatGPT Settings
2. Navigate to **Settings > Connectors > Create**
3. Enter URL: `https://iterable-mcp-server.your-account.workers.dev/sse`
4. Test by asking: "List my Iterable campaigns"

### Claude Code / Cursor (via mcp-remote)

Add to your Claude Code/Cursor config:

```json
{
  "mcpServers": {
    "iterable": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://iterable-mcp-server.your-account.workers.dev/sse"
      ]
    }
  }
}
```

## Available Tools

### Campaign Tools (9)
- `get_campaigns` - List all campaigns with filtering
- `get_campaign` - Get specific campaign details
- `get_campaign_metrics` - Get campaign performance metrics
- `get_child_campaigns` - Get child campaigns of recurring campaign

### Template Tools (6)
- `get_templates` - List all templates
- `get_email_template` - Get email template by ID
- `get_sms_template` - Get SMS template by ID
- `get_push_template` - Get push template by ID
- `get_inapp_template` - Get in-app template by ID
- `get_template_by_client_id` - Get template by client ID

### User Tools (6)
- `get_user_by_email` - Look up user by email
- `get_user_by_user_id` - Look up user by user ID
- `get_user_fields` - Get all user data fields
- `get_sent_messages` - Get messages sent to a user
- `get_user_events_by_email` - Get user events by email
- `get_user_events_by_user_id` - Get user events by user ID

### List Tools (3)
- `get_lists` - Get all subscriber lists
- `get_list_size` - Get user count in a list
- `get_list_users` - Get users in a list

### Other Tools (10)
- `get_channels` - Get message channels
- `get_message_types` - Get message types
- `get_journeys` - Get all journeys
- `get_experiment_metrics` - Get experiment metrics
- `get_webhooks` - Get webhooks
- `get_snippets` - Get code snippets
- `get_snippet` - Get specific snippet
- `get_catalogs` - Get all catalogs
- `get_catalog_items` - Get items from catalog
- `get_catalog_item` - Get specific catalog item

**Total: 34 read-only tools**

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ITERABLE_API_KEY` | ✅ | - | Your Iterable API key |
| `ITERABLE_API_BASE_URL` | ❌ | `https://api.iterable.com` | API endpoint (use `https://api.eu.iterable.com` for EU) |
| `ITERABLE_USER_PII` | ❌ | `false` | Enable tools that expose user PII |
| `ITERABLE_ENABLE_WRITES` | ❌ | `false` | Enable tools that modify data |
| `ITERABLE_ENABLE_SENDS` | ❌ | `false` | Enable tools that send messages |

### Security Defaults

By default, the server is configured in **safe read-only mode**:
- ❌ No user PII exposure
- ❌ No write operations
- ❌ No message sends

To enable elevated capabilities:

```bash
wrangler secret put ITERABLE_USER_PII
# Enter: true

wrangler secret put ITERABLE_ENABLE_WRITES
# Enter: true
```

## Testing

### Unit Tests

```bash
npm run test
```

### Integration Tests (requires deployed server)

```bash
# Run with API key as argument
npm run integration -- --api-key your_iterable_api_key
```

### Type Checking

```bash
npm run typecheck
```

## Architecture

This server is a **remote MCP server** that:

1. Runs on Cloudflare Workers (global edge network)
2. Uses native `fetch()` instead of axios (Workers-compatible)
3. Imports Zod schemas from `@iterable/api` for validation
4. Exposes tools via HTTP (`/mcp`) and SSE (`/sse`) transports
5. Filters tools based on permission configuration

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design decisions.

## Comparison with Official MCP Server

| Feature | @iterable/mcp (local) | This Server (remote) |
|---------|----------------------|---------------------|
| Runtime | Node.js 20+ | Cloudflare Workers |
| Transport | stdio | HTTP/SSE |
| Deployment | `npx @iterable/mcp` | `wrangler deploy` |
| Clients | Claude Desktop, Cursor | ChatGPT, Gemini CLI, Claude (via proxy) |
| Cold Start | ~500ms | ~5ms |
| Distribution | Local only | Global edge |
| Multi-tenant | No | Yes (per-request keys) |

## Troubleshooting

### "API key required" error

Make sure you've set the API key:

```bash
# For local dev
echo 'ITERABLE_API_KEY="your_key"' > .dev.vars

# For production
wrangler secret put ITERABLE_API_KEY
```

### "Tool not available" error

Check your permission settings. Some tools require elevated permissions:

- User PII tools: `ITERABLE_USER_PII=true`
- Write tools: `ITERABLE_ENABLE_WRITES=true`
- Send tools: `ITERABLE_ENABLE_SENDS=true`

### EU Region

If your Iterable account is in the EU region:

```bash
wrangler secret put ITERABLE_API_BASE_URL
# Enter: https://api.eu.iterable.com
```

## Contributing

See [SPEC.md](./SPEC.md) for the full specification and [ARCHITECTURE.md](./ARCHITECTURE.md) for design details.

## License

MIT

## Credits

- Based on [@iterable/mcp](https://github.com/Iterable/mcp-server) by Greg Methvin
- Uses [@iterable/api](https://github.com/Iterable/api-client) for Zod schemas
- Built with [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
