/**
 * Meeting and Analytics Tools
 * Tools for meeting management and usage analytics
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  MeetingsListSchema,
  MeetingGetSchema,
  MeetingCreateSchema,
  UsageStatsSchema
} from "../schemas/index.js";
import {
  MeetingsListParams,
  MeetingGetParams,
  MeetingCreateParams,
  UsageStatsParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatMeeting,
  formatMeetingList,
  formatUsageStats,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register meeting and analytics tools
 */
export function registerMeetingAndAnalyticsTools(server: McpServer): void {
  // List meetings
  server.registerTool(
    "sixtydb_list_meetings",
    {
      title: "List 60DB Meetings",
      description: `List meetings with filtering and pagination.

This tool retrieves all meetings recorded through the 60DB platform, including live recordings, completed meetings, and failed uploads.

**Parameters:**
- status ('recording' | 'uploading' | 'processing' | 'completed' | 'failed', optional): Filter by meeting status
- search (string, optional): Search term for meeting titles
- from_date (string, optional): Filter by start date (ISO 8601 format)
- to_date (string, optional): Filter by end date (ISO 8601 format)
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of meetings with status, duration, and AI summaries
- Shows which meetings are completed vs still processing

For JSON format:
{
  "total": number,
  "count": number,
  "offset": number,
  "meetings": [             // Array of meeting objects
    {
      "id": string,
      "title": string,
      "status": string,      // recording|uploading|processing|completed|failed
      "duration": number,    // Duration in seconds
      "transcript": string,  // Full transcript (if completed)
      "ai_notes": string,    // AI-generated notes (if completed)
      "ai_summary": string,  // AI-generated summary (if completed)
      "created_at": string,
      "updated_at": string
    }
  ],
  "has_more": boolean,
  "next_offset": number
}

**Meeting Statuses:**
- **recording**: Currently being recorded
- **uploading**: Audio is being uploaded
- **processing**: Transcription is in progress
- **completed**: Meeting is fully processed
- **failed**: An error occurred

**Use Cases:**
- Browse meeting history
- Find specific meetings by title or date
- Check processing status
- Access transcripts and AI notes

**Examples:**
- Recent completed meetings: { "status": "completed", "limit": 10 }
- Search by title: { "search": "standup" }
- Date range: { "from_date": "2024-01-01T00:00:00Z", "to_date": "2024-01-31T23:59:59Z" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: MeetingsListSchema,
      annotations: {
        title: "List 60DB Meetings",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: MeetingsListParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.status) queryParams.status = params.status;
        if (params.search) queryParams.search = params.search;
        if (params.from_date) queryParams.from_date = params.from_date;
        if (params.to_date) queryParams.to_date = params.to_date;

        const data = await apiClient.get<{
          meetings: unknown[];
          total: number;
        }>("/60db/meetings", queryParams);

        const meetings = data.meetings || [];
        const total = data.total || meetings.length;
        const hasMore = params.offset + meetings.length < total;

        const formatted = formatMeetingList(
          meetings as any,
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
          content: [{ type: "text", text: content }]
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

  // Get meeting details
  server.registerTool(
    "sixtydb_get_meeting",
    {
      title: "Get Meeting Details",
      description: `Get detailed information about a specific meeting.

This tool retrieves complete details for a single meeting including the full transcript, AI-generated notes, summary, and audio.

**Parameters:**
- id (string, required): Meeting ID
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Complete meeting details
- Full transcript with speaker identification
- AI-generated notes and summary
- Audio link if available

For JSON format:
{
  "id": string,
  "title": string,
  "status": string,
  "duration": number,
  "transcript": string,      // Full transcript
  "ai_notes": string,        // AI-generated notes
  "ai_summary": string,      // AI-generated summary
  "audio_url": string,       // Audio download URL
  "created_at": string,
  "updated_at": string
}

**Use Cases:**
- Review meeting transcripts
- Access AI-generated summaries
- Get meeting audio
- Check processing status

**Examples:**
- Get meeting details: { "id": "meeting_abc123" }

**AI Features:**
- **Notes**: Action items and key points
- **Summary**: High-level meeting overview
- **Transcript**: Full word-by-word text

**Error Handling:**
- Returns "Error: Meeting not found" if ID doesn't exist (404 status)
- Returns "Error: Processing not complete" if meeting is still being processed`,
      inputSchema: MeetingGetSchema,
      annotations: {
        title: "Get Meeting Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: MeetingGetParams) => {
      try {
        const apiClient = getApiClient();

        const meeting = await apiClient.get<unknown>(`/60db/meetings/${params.id}`);

        const formatted = formatMeeting(meeting as any, params.response_format);

        const { content } = truncateIfNeeded(
          formatted,
          params.response_format === ResponseFormat.JSON
        );

        return {
          content: [{ type: "text", text: content }]
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

  // Create meeting
  server.registerTool(
    "sixtydb_create_meeting",
    {
      title: "Create 60DB Meeting",
      description: `Create a new meeting recording session.

This tool initializes a new meeting that can be recorded through the 60DB platform. After creation, audio can be uploaded or streamed for transcription.

**Parameters:**
- title (string, required): Meeting title (max 200 characters)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Created meeting details
- Meeting ID and recording status

For JSON format:
{
  "id": string,              // New meeting ID
  "title": string,           // Meeting title
  "status": "recording",     // Initial status
  "created_at": string       // Creation timestamp
}

**Examples:**
- Create meeting: { "title": "Weekly Standup" }

**Next Steps:**
1. Use the returned meeting ID to upload audio
2. Monitor meeting status until "completed"
3. Retrieve transcript and AI notes

**Use Cases:**
- Start recording a meeting
- Prepare for audio upload
- Initialize meeting transcription

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: MeetingCreateSchema,
      annotations: {
        title: "Create 60DB Meeting",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: MeetingCreateParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          title: params.title
        };

        const meeting = await apiClient.post<unknown>("/60db/meetings", requestBody);

        const formatted = formatMeeting(meeting as any, params.response_format);

        const { content } = truncateIfNeeded(
          formatted,
          params.response_format === ResponseFormat.JSON
        );

        return {
          content: [{ type: "text", text: content }]
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

  // Get usage statistics
  server.registerTool(
    "sixtydb_get_usage_stats",
    {
      title: "Get Usage Statistics",
      description: `Retrieve current usage statistics and credit balance.

This tool provides comprehensive usage statistics across all QLabs services including TTS, STT, and LLM API usage.

**Parameters:**
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Detailed credit usage breakdown
- Remaining balance
- Current billing period

For JSON format:
{
  "tts_credits_used": number,     // Credits used for TTS
  "stt_credits_used": number,     // Credits used for STT
  "llm_credits_used": number,     // Credits used for LLM
  "total_credits_used": number,   // Total credits used
  "credits_remaining": number,    // Remaining balance
  "period": {
    "start": string,              // Billing period start
    "end": string                 // Billing period end
  }
}

**Use Cases:**
- Monitor credit consumption
- Check remaining balance
- Plan usage for billing period
- Track which services are used most

**Examples:**
- Get usage stats: {}

**Credit Tracking:**
- Credits reset at billing period start
- Different services consume credits at different rates
- Usage updates in near real-time

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: UsageStatsSchema,
      annotations: {
        title: "Get Usage Statistics",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: UsageStatsParams) => {
      try {
        const apiClient = getApiClient();

        const stats = await apiClient.get<unknown>("/analytics/usage");

        const formatted = formatUsageStats(stats as any, params.response_format);

        const { content } = truncateIfNeeded(
          formatted,
          params.response_format === ResponseFormat.JSON
        );

        return {
          content: [{ type: "text", text: content }]
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
