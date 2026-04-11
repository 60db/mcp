/**
 * Voice Management Tools
 * Tools for listing, retrieving, and creating voices
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  VoiceListSchema,
  VoiceGetSchema,
  VoiceCreateSchema
} from "../schemas/index.js";
import {
  VoiceListParams,
  VoiceGetParams,
  VoiceCreateParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatVoice,
  formatVoiceList,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register voice management tools
 */
export function registerVoiceTools(server: McpServer): void {
  // List voices
  server.registerTool(
    "sixtydb_list_voices",
    {
      title: "List Voices",
      description: `List available voices in the QLabs Voice AI platform with filtering and pagination options.

This tool searches through all available voices including standard voices, cloned voices, and professional voices. It supports filtering by workspace, language, dialect, and visibility status.

**Parameters:**
- workspace_id (string, optional): Filter voices by workspace ID
- language (string, optional): Filter by language code (e.g., 'en-US', 'es-ES', 'fr-FR')
- dialect (string, optional): Filter by dialect variant
- is_public (boolean, optional): Filter public (true) or private (false) voices
- is_clone (boolean, optional): Filter cloned (true) or standard (false) voices
- search (string, optional): Search term to filter voice names
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Human-readable list of voices with details
- Each voice shows: name, ID, language, gender, type, preview URL

For JSON format:
{
  "total": number,           // Total number of voices matching filters
  "count": number,           // Number of voices in this response
  "offset": number,          // Current pagination offset
  "voices": [                // Array of voice objects
    {
      "id": string,          // Voice ID
      "name": string,        // Voice name
      "language": string,    // Language code
      "dialect": string,     // Dialect variant
      "gender": string,      // Gender (male/female/neutral)
      "age": string,         // Age category (young/middle/old)
      "is_public": boolean,  // Whether voice is public
      "is_clone": boolean,   // Whether voice is cloned
      "sample_audio_url": string, // Preview audio URL
      "created_at": string,  // Creation timestamp
      "updated_at": string   // Last update timestamp
    }
  ],
  "has_more": boolean,       // Whether more results are available
  "next_offset": number      // Offset for next page (if has_more is true)
}

**Examples:**
- List all English voices: { "language": "en-US" }
- Find public cloned voices: { "is_public": true, "is_clone": true }
- Search for specific voice: { "search": "Sarah" }
- Get workspace voices: { "workspace_id": "workspace_123" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid
- Returns "Error: Rate limit exceeded" if too many requests (429 status)
- Returns "Error: Invalid filter parameters" for invalid filter values`,
      inputSchema: VoiceListSchema,
      annotations: {
        title: "List Voices",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: VoiceListParams) => {
      try {
        const apiClient = getApiClient();

        // Build query parameters
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.workspace_id) queryParams.workspace_id = params.workspace_id;
        if (params.language) queryParams.language = params.language;
        if (params.dialect) queryParams.dialect = params.dialect;
        if (params.is_public !== undefined) queryParams.is_public = params.is_public;
        if (params.is_clone !== undefined) queryParams.is_clone = params.is_clone;
        if (params.search) queryParams.search = params.search;

        // Make API request
        const data = await apiClient.get<{
          voices: unknown[];
          total: number;
        }>("/voices", queryParams);

        const voices = data.voices || [];
        const total = data.total || voices.length;
        const hasMore = params.offset + voices.length < total;

        // Format response
        const formatted = formatVoiceList(
          voices as any,
          total,
          params.offset,
          hasMore,
          params.response_format
        );

        // Check character limit
        const { content, truncated } = truncateIfNeeded(
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

  // Get voice details
  server.registerTool(
    "sixtydb_get_voice",
    {
      title: "Get Voice Details",
      description: `Get detailed information about a specific voice by ID.

This tool retrieves complete details for a single voice including all available metadata, settings, and sample audio URLs.

**Parameters:**
- id (string, required): Voice ID to retrieve details for
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Detailed voice information with all metadata
- Includes preview URLs and settings

For JSON format:
{
  "id": string,              // Voice ID
  "name": string,            // Voice name
  "language": string,        // Language code
  "dialect": string,         // Dialect variant
  "gender": string,          // Gender (male/female/neutral)
  "age": string,             // Age category
  "is_public": boolean,      // Whether voice is public
  "is_clone": boolean,       // Whether voice is cloned
  "sample_audio_url": string, // Preview audio URL
  "created_at": string,      // Creation timestamp
  "updated_at": string       // Last update timestamp
}

**Examples:**
- Get voice details: { "id": "voice_abc123" }

**Error Handling:**
- Returns "Error: Voice not found" if voice ID doesn't exist (404 status)
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: VoiceGetSchema,
      annotations: {
        title: "Get Voice Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: VoiceGetParams) => {
      try {
        const apiClient = getApiClient();

        const voice = await apiClient.get<unknown>(`/voices/${params.id}`);

        const formatted = formatVoice(voice as any, params.response_format);

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

  // Create/Clone voice
  server.registerTool(
    "sixtydb_create_voice",
    {
      title: "Create Cloned Voice",
      description: `Create a new cloned voice from a sample audio recording.

This tool creates a custom voice clone using the provided audio sample. Voice cloning allows you to create personalized voices for TTS synthesis. **Note: This operation requires credits and may take several minutes to process.**

**Parameters:**
- name (string, required): Name for the cloned voice (1-100 characters)
- sample_audio_url (string, required): URL to sample audio for voice cloning (must be a clear recording)
- language (string, optional): Language code (e.g., 'en-US', 'es-ES')
- dialect (string, optional): Dialect variant
- is_public (boolean, optional): Make voice publicly available (default: false)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Created voice details with processing status
- Credit usage information

For JSON format:
{
  "id": string,              // New voice ID
  "name": string,            // Voice name
  "status": string,          // Processing status
  "language": string,        // Language code
  "is_public": boolean,      // Whether voice is public
  "is_clone": true,          // Always true for cloned voices
  "credits_used": number,    // Credits charged for cloning
  "created_at": string       // Creation timestamp
}

**Examples:**
- Create private voice: { "name": "My Voice", "sample_audio_url": "https://example.com/sample.mp3" }
- Create public voice: { "name": "Celebrity Voice", "sample_audio_url": "https://example.com/sample.mp3", "is_public": true }

**Important Notes:**
- Sample audio should be 10-30 seconds of clear speech
- Background noise will reduce cloning quality
- Credit cost: varies based on voice type
- Processing time: typically 2-5 minutes

**Error Handling:**
- Returns "Error: Insufficient credits" if account doesn't have enough credits
- Returns "Error: Invalid audio URL" if sample audio is inaccessible
- Returns "Error: Voice name already exists" if name is not unique
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: VoiceCreateSchema,
      annotations: {
        title: "Create Cloned Voice",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: VoiceCreateParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          name: params.name,
          sample_audio_url: params.sample_audio_url,
          ...(params.language && { language: params.language }),
          ...(params.dialect && { dialect: params.dialect }),
          is_public: params.is_public ?? false
        };

        const voice = await apiClient.post<unknown>("/voices", requestBody);

        const formatted = formatVoice(voice as any, params.response_format);

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
