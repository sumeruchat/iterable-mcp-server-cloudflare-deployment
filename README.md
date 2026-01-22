# Iterable MCP Server - Cloudflare Workers

Remote MCP server for Iterable that runs on Cloudflare Workers, enabling ChatGPT, Gemini CLI, and other web-based AI clients to connect to your Iterable account.

## Features

- ✅ **Remote MCP Server** - HTTP/SSE transport for web clients
- ✅ **23+ Read-Only Tools** - Campaigns, templates, users, lists, journeys, etc.
- ✅ **Secure Authentication** - API key via headers (encrypted in transit)
- ✅ **Permission Gating** - PII, write, and send restrictions
- ✅ **Multi-tenant** - Each user provides their own API key
- ✅ **Global Edge** - Deployed on Cloudflare's network

## Quick Start - Connect to Public Server

No deployment required! Use our public server to get started immediately.

> **Important:** Gemini web (gemini.google.com) does **not** currently support custom MCP servers. Use **Gemini CLI** or **ChatGPT** instead.

---

### Option 1: ChatGPT (Plus, Pro, Team, or Enterprise)

ChatGPT supports MCP servers via Connectors in Developer Mode.

**Steps:**

1. **Enable Developer Mode**
   - Open [ChatGPT](https://chat.openai.com)
   - Go to **Settings** (gear icon) → **Connectors** → **Advanced**
   - Toggle on **Developer Mode**

2. **Create a Connector**
   - Click the **+** icon in the chat panel
   - Select **Developer Mode** → **Add sources**
   - Or go to **Settings** → **Connectors** → **Create**

3. **Configure the Connector**
   - **Name:** `Iterable`
   - **Server URL:** `https://iterable-mcp-server.nodemaker.workers.dev/sse?api_key=YOUR_ITERABLE_API_KEY`
   - Check ✅ **"I trust this provider"**
   - Click **Create**

4. **Use It**
   - Start a new chat and select **Developer Mode** from the model dropdown
   - Select your **Iterable** connector
   - Ask: *"List my Iterable campaigns"*

> **Note:** Replace `YOUR_ITERABLE_API_KEY` with your actual [Iterable API key](https://support.iterable.com/hc/en-us/articles/360043464871-API-Keys).

---

### Option 2: Gemini CLI

Gemini CLI supports MCP servers with custom headers for secure authentication.

**Steps:**

1. **Install Gemini CLI** (if not already installed)
   ```bash
   npm install -g @anthropic-ai/gemini-cli
   ```

2. **Configure MCP Server**

   Edit `~/.gemini/settings.json` (create if it doesn't exist):

   ```json
   {
     "mcpServers": {
       "iterable": {
         "httpUrl": "https://iterable-mcp-server.nodemaker.workers.dev/mcp",
         "headers": {
           "X-Iterable-Api-Key": "YOUR_ITERABLE_API_KEY"
         }
       }
     }
   }
   ```

   Or use environment variable interpolation:

   ```json
   {
     "mcpServers": {
       "iterable": {
         "httpUrl": "https://iterable-mcp-server.nodemaker.workers.dev/mcp",
         "headers": {
           "X-Iterable-Api-Key": "$ITERABLE_API_KEY"
         }
       }
     }
   }
   ```

   Then set the environment variable:
   ```bash
   export ITERABLE_API_KEY="your_actual_api_key"
   ```

3. **Use It**
   ```bash
   gemini
   # Ask: "What campaigns do I have in Iterable?"
   ```

**Alternative: Add via Command Line**
```bash
gemini mcp add iterable \
  --http-url "https://iterable-mcp-server.nodemaker.workers.dev/mcp" \
  --header "X-Iterable-Api-Key: YOUR_ITERABLE_API_KEY"
```

---

### Option 3: Claude Desktop / Cursor (via mcp-remote)

For Claude Desktop or Cursor, use the `mcp-remote` proxy:

**Claude Desktop** (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "iterable": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://iterable-mcp-server.nodemaker.workers.dev/sse",
        "--header",
        "X-Iterable-Api-Key: YOUR_ITERABLE_API_KEY"
      ]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "iterable": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://iterable-mcp-server.nodemaker.workers.dev/sse",
        "--header",
        "X-Iterable-Api-Key: YOUR_ITERABLE_API_KEY"
      ]
    }
  }
}
```

---

## Authentication

The server supports two methods for passing your Iterable API key:

| Method | How to Use | Security |
|--------|------------|----------|
| **Header** | `X-Iterable-Api-Key: YOUR_KEY` | ✅ Encrypted in HTTPS |
| **URL Parameter** | `?api_key=YOUR_KEY` | ⚠️ May appear in logs |

**Recommendation:** Use headers when possible (Gemini CLI, Claude Desktop). Use URL parameters for ChatGPT (required by their connector format).

### Security Considerations

URL parameters can appear in:
- Server access logs
- Browser history
- Proxy logs

Headers are encrypted during HTTPS transit and are the more secure option when your client supports them.

---

## Available Tools

### Campaign Tools
- `get_campaigns` - List all campaigns with filtering
- `get_campaign` - Get specific campaign details
- `get_campaign_metrics` - Get campaign performance metrics
- `get_child_campaigns` - Get child campaigns of recurring campaign

### Template Tools
- `get_templates` - List all templates
- `get_email_template` - Get email template by ID
- `get_sms_template` - Get SMS template by ID
- `get_push_template` - Get push template by ID
- `get_inapp_template` - Get in-app template by ID
- `get_template_by_client_id` - Get template by client ID

### User Tools
- `get_user_by_email` - Look up user by email *(requires PII permission)*
- `get_user_by_user_id` - Look up user by user ID *(requires PII permission)*
- `get_user_fields` - Get all user data fields
- `get_sent_messages` - Get messages sent to a user *(requires PII permission)*
- `get_user_events_by_email` - Get user events *(requires PII permission)*
- `get_user_events_by_user_id` - Get user events *(requires PII permission)*

### List Tools
- `get_lists` - Get all subscriber lists
- `get_list_size` - Get user count in a list
- `get_list_users` - Get users in a list *(requires PII permission)*

### Other Tools
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

---

## Platform Support

| Platform | Support | Auth Method | Notes |
|----------|---------|-------------|-------|
| **ChatGPT** | ✅ Full | URL parameter | Plus, Pro, Team, or Enterprise |
| **Gemini CLI** | ✅ Full | Headers | Most secure option |
| **Gemini Web** | ❌ None | - | Does not support custom MCP servers |
| **Claude Desktop** | ✅ Via proxy | Headers | Use mcp-remote |
| **Cursor** | ✅ Via proxy | Headers | Use mcp-remote |

---

## Deploy Your Own Server

### 1. Clone and Install

```bash
git clone https://github.com/your-org/iterable-mcp-server-cloudflare
cd iterable-mcp-server-cloudflare
npm install
```

### 2. Run Locally

```bash
# Create .env file with your API key for testing
echo 'ITERABLE_API_KEY=your_api_key' > .env

