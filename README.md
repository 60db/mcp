# QLabs MCP Server

Model Context Protocol (MCP) server for the QLabs Voice AI Platform. This server exposes comprehensive tools for text-to-speech, speech-to-text, voice cloning, meeting management, workspace collaboration, and billing operations.

## Features

- **Voice Management**: List, retrieve, and create cloned voices
- **Text-to-Speech (TTS)**: Synthesize speech with custom voices, speed, stability, and similarity
- **Speech-to-Text (STT)**: Transcribe audio with speaker diarization and timestamps
- **Workspace Management**: Create and manage team workspaces
- **60DB Integration**: Dictionary, snippets, and notes for enhanced transcriptions
- **Meeting Management**: Record meetings with AI-generated notes and summaries
- **Analytics**: Track usage statistics and credit consumption
- **Billing**: View plans, subscriptions, and invoices

## Installation

```bash
npm install
npm run build
```

## Configuration

Set required environment variables:

```bash
# Authentication (required - one of these)
export QLABS_API_KEY=sk_your_api_key_here
# OR
export QLABS_JWT_TOKEN=your_jwt_token_here

# Optional: API base URL (default: http://localhost:3000)
export QLABS_API_BASE_URL=https://api.qlabs.com
```

## Usage

### Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Available Tools

#### Voice Management
- `qlabs_list_voices` - List available voices with filtering
- `qlabs_get_voice` - Get detailed voice information
- `qlabs_create_voice` - Create a cloned voice

#### Text-to-Speech
- `qlabs_tts_synthesize` - Convert text to speech
- `qlabs_tts_logs` - Get TTS generation history
- `qlabs_tts_get` - Get TTS generation details

#### Speech-to-Text
- `qlabs_stt_transcribe` - Transcribe audio to text
- `qlabs_stt_logs` - Get transcription history
- `qlabs_stt_get` - Get transcription details

#### Workspace Management
- `qlabs_list_workspaces` - List all workspaces
- `qlabs_get_workspace` - Get workspace details
- `qlabs_create_workspace` - Create a new workspace
- `qlabs_get_workspace_members` - List workspace members

#### 60DB Tools
- `qlabs_60db_list_dictionary` - List pronunciation dictionary entries
- `qlabs_60db_add_dictionary` - Add dictionary entry
- `qlabs_60db_list_snippets` - List text snippets
- `qlabs_60db_add_snippet` - Add text snippet
- `qlabs_60db_list_notes` - List personal notes
- `qlabs_60db_add_note` - Add personal note
- `qlabs_60db_get_note` - Get note details

#### Meeting Management
- `qlabs_list_meetings` - List meetings
- `qlabs_get_meeting` - Get meeting details
- `qlabs_create_meeting` - Create new meeting

#### Analytics
- `qlabs_get_usage_stats` - Get usage statistics

#### Billing
- `qlabs_list_plans` - List available subscription plans
- `qlabs_get_subscription` - Get current subscription details
- `qlabs_list_invoices` - List billing invoices
- `qlabs_get_invoice` - Get invoice details

## Response Formats

All tools support two response formats:

- **markdown** (default): Human-readable formatted output
- **json**: Machine-readable structured data

Example:
```json
{
  "voice_id": "voice_abc123",
  "text": "Hello, world!",
  "response_format": "json"
}
```

## Pagination

List tools support pagination:

- `limit`: Maximum results (1-100, default: 20)
- `offset`: Number of results to skip (default: 0)

Example:
```json
{
  "limit": 50,
  "offset": 0
}
```

## Examples

### List Voices

```json
{
  "language": "en-US",
  "is_public": true,
  "limit": 10
}
```

### Synthesize Speech

```json
{
  "text": "Hello, this is a test.",
  "voice_id": "voice_abc123",
  "speed": 1.0,
  "output_format": "mp3"
}
```

### Transcribe Audio

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "language": "en-US",
  "diarization": true,
  "punctuation": true
}
```

### Get Usage Statistics

```json
{
  "response_format": "markdown"
}
```

## Character Limits

Responses are automatically truncated at 25,000 characters to prevent overwhelming output. Truncated responses include a message with guidance on pagination.

## Error Handling

All tools return clear, actionable error messages:

- `Error: Authentication required` - Invalid or missing credentials
- `Error: Rate limit exceeded` - Too many requests (429 status)
- `Error: Resource not found` - Invalid ID (404 status)
- `Error: Insufficient credits` - Not enough credits for operation

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check
```

## Project Structure

```
qlabs-mcp-server/
├── src/
│   ├── index.ts           # Main entry point
│   ├── constants.ts       # Configuration constants
│   ├── types/            # TypeScript type definitions
│   ├── schemas/          # Zod validation schemas
│   ├── services/         # API client and formatters
│   └── tools/            # Tool implementations
│       ├── voices.ts
│       ├── tts.ts
│       ├── stt.ts
│       ├── workspaces.ts
│       ├── sixtydb.ts
│       ├── meetings.ts
│       └── billing.ts
├── dist/                 # Built JavaScript files
├── package.json
├── tsconfig.json
└── README.md
```

## Testing with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector
mcp-inspector node dist/index.js
```

## Claude Desktop Integration

Add to Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qlabs": {
      "command": "node",
      "args": ["/path/to/qlabs-mcp-server/dist/index.js"],
      "env": {
        "QLABS_API_KEY": "sk_your_api_key_here",
        "QLABS_API_BASE_URL": "https://api.qlabs.com"
      }
    }
  }
}
```

## License

MIT

## Support

For issues and questions, please contact QLabs support or visit the documentation at https://docs.qlabs.com
