/**
 * Speech-to-Text (STT) Tools
 * Tools for STT transcription and history
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  STTTranscribeSchema,
  STTLogsSchema,
  STTGetSchema
} from "../schemas/index.js";
import {
  STTTranscribeParams,
  STTLogsParams,
  STTGetParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatSTTLog,
  formatSTTLogList,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register STT tools
 */
export function registerSTTTools(server: McpServer): void {
  // Transcribe audio
  server.registerTool(
    "sixtydb_stt_transcribe",
    {
      title: "Transcribe Audio",
      description: `Transcribe an audio file to text via \`POST /stt\`. Powered by 60db STT v01 — a non-hallucinating multi-backend speech recognition stack. **Note: This operation requires credits based on audio duration.**

**Parameters:**
- audio_url (string, required): URL to audio file to transcribe (max 25MB; formats: WAV, MP3, M4A, OGG, FLAC, WebM, MP4 audio track)
- language (string, optional): ISO 639-1 code (e.g. \`en\`, \`hi\`, \`ar\`, \`fr\`). **Omit this field OR pass \`"auto"\`** to enable auto-detection across the 39 supported languages. Specifying a single supported language skips language identification entirely for lowest latency.
- diarize (boolean, optional): Enable pyannote speaker diarization. When \`true\`, each segment in the response includes a \`speakers\` array with \`SPEAKER_00\`, \`SPEAKER_01\`, … labels. Adds ~50–150 ms of processing latency.
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Auto-detect:**
The most reliable way to auto-detect is to **omit the \`language\` field entirely**. Passing the literal string \`"auto"\` is also accepted and treated identically by the server-side shim — it rewrites \`auto\` → omit before forwarding to the backend. Do NOT pass \`"auto"\` directly to the WebSocket streaming endpoint; the WS form requires \`languages: null\`.

**Response shape (JSON):**
\`\`\`
{
  "request_id": string,         // Unique request identifier
  "text": string,               // Full normalized transcript
  "language": string | null,    // Detected ISO 639-1 code ('en', 'hi', …); null on no-speech
  "language_name": string,      // Full English name (e.g. 'English')
  "language_source": string,    // 'fast_path' | 'language_id' | 'mixed'
  "duration_sec": number,       // Audio duration in seconds
  "processing_ms": number,      // Server processing time
  "rtf": number,                // Real-time factor
  "segments": [                 // Per-utterance segments
    {
      "start": number,
      "end": number,
      "language": string,
      "language_name": string,
      "text": string,
      "confidence": number,
      "words": [{ "word": string, "start": number, "end": number, "confidence": number }],
      "speakers": [{ "speaker": string, "start": number, "end": number }]  // when diarize=true
    }
  ],
  "words": array,               // Flat word list across all segments
  "warnings": array,            // Non-fatal warnings (e.g. no_speech_detected)
  "warning_codes": string[],    // Flat list of warning codes for quick checks
  "language_detection": object  // Internal LID metadata
}
\`\`\`

**Examples:**
- Auto-detect: \`{ "audio_url": "https://example.com/audio.mp3" }\`
- Auto-detect (explicit): \`{ "audio_url": "https://example.com/audio.mp3", "language": "auto" }\`
- Specific language: \`{ "audio_url": "https://example.com/hindi.mp3", "language": "hi" }\`
- With speaker diarization: \`{ "audio_url": "https://example.com/meeting.mp3", "diarize": true }\`

**Supported Languages (39 total):**
- **European (25)**: English (\`en\`), Spanish (\`es\`), French (\`fr\`), German (\`de\`), Italian (\`it\`), Portuguese (\`pt\`), Dutch (\`nl\`), Polish (\`pl\`), Russian (\`ru\`), Ukrainian (\`uk\`), Czech (\`cs\`), Swedish (\`sv\`), Bulgarian (\`bg\`), Danish (\`da\`), Greek (\`el\`), Estonian (\`et\`), Finnish (\`fi\`), Croatian (\`hr\`), Hungarian (\`hu\`), Lithuanian (\`lt\`), Latvian (\`lv\`), Maltese (\`mt\`), Romanian (\`ro\`), Slovak (\`sk\`), Slovenian (\`sl\`)
- **Indic (13, with English code-switching)**: Hindi (\`hi\`), Bengali (\`bn\`), Marathi (\`mr\`), Punjabi (\`pa\`), Gujarati (\`gu\`), Odia (\`or\`), Assamese (\`as\`), Nepali (\`ne\`), Telugu (\`te\`), Kannada (\`kn\`), Tamil (\`ta\`), Malayalam (\`ml\`), Sanskrit (\`sa\`)
- **Arabic**: MSA (\`ar\`) — dialect tags like \`ar-eg\` are rejected
- **Unsupported** (return error, no silent aliasing): \`ur\`, \`ja\`, \`ko\`, \`zh\`, \`th\`, \`vi\`, \`id\`, \`tl\`, \`sw\`, \`tr\`, \`fa\`, \`he\`

**Credit Cost:**
- Billed per second of audio (\`duration_sec\` field)
- Diarization does not affect cost

**Audio Requirements:**
- Max file size: 25MB
- Max duration: 1 hour
- Supported formats: WAV, MP3, M4A, OGG, FLAC, WebM, MP4 audio track
- Recommended: 16 kHz+ sample rate

**Error Handling:**
- Successful request with \`text: ""\` and \`warning_codes: ["no_speech_detected"]\` means the audio contained no speech (silence / music / noise). This is NOT an error — do not retry.
- Returns "Error: Insufficient credits" if balance is too low
- Returns "Error: File too large" if audio exceeds 25MB
- Returns "Error: Unsupported format" for invalid audio formats
- Returns an \`unsupported_language\` error when the \`language\` field is set to a code not in the supported list (e.g. \`ur\`, \`ja\`, \`ko\`, \`zh\`)`,
      inputSchema: STTTranscribeSchema,
      annotations: {
        title: "Transcribe Audio",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: STTTranscribeParams) => {
      try {
        const apiClient = getApiClient();

        // `language: "auto"` is treated as omission — the upstream STT server
        // rejects "auto" as a literal code. The REST `/stt` route also strips
        // it server-side; we pre-strip here so the sent payload matches docs.
        const explicitLanguage =
          params.language && params.language.toLowerCase() !== "auto"
            ? params.language
            : undefined;

        const requestBody = {
          audio_url: params.audio_url,
          ...(explicitLanguage && { language: explicitLanguage }),
          ...(params.diarize !== undefined && { diarize: params.diarize })
        };

        const result = await apiClient.post<unknown>("/stt", requestBody);

        const formatted = formatSTTLog(result as any, params.response_format);

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

  // Get STT history/logs
  server.registerTool(
    "sixtydb_stt_logs",
    {
      title: "Get Transcription History",
      description: `Retrieve STT transcription history with filtering and pagination.

This tool provides a complete history of all transcriptions made through the account, including text previews, duration, language, and credit usage.

**Parameters:**
- language (string, optional): Filter by specific language code
- from_date (string, optional): Filter by start date (ISO 8601 format)
- to_date (string, optional): Filter by end date (ISO 8601 format)
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of transcriptions with details
- Each entry shows filename, language, duration, and text preview

For JSON format:
{
  "total": number,           // Total number of transcriptions
  "count": number,           // Number in this response
  "offset": number,          // Current pagination offset
  "logs": [                  // Array of STT log entries
    {
      "id": string,          // Transcription ID
      "file_name": string,   // Original filename
      "text": string,        // Full transcript
      "language": string,    // Language code
      "duration": number,    // Duration in seconds
      "credits_used": number,// Credits charged
      "created_at": string   // Transcription timestamp
    }
  ],
  "has_more": boolean,       // Whether more results exist
  "next_offset": number      // Next page offset
}

**Examples:**
- Recent transcriptions: { "limit": 10 }
- Filter by language: { "language": "en-US" }
- Date range: { "from_date": "2024-01-01T00:00:00Z", "to_date": "2024-01-31T23:59:59Z" }
- Paginate through results: { "offset": 20, "limit": 20 }

**Use Cases:**
- Track transcription usage and credit spending
- Find previously transcribed content
- Analyze language usage patterns
- Audit transcription history

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid
- Returns "Error: Invalid date format" for malformed date parameters`,
      inputSchema: STTLogsSchema,
      annotations: {
        title: "Get Transcription History",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: STTLogsParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.language) queryParams.language = params.language;
        if (params.from_date) queryParams.from_date = params.from_date;
        if (params.to_date) queryParams.to_date = params.to_date;

        const data = await apiClient.get<{
          logs: unknown[];
          total: number;
        }>("/stt/logs", queryParams);

        const logs = data.logs || [];
        const total = data.total || logs.length;
        const hasMore = params.offset + logs.length < total;

        const formatted = formatSTTLogList(
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

  // Get STT details
  server.registerTool(
    "sixtydb_stt_get",
    {
      title: "Get Transcription Details",
      description: `Get detailed information about a specific transcription.

This tool retrieves complete details for a single transcription including the full text, language, duration, and credit usage.

**Parameters:**
- id (string, required): STT transcription ID
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Complete transcription details
- Shows full text, language, duration, and credits

For JSON format:
{
  "id": string,              // Transcription ID
  "file_name": string,       // Original filename
  "text": string,            // Full transcript text
  "language": string,        // Language code
  "duration": number,        // Duration in seconds
  "credits_used": number,    // Credits charged
  "created_at": string       // Transcription timestamp
}

**Examples:**
- Get transcription details: { "id": "stt_abc123" }

**Use Cases:**
- Retrieve full transcript text
- Review transcription parameters
- Check credit usage for specific transcription
- Access metadata

**Error Handling:**
- Returns "Error: Transcription not found" if ID doesn't exist (404 status)
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: STTGetSchema,
      annotations: {
        title: "Get Transcription Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: STTGetParams) => {
      try {
        const apiClient = getApiClient();

        const log = await apiClient.get<unknown>(`/stt/${params.id}`);

        const formatted = formatSTTLog(log as any, params.response_format);

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