# Start local server
npm run dev
```

The server will start at `http://localhost:8788`

### 3. Deploy to Cloudflare

```bash
npm run deploy
```

Your server will be live at `https://iterable-mcp-server.your-account.workers.dev`

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ITERABLE_API_BASE_URL` | ❌ | `https://api.iterable.com` | Use `https://api.eu.iterable.com` for EU |
| `ITERABLE_USER_PII` | ❌ | `false` | Enable tools that expose user PII |
| `ITERABLE_ENABLE_WRITES` | ❌ | `false` | Enable tools that modify data |
| `ITERABLE_ENABLE_SENDS` | ❌ | `false` | Enable tools that send messages |

### Security Defaults

By default, the server runs in **safe read-only mode**:
- ❌ No user PII exposure
- ❌ No write operations
- ❌ No message sends

To enable elevated capabilities on your own deployment:

```bash
wrangler secret put ITERABLE_USER_PII
# Enter: true
```

---

## Testing

```bash
# Unit tests
npm test

# Integration tests (local)
echo 'ITERABLE_API_KEY=your_api_key' > .env
npm run integration:local

# Integration tests (remote)
npm run integration:remote
```

---

## Troubleshooting

### "API key required" error

Make sure you're passing the API key:

```bash
# Via header (recommended)
curl -H 'X-Iterable-Api-Key: YOUR_KEY' \
  https://iterable-mcp-server.nodemaker.workers.dev/mcp

# Via URL parameter
curl 'https://iterable-mcp-server.nodemaker.workers.dev/mcp?api_key=YOUR_KEY'
```

### ChatGPT says "Server rejected"

1. Make sure Developer Mode is enabled
2. Verify your URL includes the API key: `...?api_key=YOUR_KEY`
3. Check that you're using the `/sse` endpoint for ChatGPT

### Gemini CLI not connecting

1. Validate your `settings.json` is valid JSON (no trailing commas)
2. Check the file location: `~/.gemini/settings.json`
3. Verify your API key is correct

### EU Region

If your Iterable account is in the EU region, deploy your own server:

```bash
wrangler secret put ITERABLE_API_BASE_URL
# Enter: https://api.eu.iterable.com
```

---

## License

MIT

## Credits

- Based on [@iterable/mcp](https://github.com/Iterable/mcp-server) by Greg Methvin
- Built with [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)

## References

- [OpenAI MCP Documentation](https://platform.openai.com/docs/guides/tools-connectors-mcp)
- [Gemini CLI MCP Server Docs](https://geminicli.com/docs/tools/mcp-server/)
- [Iterable API Documentation](https://api.iterable.com/api/docs)
