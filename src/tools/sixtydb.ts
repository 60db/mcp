/**
 * 60DB Tools
 * Tools for 60DB dictionary, snippets, and notes management
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DictionaryListSchema,
  DictionaryAddSchema,
  SnippetsListSchema,
  SnippetAddSchema,
  NotesListSchema,
  NoteAddSchema,
  NoteGetSchema
} from "../schemas/index.js";
import {
  DictionaryListParams,
  DictionaryAddParams,
  SnippetsListParams,
  SnippetAddParams,
  NotesListParams,
  NoteAddParams,
  NoteGetParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatDictionaryEntry,
  formatSnippet,
  formatNote,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register 60DB tools
 */
export function register60DBTools(server: McpServer): void {
  // List dictionary entries
  server.registerTool(
    "sixtydb_60db_list_dictionary",
    {
      title: "List 60DB Dictionary Entries",
      description: `List pronunciation dictionary entries with filtering and pagination.

The 60DB dictionary allows you to define custom phrase replacements for better transcription accuracy. This is useful for names, technical terms, acronyms, and industry-specific vocabulary.

**Parameters:**
- scope ('personal' | 'team' | 'all', optional): Filter by entry scope (default: 'all')
- voice_id (string, optional): Filter entries for specific voice
- search (string, optional): Search term for phrases
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of dictionary entries
- Each entry shows phrase → replacement mapping

For JSON format:
{
  "total": number,           // Total number of entries
  "count": number,           // Number in this response
  "offset": number,          // Current pagination offset
  "entries": [               // Array of dictionary entries
    {
      "id": string,          // Entry ID
      "phrase": string,      // Original phrase to replace
      "replacement": string, // Replacement text
      "scope": string,       // 'personal' or 'team'
      "voice_id": string,    // Specific voice (if applicable)
      "created_at": string   // Creation timestamp
    }
  ],
  "has_more": boolean,       // Whether more results exist
  "next_offset": number      // Next page offset
}

**Use Cases:**
- Improve transcription of specific terms
- Define pronunciations for names
- Add technical vocabulary
- Set up acronyms and abbreviations

**Examples:**
- All entries: {}
- Team entries: { "scope": "team" }
- Search for term: { "search": "QLabs" }
- Voice-specific: { "voice_id": "voice_abc123" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: DictionaryListSchema,
      annotations: {
        title: "List 60DB Dictionary Entries",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: DictionaryListParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.scope !== "all") queryParams.scope = params.scope;
        if (params.voice_id) queryParams.voice_id = params.voice_id;
        if (params.search) queryParams.search = params.search;

        const data = await apiClient.get<{
          entries: unknown[];
          total: number;
        }>("/60db/dictionary", queryParams);

        const entries = data.entries || [];
        const total = data.total || entries.length;
        const hasMore = params.offset + entries.length < total;

        const lines: string[] = [];
        lines.push(`# 60DB Dictionary (${total} entries)`);
        lines.push("");

        if (params.response_format === ResponseFormat.JSON) {
          const response = {
            total,
            count: entries.length,
            offset: params.offset,
            entries,
            has_more: hasMore,
            next_offset: hasMore ? params.offset + entries.length : undefined
          };

          const formatted = JSON.stringify(response, null, 2);
          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
        }

        // Markdown format
        for (const entry of entries as any) {
          lines.push(formatDictionaryEntry(entry, params.response_format));
        }

        if (hasMore) {
          lines.push(`\n---\n**More results available.** Use offset=${params.offset + entries.length} to see more.`);
        }

        const { content } = truncateIfNeeded(lines.join("\n"), false);

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

  // Add dictionary entry
  server.registerTool(
    "sixtydb_60db_add_dictionary",
    {
      title: "Add 60DB Dictionary Entry",
      description: `Add a new pronunciation dictionary entry.

Dictionary entries define how specific phrases should be transcribed, improving accuracy for names, technical terms, and industry-specific vocabulary.

**Parameters:**
- phrase (string, required): The phrase to replace (max 200 characters)
- replacement (string, required): The replacement text (max 200 characters)
- scope ('personal' | 'team', optional): Entry scope (default: 'personal')
- voice_id (string, optional): Apply to specific voice only
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Created entry details
- Shows phrase → replacement mapping

For JSON format:
{
  "id": string,              // Entry ID
  "phrase": string,          // Original phrase
  "replacement": string,     // Replacement text
  "scope": string,           // Entry scope
  "voice_id": string,        // Specific voice (if applicable)
  "created_at": string       // Creation timestamp
}

**Examples:**
- Personal entry: { "phrase": "QLabs", "replacement": "Cue Labs" }
- Team entry: { "phrase": "CEO", "replacement": "Chief Executive Officer", "scope": "team" }
- Voice-specific: { "phrase": "numpy", "replacement": "num pi", "voice_id": "voice_abc123" }

**Best Practices:**
- Use for names: "Nguyen" → "Win"
- Technical terms: "API" → "A P I"
- Acronyms: "YOLO" → "you only live once"

**Error Handling:**
- Returns "Error: Phrase already exists" if duplicate phrase
- Returns "Error: Invalid voice_id" if voice doesn't exist`,
      inputSchema: DictionaryAddSchema,
      annotations: {
        title: "Add 60DB Dictionary Entry",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: DictionaryAddParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          phrase: params.phrase,
          replacement: params.replacement,
          scope: params.scope,
          ...(params.voice_id && { voice_id: params.voice_id })
        };

        const entry = await apiClient.post<unknown>("/60db/dictionary", requestBody);

        const formatted = formatDictionaryEntry(entry as any, params.response_format);

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

  // List snippets
  server.registerTool(
    "sixtydb_60db_list_snippets",
    {
      title: "List 60DB Snippets",
      description: `List text snippets with filtering and pagination.

Snippets are reusable text templates that can be quickly inserted into transcriptions, notes, or other text content.

**Parameters:**
- category (string, optional): Filter by category
- search (string, optional): Search term for titles/content
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of snippets with titles and content
- Organized by category if applicable

For JSON format:
{
  "total": number,
  "count": number,
  "offset": number,
  "snippets": [             // Array of snippet objects
    {
      "id": string,
      "title": string,
      "content": string,
      "category": string,
      "created_at": string,
      "updated_at": string
    }
  ],
  "has_more": boolean,
  "next_offset": number
}

**Use Cases:**
- Quick access to common text templates
- Standardized responses or descriptions
- Reusable content blocks

**Examples:**
- All snippets: {}
- By category: { "category": "greetings" }
- Search: { "search": "meeting" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: SnippetsListSchema,
      annotations: {
        title: "List 60DB Snippets",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SnippetsListParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.category) queryParams.category = params.category;
        if (params.search) queryParams.search = params.search;

        const data = await apiClient.get<{
          snippets: unknown[];
          total: number;
        }>("/60db/snippets", queryParams);

        const snippets = data.snippets || [];
        const total = data.total || snippets.length;
        const hasMore = params.offset + snippets.length < total;

        const lines: string[] = [];
        lines.push(`# 60DB Snippets (${total} total)`);
        lines.push("");

        if (params.response_format === ResponseFormat.JSON) {
          const response = {
            total,
            count: snippets.length,
            offset: params.offset,
            snippets,
            has_more: hasMore,
            next_offset: hasMore ? params.offset + snippets.length : undefined
          };

          const formatted = JSON.stringify(response, null, 2);
          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
        }

        // Markdown format
        for (const snippet of snippets as any) {
          lines.push(formatSnippet(snippet, params.response_format));
        }

        if (hasMore) {
          lines.push(`\n---\n**More results available.** Use offset=${params.offset + snippets.length} to see more.`);
        }

        const { content } = truncateIfNeeded(lines.join("\n"), false);

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

  // Add snippet
  server.registerTool(
    "sixtydb_60db_add_snippet",
    {
      title: "Add 60DB Snippet",
      description: `Add a new text snippet.

Snippets are reusable text templates for quick insertion into transcriptions, notes, or other content.

**Parameters:**
- title (string, required): Snippet title (max 100 characters)
- content (string, required): Snippet content (max 10000 characters)
- category (string, optional): Snippet category (max 50 characters)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
Created snippet details with ID and metadata.

**Examples:**
- Basic snippet: { "title": "Meeting Opening", "content": "Thank you all for joining..." }
- With category: { "title": "Sign-off", "content": "Best regards,", "category": "closings" }

**Use Cases:**
- Standard meeting openings/closings
- Common email responses
- Reusable descriptions or templates

**Error Handling:**
- Returns "Error: Title already exists" if duplicate title`,
      inputSchema: SnippetAddSchema,
      annotations: {
        title: "Add 60DB Snippet",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: SnippetAddParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          title: params.title,
          content: params.content,
          ...(params.category && { category: params.category })
        };

        const snippet = await apiClient.post<unknown>("/60db/snippets", requestBody);

        const formatted = formatSnippet(snippet as any, params.response_format);

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

  // List notes
  server.registerTool(
    "sixtydb_60db_list_notes",
    {
      title: "List 60DB Notes",
      description: `List personal notes with filtering and pagination.

Notes are for storing personal thoughts, summaries, or any text content with optional tags for organization.

**Parameters:**
- tags (array of strings, optional): Filter by tags
- search (string, optional): Search term for titles/content
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of notes with titles, tags, and content previews
- Shows creation and update dates

For JSON format:
{
  "total": number,
  "count": number,
  "offset": number,
  "notes": [                // Array of note objects
    {
      "id": string,
      "title": string,
      "content": string,
      "tags": string[],
      "created_at": string,
      "updated_at": string
    }
  ],
  "has_more": boolean,
  "next_offset": number
}

**Use Cases:**
- Store meeting notes and summaries
- Keep research notes and findings
- Organize thoughts with tags

**Examples:**
- All notes: {}
- By tag: { "tags": ["project-alpha"] }
- Search: { "search": "transcription" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: NotesListSchema,
      annotations: {
        title: "List 60DB Notes",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: NotesListParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.tags) queryParams.tags = params.tags.join(",");
        if (params.search) queryParams.search = params.search;

        const data = await apiClient.get<{
          notes: unknown[];
          total: number;
        }>("/60db/notes", queryParams);

        const notes = data.notes || [];
        const total = data.total || notes.length;
        const hasMore = params.offset + notes.length < total;

        const lines: string[] = [];
        lines.push(`# 60DB Notes (${total} total)`);
        lines.push("");

        if (params.response_format === ResponseFormat.JSON) {
          const response = {
            total,
            count: notes.length,
            offset: params.offset,
            notes,
            has_more: hasMore,
            next_offset: hasMore ? params.offset + notes.length : undefined
          };

          const formatted = JSON.stringify(response, null, 2);
          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
        }

        // Markdown format
        for (const note of notes as any) {
          lines.push(formatNote(note, params.response_format));
        }

        if (hasMore) {
          lines.push(`\n---\n**More results available.** Use offset=${params.offset + notes.length} to see more.`);
        }

        const { content } = truncateIfNeeded(lines.join("\n"), false);

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

  // Add note
  server.registerTool(
    "sixtydb_60db_add_note",
    {
      title: "Add 60DB Note",
      description: `Add a new personal note.

Notes are for storing personal thoughts, summaries, or any text content with optional tags for organization.

**Parameters:**
- title (string, required): Note title (max 200 characters)
- content (string, required): Note content (max 50000 characters)
- tags (array of strings, optional): Note tags (max 10 tags, 50 chars each)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
Created note details with ID, tags, and metadata.

**Examples:**
- Basic note: { "title": "Meeting Notes", "content": "Discussed Q1 roadmap..." }
- With tags: { "title": "Research", "content": "Findings from user testing...", "tags": ["ux", "research"] }

**Use Cases:**
- Meeting summaries and action items
- Research notes and findings
- Personal reminders and thoughts

**Error Handling:**
- Returns "Error: Too many tags" if more than 10 tags provided`,
      inputSchema: NoteAddSchema,
      annotations: {
        title: "Add 60DB Note",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: NoteAddParams) => {
      try {
        const apiClient = getApiClient();

        const requestBody = {
          title: params.title,
          content: params.content,
          ...(params.tags && { tags: params.tags })
        };

        const note = await apiClient.post<unknown>("/60db/notes", requestBody);

        const formatted = formatNote(note as any, params.response_format);

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

  // Get note details
  server.registerTool(
    "sixtydb_60db_get_note",
    {
      title: "Get 60DB Note Details",
      description: `Get detailed information about a specific note.

**Parameters:**
- id (string, required): Note ID
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
Complete note details with full content, tags, and metadata.

**Examples:**
- Get note: { "id": "note_abc123" }

**Error Handling:**
- Returns "Error: Note not found" if ID doesn't exist (404 status)`,
      inputSchema: NoteGetSchema,
      annotations: {
        title: "Get 60DB Note Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: NoteGetParams) => {
      try {
        const apiClient = getApiClient();

        const note = await apiClient.get<unknown>(`/60db/notes/${params.id}`);

        const formatted = formatNote(note as any, params.response_format);

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
