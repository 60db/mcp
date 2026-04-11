# QLabs MCP Server - Real World Usage Guide

This guide shows you how to use the QLabs MCP Server in production scenarios with Claude Desktop, Cursor, and other MCP-compatible applications.

## Table of Contents

1. [Claude Desktop Integration](#claude-desktop-integration)
2. [Production API Keys](#production-api-keys)
3. [Cline/Cursor Integration](#clinecursor-integration)
4. [Command Line Usage](#command-line-usage)
5. [Common Use Cases](#common-use-cases)

---

## Claude Desktop Integration

### Step 1: Get Your Production API Key

Generate a production API key from your QLabs dashboard or use your existing key:
```bash
# Your production API key
sk_YOUR_API_KEY_HERE
```

### Step 2: Configure Claude Desktop

**macOS:**
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

### Step 3: Add MCP Server Configuration

```json
{
  "mcpServers": {
    "qlabs": {
      "command": "node",
      "args": ["/home/dev/EngneerMaster/YEAR2026/qlabs-api/qlabs-mcp-server/dist/index.js"],
      "env": {
        "QLABS_API_KEY": "sk_YOUR_API_KEY_HERE",
        "QLABS_API_BASE_URL": "https://api.qlabs.com"
      }
    }
  }
}
```

**Important:** Update the path to match your actual installation path.

### Step 4: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Reopen Claude Desktop
3. The MCP server will be available in your conversations

---

## Production API Keys

### Using Production API Key

For production use, update your configuration:

```json
{
  "mcpServers": {
    "qlabs": {
      "command": "node",
      "args": ["/path/to/qlabs-mcp-server/dist/index.js"],
      "env": {
        "QLABS_API_KEY": "sk_YOUR_API_KEY_HERE",
        "QLABS_API_BASE_URL": "https://api.qlabs.com"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `QLABS_API_KEY` | Yes* | Your production API key | `sk_live_...` |
| `QLABS_JWT_TOKEN` | Yes* | Alternative: JWT token | `eyJhbGci...` |
| `QLABS_API_BASE_URL` | No | API base URL (default: localhost:3000) | `https://api.qlabs.com` |

*Either API key or JWT token is required

---

## Cline/Cursor Integration

### Step 1: Install MCP Client

```bash
npm install -g @modelcontextprotocol/inspector
```

### Step 2: Create MCP Configuration

Create `.clinerules` or add to your Cursor settings:

```json
{
  "mcpServers": {
    "qlabs": {
      "command": "node",
      "args": ["~/qlabs-api/qlabs-mcp-server/dist/index.js"],
      "env": {
        "QLABS_API_KEY": "sk_YOUR_API_KEY_HERE",
        "QLABS_API_BASE_URL": "https://api.qlabs.com"
      }
    }
  }
}
```

---

## Command Line Usage

### Using MCP Inspector

```bash
# Set environment variables
export QLABS_API_KEY="sk_YOUR_API_KEY_HERE"
export QLABS_API_BASE_URL="https://api.qlabs.com"

# Run MCP Inspector
mcp-inspector node dist/index.js
```

### Direct JSON-RPC Calls

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
QLABS_API_KEY="sk_YOUR_API_KEY_HERE" \
QLABS_API_BASE_URL="https://api.qlabs.com" \
node dist/index.js
```

---

## Common Use Cases

### 1. Voice-Enhanced Content Creation

**Prompt to Claude:**
```
Use the qlabs_list_voices tool to find English voices, then synthesize
this text for a product demo: "Welcome to our amazing new product..."
```

**What happens:**
1. Claude calls `qlabs_list_voices` to get available voices
2. Claude calls `qlabs_tts_synthesize` with the best voice
3. You get a professional audio file

### 2. Meeting Transcription & Analysis

**Prompt to Claude:**
```
I have a meeting recording at https://mysite.com/meeting.mp3.
Please transcribe it using qlabs_stt_transcribe, then summarize
the key points and action items.
```

**What happens:**
1. Claude calls `qlabs_stt_transcribe` with the audio URL
2. Claude receives the full transcript with speaker diarization
3. Claude analyzes and summarizes the content

### 3. Multi-Language Content

**Prompt to Claude:**
```
Create Spanish and French versions of this announcement using
QLabs TTS: "Our new feature is now available!"
```

**What happens:**
1. Claude translates the text
2. Claude calls `qlabs_list_voices` for Spanish voices
3. Claude calls `qlabs_list_voices` for French voices
4. Claude synthesizes both versions

### 4. Voice Cloning for Personalization

**Prompt to Claude:**
```
Create a cloned voice from this sample: https://mysite.com/voice-sample.mp3
Name it "Professional Narrator" and use it to narrate this script...
```

**What happens:**
1. Claude calls `qlabs_create_voice` with the sample URL
2. Claude waits for processing (2-5 minutes)
3. Claude uses the new voice for synthesis

### 5. Workspace Analytics

**Prompt to Claude:**
```
Show me my QLabs usage statistics for this month and compare
it to my subscription plan limits.
```

**What happens:**
1. Claude calls `qlabs_get_usage_stats`
2. Claude calls `qlabs_get_subscription`
3. Claude provides a comprehensive analysis

### 6. 60DB Dictionary Management

**Prompt to Claude:**
```
Add pronunciation corrections for these technical terms to my
60DB dictionary: "Kubernetes", "Azure", "Microservices"
```

**What happens:**
1. Claude calls `qlabs_60db_add_dictionary` for each term
2. Future transcriptions will use correct pronunciation

---

## Production Deployment

### Option 1: Local Installation

```bash
# Build the server
cd qlabs-mcp-server
npm install
npm run build

# Configure Claude Desktop with absolute path
```

### Option 2: Global npm Package

```bash
# Install globally
cd qlabs-mcp-server
npm link

# Use in Claude Desktop config
{
  "mcpServers": {
    "qlabs": {
      "command": "qlabs-mcp-server",
      "env": {
        "QLABS_API_KEY": "sk_YOUR_API_KEY_HERE",
        "QLABS_API_BASE_URL": "https://api.qlabs.com"
      }
    }
  }
}
```

### Option 3: Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
ENV QLABS_API_BASE_URL=https://api.qlabs.com
ENTRYPOINT ["node", "dist/index.js"]
```

---

## Troubleshooting

### Claude Desktop Not Showing Tools

**Check:**
1. Claude Desktop is completely restarted (quit, not just closed)
2. Config file path is correct for your OS
3. API key is valid and not expired
4. Server path is absolute, not relative

### Authentication Errors

**Solutions:**
1. Verify API key is correct: `sk_YOUR_API_KEY_HERE`
2. Check API base URL: `https://api.qlabs.com`
3. Ensure API key has required permissions

### Tools Not Responding

**Debug:**
```bash
# Test server manually
export QLABS_API_KEY="your_key"
export QLABS_API_BASE_URL="https://api.qlabs.com"
node dist/index.js

# In another terminal, send test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  QLABS_API_KEY="your_key" node dist/index.js
```

---

## API Reference

### All Available Tools

**Voice Management (3):**
- `qlabs_list_voices` - List available voices
- `qlabs_get_voice` - Get voice details
- `qlabs_create_voice` - Clone a voice

**Text-to-Speech (3):**
- `qlabs_tts_synthesize` - Convert text to speech
- `qlabs_tts_logs` - Get TTS history
- `qlabs_tts_get` - Get TTS generation details

**Speech-to-Text (3):**
- `qlabs_stt_transcribe` - Transcribe audio
- `qlabs_stt_logs` - Get STT history
- `qlabs_stt_get` - Get transcription details

**Workspaces (4):**
- `qlabs_list_workspaces` - List workspaces
- `qlabs_get_workspace` - Get workspace details
- `qlabs_create_workspace` - Create workspace
- `qlabs_get_workspace_members` - List workspace members

**60DB Tools (7):**
- `qlabs_60db_list_dictionary` - List pronunciation entries
- `qlabs_60db_add_dictionary` - Add pronunciation entry
- `qlabs_60db_list_snippets` - List text snippets
- `qlabs_60db_add_snippet` - Add text snippet
- `qlabs_60db_list_notes` - List notes
- `qlabs_60db_add_note` - Add note
- `qlabs_60db_get_note` - Get note details

**Meetings (3):**
- `qlabs_list_meetings` - List meetings
- `qlabs_get_meeting` - Get meeting details
- `qlabs_create_meeting` - Create meeting

**Analytics (1):**
- `qlabs_get_usage_stats` - Get usage statistics

**Billing (4):**
- `qlabs_list_plans` - List subscription plans
- `qlabs_get_subscription` - Get current subscription
- `qlabs_list_invoices` - List invoices
- `qlabs_get_invoice` - Get invoice details

---

## Support

For issues and questions:
- Check API status: https://api.qlabs.com/health
- Review logs in Claude Desktop: Help > Developer > Show Logs
- Test with MCP Inspector: `mcp-inspector node dist/index.js`
