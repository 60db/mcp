/**
 * Text-to-Speech (TTS) Tools
 * Tools for TTS synthesis and history
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  TTSSynthesizeSchema,
  TTSLogsSchema,
  TTSGetSchema
} from "../schemas/index.js";
import {
  TTSSynthesizeParams,
  TTSLogsParams,
  TTSGetParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatTTSLog,
  formatTTSLogList,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register TTS tools
 */
export function registerTTSTools(server: McpServer): void {
  // Synthesize speech
  server.registerTool(
    "sixtydb_tts_synthesize",
    {
      title: "Synthesize Text-to-Speech",
      description: `Convert text to speech using the specified voice.

This tool generates audio from text using any available voice in the QLabs platform. Supports customizing speed, stability, similarity, and output format. **Note: This operation requires credits based on text length.**

**Parameters:**
- text (string, required): Text to convert to speech (max 5000 characters)
- voice_id (string, required): ID of the voice to use for synthesis
- speed (number, optional): Speech speed multiplier (0.25-2.0, default: 1)
- stability (number, optional): Voice stability 0-100 (default: 50)
- similarity (number, optional): Voice similarity 0-100 (default: 75)
- output_format (string, optional): Audio output format: 'mp3', 'wav', or 'ogg' (default: 'mp3')
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Audio URL and generation details
- Credit usage and duration information

For JSON format:
{
  "id": string,              // Generation ID
  "audio_url": string,       // URL to download generated audio
  "text": string,            // Original text
  "voice_id": string,        // Voice used
  "duration": number,        // Audio duration in seconds
  "credits_used": number,    // Credits charged
  "created_at": string       // Generation timestamp
}

**Examples:**
- Basic synthesis: { "text": "Hello, world!", "voice_id": "voice_abc123" }
- With custom speed: { "text": "Speak slowly", "voice_id": "voice_abc123", "speed": 0.8 }
- More expressive: { "text": "Exciting news!", "voice_id": "voice_abc123", "stability": 30 }
- Higher similarity: { "text": "Clone match", "voice_id": "voice_abc123", "similarity": 90 }
- WAV format: { "text": "High quality", "voice_id": "voice_abc123", "output_format": "wav" }

**Credit Cost:**
- Approximately 1 credit per 100 characters
- Varies by voice type (standard vs cloned)
- Speed, stability, and similarity adjustments don't affect cost

**Audio Quality:**
- MP3: Good quality, smaller file size (recommended)
- WAV: Highest quality, larger file size
- OGG: Good compression, open format

**Error Handling:**
- Returns "Error: Insufficient credits" if account balance is too low
- Returns "Error: Voice not found" if voice_id is invalid
- Returns "Error: Text too long" if text exceeds 5000 characters
- Returns "Error: Rate limit exceeded" if too many requests (429 status)`,
      inputSchema: TTSSynthesizeSchema,
      annotations: {
        title: "Synthesize Text-to-Speech",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: TTSSynthesizeParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          text: params.text,
          voice_id: params.voice_id,
          speed: params.speed ?? 1,
          stability: params.stability ?? 50,
          similarity: params.similarity ?? 75
        };

        // Response comes as concatenated JSON chunks, each like {"result":{"audioContent":"..."}}
        const axiosInstance = apiClient.getAxiosInstance();
        const response = await axiosInstance.post<string>(
          "/tts-synthesize",
          requestBody,
          { responseType: "text" }
        );

        const raw = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

        // Parse concatenated JSON objects by splitting on `}{` boundaries
        const jsonStrings = raw
          .replace(/\}\s*\{/g, "}|{")
          .split("|");

        const audioChunks: string[] = [];
        for (const chunk of jsonStrings) {
          try {
            const parsed = JSON.parse(chunk.trim());
            if (parsed.result?.audioContent) {
              audioChunks.push(parsed.result.audioContent);
            }
          } catch {
            // Skip unparseable chunks
          }
        }

        const audioContent = audioChunks.join("");
        if (!audioContent) {
          throw new Error("No audio content received from TTS API");
        }

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                audioContent,
                text: params.text,
                voice_id: params.voice_id
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: `## TTS Synthesis Complete\n\n**Text:** ${params.text}\n**Voice ID:** ${params.voice_id}\n**Speed:** ${requestBody.speed}\n**Stability:** ${requestBody.stability}\n**Similarity:** ${requestBody.similarity}\n\nAudio content received (${audioChunks.length} chunks, ${audioContent.length} characters of base64 audio).`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: formatErrorMessage(error as Error)
          }]
        };
      }
    }
  );

  // Get TTS history/logs
  server.registerTool(
    "sixtydb_tts_logs",
    {
      title: "Get TTS History",
      description: `Retrieve TTS generation history with filtering and pagination.

This tool provides a complete history of all TTS generations made through the account, including credit usage and audio URLs for past syntheses.

**Parameters:**
- voice_id (string, optional): Filter by specific voice ID
- from_date (string, optional): Filter by start date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z')
- to_date (string, optional): Filter by end date (ISO 8601 format)
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of TTS generations with details
- Each entry shows text preview, voice, duration, credits, and date

For JSON format:
{
  "total": number,           // Total number of generations
  "count": number,           // Number in this response
  "offset": number,          // Current pagination offset
  "logs": [                  // Array of TTS log entries
    {
      "id": string,          // Generation ID
      "text": string,        // Original text
      "voice_id": string,    // Voice used
      "voice_name": string,  // Voice name
      "audio_url": string,   // Audio download URL
      "duration": number,    // Duration in seconds
      "credits_used": number,// Credits charged
      "created_at": string   // Generation timestamp
    }
  ],
  "has_more": boolean,       // Whether more results exist
  "next_offset": number      // Next page offset
}

**Examples:**
- Recent generations: { "limit": 10 }
- Filter by voice: { "voice_id": "voice_abc123" }
- Date range: { "from_date": "2024-01-01T00:00:00Z", "to_date": "2024-01-31T23:59:59Z" }
- Paginate through results: { "offset": 20, "limit": 20 }

**Use Cases:**
- Track TTS usage and credit spending
- Find previously generated audio
- Analyze voice usage patterns
- Audit generation history

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid
- Returns "Error: Invalid date format" for malformed date parameters`,
      inputSchema: TTSLogsSchema,
      annotations: {
        title: "Get TTS History",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: TTSLogsParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.voice_id) queryParams.voice_id = params.voice_id;
        if (params.from_date) queryParams.from_date = params.from_date;
        if (params.to_date) queryParams.to_date = params.to_date;

        const data = await apiClient.get<{
          logs: unknown[];
          total: number;
        }>("/tts/logs", queryParams);

        const logs = data.logs || [];
        const total = data.total || logs.length;
        const hasMore = params.offset + logs.length < total;

        const formatted = formatTTSLogList(
          logs as any,
          total,
          params.offset,
          hasMore,
          params.response_format
        );

        const { content } = truncateIfNeeded(
          formatted,
          params.response_format === ResponseFormat.JSON
        );

        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: formatErrorMessage(error as Error)
          }]
        };
      }
    }
  );

  // Get TTS details
  server.registerTool(
    "sixtydb_tts_get",
    {
      title: "Get TTS Generation Details",
      description: `Get detailed information about a specific TTS generation.

This tool retrieves complete details for a single TTS generation including the original text, audio URL, duration, and credit usage.

**Parameters:**
- id (string, required): TTS generation ID
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Complete generation details with audio URL
- Shows full text, voice used, duration, and credits

For JSON format:
{
  "id": string,              // Generation ID
  "text": string,            // Full original text
  "voice_id": string,        // Voice ID used
  "voice_name": string,      // Voice name
  "audio_url": string,       // Audio download URL
  "duration": number,        // Duration in seconds
  "credits_used": number,    // Credits charged
  "created_at": string       // Generation timestamp
}

**Examples:**
- Get generation details: { "id": "tts_abc123" }

**Use Cases:**
- Retrieve audio URL for download
- Review generation parameters
- Check credit usage for specific generation
- Access original text

**Error Handling:**
- Returns "Error: Generation not found" if ID doesn't exist (404 status)
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: TTSGetSchema,
      annotations: {
        title: "Get TTS Generation Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: TTSGetParams) => {
      try {
        const apiClient = getApiClient();

        const log = await apiClient.get<unknown>(`/tts/${params.id}`);

        const formatted = formatTTSLog(log as any, params.response_format);

        const { content } = truncateIfNeeded(
          formatted,
          params.response_format === ResponseFormat.JSON
        );

        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: formatErrorMessage(error as Error)
          }]
        };
      }
    }
  );
}
