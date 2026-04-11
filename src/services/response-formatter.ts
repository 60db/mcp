/**
 * Response Formatters
 * Handles formatting responses in both JSON and Markdown formats
 */

import {
  Voice,
  TTSLog,
  STTLog,
  Workspace,
  WorkspaceMember,
  HistoryEntry,
  DictionaryEntry,
  Snippet,
  Note,
  Meeting,
  UsageStats,
  VoiceAnalytics,
  Plan,
  Subscription,
  Invoice,
  PaginatedResponse
} from "../types/index.js";
import { ResponseFormat } from "../types/index.js";
import { CHARACTER_LIMIT } from "../constants.js";

/**
 * Format date to human-readable string
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  } catch {
    return dateString;
  }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Truncate response if it exceeds character limit
 */
export function truncateIfNeeded(
  response: string,
  isJson: boolean
): { content: string; truncated: boolean; truncationMessage?: string } {
  if (response.length <= CHARACTER_LIMIT) {
    return { content: response, truncated: false };
  }

  const truncationMessage = isJson
    ? `\n  "truncated": true,\n  "truncation_message": "Response truncated due to size. Use pagination or filters to reduce results."`
    : `\n\n---\n**Response truncated due to size.** Use pagination or filters to reduce results.`;

  // Keep content within limit, leaving room for truncation message
  const availableSpace = CHARACTER_LIMIT - truncationMessage.length - 100;
  const truncatedContent = response.substring(0, availableSpace) + "...";

  return {
    content: truncatedContent + truncationMessage,
    truncated: true,
    truncationMessage: "Response truncated. Use pagination or filters to reduce results."
  };
}

/**
 * Format voice list/response
 */
export function formatVoice(
  voice: Voice,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(voice, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## ${voice.name} (${voice.id})`);
  lines.push("");
  if (voice.language) lines.push(`- **Language**: ${voice.language}${voice.dialect ? ` (${voice.dialect})` : ""}`);
  if (voice.gender) lines.push(`- **Gender**: ${voice.gender}`);
  if (voice.age) lines.push(`- **Age**: ${voice.age}`);
  lines.push(`- **Type**: ${voice.is_clone ? "Cloned" : "Standard"} ${voice.is_public ? "(Public)" : "(Private)"}`);
  if (voice.sample_audio_url) lines.push(`- **Preview**: ${voice.sample_audio_url}`);
  if (voice.created_at) lines.push(`- **Created**: ${formatDate(voice.created_at)}`);
  lines.push("");

  return lines.join("\n");
}

export function formatVoiceList(
  voices: Voice[],
  total: number,
  offset: number,
  hasMore: boolean,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    const response = {
      total,
      count: voices.length,
      offset,
      voices,
      has_more: hasMore,
      next_offset: hasMore ? offset + voices.length : undefined
    };
    return JSON.stringify(response, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# Voices (${total} total)`);
  lines.push("");
  lines.push(`Showing ${voices.length} voices (offset: ${offset})`);
  lines.push("");

  for (const voice of voices) {
    lines.push(`### ${voice.name} (${voice.id})`);
    lines.push(`- **Language**: ${voice.language || "N/A"}${voice.dialect ? ` (${voice.dialect})` : ""}`);
    lines.push(`- **Gender**: ${voice.gender || "N/A"}`);
    lines.push(`- **Type**: ${voice.is_clone ? "Cloned" : "Standard"} ${voice.is_public ? "(Public)" : "(Private)"}`);
    if (voice.sample_audio_url) lines.push(`- **Preview**: ${voice.sample_audio_url}`);
    lines.push("");
  }

  if (hasMore) {
    lines.push(`---\n**More results available.** Use offset=${offset + voices.length} to see more.`);
  }

  return lines.join("\n");
}

/**
 * Format TTS log/response
 */
export function formatTTSLog(
  log: TTSLog,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(log, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## TTS Generation ${log.id}`);
  lines.push("");
  lines.push(`- **Text**: ${log.text.substring(0, 100)}${log.text.length > 100 ? "..." : ""}`);
  lines.push(`- **Voice**: ${log.voice_name} (${log.voice_id})`);
  lines.push(`- **Duration**: ${formatDuration(log.duration)}`);
  lines.push(`- **Credits Used**: ${log.credits_used}`);
  lines.push(`- **Created**: ${formatDate(log.created_at)}`);
  if (log.audio_url) lines.push(`- **Audio**: ${log.audio_url}`);
  lines.push("");

  return lines.join("\n");
}

export function formatTTSLogList(
  logs: TTSLog[],
  total: number,
  offset: number,
  hasMore: boolean,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    const response = {
      total,
      count: logs.length,
      offset,
      logs,
      has_more: hasMore,
      next_offset: hasMore ? offset + logs.length : undefined
    };
    return JSON.stringify(response, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# TTS History (${total} total)`);
  lines.push("");
  lines.push(`Showing ${logs.length} generations (offset: ${offset})`);
  lines.push("");

  for (const log of logs) {
    lines.push(`### ${log.id}`);
    lines.push(`- **Text**: ${log.text.substring(0, 80)}${log.text.length > 80 ? "..." : ""}`);
    lines.push(`- **Voice**: ${log.voice_name}`);
    lines.push(`- **Duration**: ${formatDuration(log.duration)}`);
    lines.push(`- **Credits**: ${log.credits_used}`);
    lines.push(`- **Date**: ${formatDate(log.created_at)}`);
    lines.push("");
  }

  if (hasMore) {
    lines.push(`---\n**More results available.** Use offset=${offset + logs.length} to see more.`);
  }

  return lines.join("\n");
}

/**
 * Format STT log/response
 */
export function formatSTTLog(
  log: STTLog,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(log, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## Transcription ${log.id}`);
  lines.push("");
  lines.push(`- **File**: ${log.file_name}`);
  lines.push(`- **Language**: ${log.language}`);
  lines.push(`- **Duration**: ${formatDuration(log.duration)}`);
  lines.push(`- **Credits Used**: ${log.credits_used}`);
  lines.push(`- **Created**: ${formatDate(log.created_at)}`);
  lines.push("");
  lines.push(`**Transcript:**`);
  lines.push(`> ${log.text}`);
  lines.push("");

  return lines.join("\n");
}

export function formatSTTLogList(
  logs: STTLog[],
  total: number,
  offset: number,
  hasMore: boolean,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    const response = {
      total,
      count: logs.length,
      offset,
      logs,
      has_more: hasMore,
      next_offset: hasMore ? offset + logs.length : undefined
    };
    return JSON.stringify(response, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# Transcriptions (${total} total)`);
  lines.push("");
  lines.push(`Showing ${logs.length} transcriptions (offset: ${offset})`);
  lines.push("");

  for (const log of logs) {
    lines.push(`### ${log.id}`);
    lines.push(`- **File**: ${log.file_name}`);
    lines.push(`- **Language**: ${log.language}`);
    lines.push(`- **Duration**: ${formatDuration(log.duration)}`);
    lines.push(`- **Credits**: ${log.credits_used}`);
    lines.push(`- **Text**: ${log.text.substring(0, 100)}${log.text.length > 100 ? "..." : ""}`);
    lines.push("");
  }

  if (hasMore) {
    lines.push(`---\n**More results available.** Use offset=${offset + logs.length} to see more.`);
  }

  return lines.join("\n");
}

/**
 * Format workspace
 */
export function formatWorkspace(
  workspace: Workspace,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(workspace, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## ${workspace.name} (${workspace.id})`);
  lines.push("");
  if (workspace.description) lines.push(`- **Description**: ${workspace.description}`);
  lines.push(`- **Owner ID**: ${workspace.owner_id}`);
  lines.push(`- **Created**: ${formatDate(workspace.created_at)}`);
  lines.push("");

  return lines.join("\n");
}

export function formatWorkspaceList(
  workspaces: Workspace[],
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify({ workspaces, total: workspaces.length }, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# Workspaces (${workspaces.length})`);
  lines.push("");

  for (const ws of workspaces) {
    lines.push(`### ${ws.name} (${ws.id})`);
    if (ws.description) lines.push(`- **Description**: ${ws.description}`);
    lines.push(`- **Owner**: ${ws.owner_id}`);
    lines.push(`- **Created**: ${formatDate(ws.created_at)}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format workspace member
 */
export function formatWorkspaceMember(
  member: WorkspaceMember,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(member, null, 2);
  }

  const lines: string[] = [];
  lines.push(`- **${member.user?.name || member.user_id}** (${member.role})`);
  lines.push(`  - User ID: ${member.user_id}`);
  if (member.user?.email) lines.push(`  - Email: ${member.user.email}`);
  lines.push(`  - Joined: ${formatDate(member.joined_at)}`);

  return lines.join("\n");
}

/**
 * Format usage stats
 */
export function formatUsageStats(
  stats: any,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(stats, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# Usage Statistics`);
  lines.push("");

  // Handle both old and new API response formats
  if (stats.summary) {
    // New format from production API
    const { summary, period_label, workspace_id, billing_owner_id } = stats;

    lines.push(`## Account`);
    lines.push(`- **Workspace ID**: ${workspace_id || 'N/A'}`);
    lines.push(`- **Period**: ${period_label || 'N/A'}`);
    lines.push("");

    lines.push(`## Usage Summary`);
    lines.push(`- **TTS Characters**: ${(summary.tts_characters || 0).toLocaleString()}`);
    lines.push(`- **STT Minutes**: ${(summary.stt_minutes || 0).toLocaleString()}`);
    lines.push(`- **Total Cost**: $${(summary.total_cost_usd || 0).toFixed(2)}`);
    lines.push(`- **Plan**: ${summary.plan || 'Free'}`);
    lines.push("");

    if (summary.limits) {
      lines.push(`## Limits`);
      lines.push(`- **TTS Limit**: ${(summary.limits.tts_characters || 0).toLocaleString()} characters`);
      lines.push(`- **STT Limit**: ${(summary.limits.stt_minutes || 0).toLocaleString()} minutes`);

      if (summary.limits.usage_percentage) {
        lines.push(`- **TTS Used**: ${summary.limits.usage_percentage.tts || 0}%`);
        lines.push(`- **STT Used**: ${summary.limits.usage_percentage.stt || 0}%`);
      }
      lines.push("");
    }
  } else {
    // Old format (for backward compatibility)
    lines.push(`## Credits Usage`);
    lines.push(`- **TTS Credits**: ${(stats.tts_credits_used || 0).toLocaleString()}`);
    lines.push(`- **STT Credits**: ${(stats.stt_credits_used || 0).toLocaleString()}`);
    lines.push(`- **LLM Credits**: ${(stats.llm_credits_used || 0).toLocaleString()}`);
    lines.push(`- **Total Used**: ${(stats.total_credits_used || 0).toLocaleString()}`);
    lines.push(`- **Remaining**: ${(stats.credits_remaining || 0).toLocaleString()}`);
    lines.push("");

    if (stats.period) {
      lines.push(`## Period`);
      lines.push(`- **Start**: ${formatDate(stats.period.start)}`);
      lines.push(`- **End**: ${formatDate(stats.period.end)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format invoice
 */
export function formatInvoice(
  invoice: Invoice,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(invoice, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## Invoice ${invoice.id}`);
  lines.push("");
  lines.push(`- **Amount**: ${invoice.currency === "USD" ? "$" : "€"}${invoice.amount.toFixed(2)}`);
  lines.push(`- **Status**: ${invoice.status.toUpperCase()}`);
  lines.push(`- **Due Date**: ${formatDate(invoice.due_date)}`);
  if (invoice.paid_at) lines.push(`- **Paid**: ${formatDate(invoice.paid_at)}`);
  lines.push(`- **Download**: ${invoice.invoice_url}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format meeting
 */
export function formatMeeting(
  meeting: Meeting,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(meeting, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## ${meeting.title} (${meeting.id})`);
  lines.push("");
  lines.push(`- **Status**: ${meeting.status.toUpperCase()}`);
  if (meeting.duration) lines.push(`- **Duration**: ${formatDuration(meeting.duration)}`);
  lines.push(`- **Created**: ${formatDate(meeting.created_at)}`);
  if (meeting.ai_summary) {
    lines.push("");
    lines.push(`**AI Summary:**`);
    lines.push(`> ${meeting.ai_summary}`);
  }
  if (meeting.transcript) {
    lines.push("");
    lines.push(`**Transcript Preview:**`);
    lines.push(`> ${meeting.transcript.substring(0, 200)}${meeting.transcript.length > 200 ? "..." : ""}`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Format meeting list
 */
export function formatMeetingList(
  meetings: Meeting[],
  total: number,
  offset: number,
  hasMore: boolean,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    const response = {
      total,
      count: meetings.length,
      offset,
      meetings,
      has_more: hasMore,
      next_offset: hasMore ? offset + meetings.length : undefined
    };
    return JSON.stringify(response, null, 2);
  }

  const lines: string[] = [];
  lines.push(`# Meetings (${total} total)`);
  lines.push("");
  lines.push(`Showing ${meetings.length} meetings (offset: ${offset})`);
  lines.push("");

  for (const meeting of meetings) {
    lines.push(`### ${meeting.title} (${meeting.id})`);
    lines.push(`- **Status**: ${meeting.status.toUpperCase()}`);
    if (meeting.duration) lines.push(`- **Duration**: ${formatDuration(meeting.duration)}`);
    lines.push(`- **Created**: ${formatDate(meeting.created_at)}`);
    if (meeting.ai_summary) lines.push(`- **Summary**: ${meeting.ai_summary.substring(0, 80)}...`);
    lines.push("");
  }

  if (hasMore) {
    lines.push(`---\n**More results available.** Use offset=${offset + meetings.length} to see more.`);
  }

  return lines.join("\n");
}

/**
 * Format note
 */
export function formatNote(
  note: Note,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(note, null, 2);
  }

  const lines: string[] = [];
  lines.push(`## ${note.title} (${note.id})`);
  lines.push("");
  if (note.tags && note.tags.length > 0) {
    lines.push(`**Tags**: ${note.tags.map(t => `\`${t}\``).join(", ")}`);
    lines.push("");
  }
  lines.push(note.content);
  lines.push("");
  lines.push(`*Created: ${formatDate(note.created_at)} | Updated: ${formatDate(note.updated_at)}*`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format dictionary entry
 */
export function formatDictionaryEntry(
  entry: DictionaryEntry,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(entry, null, 2);
  }

  const lines: string[] = [];
  lines.push(`- **"${entry.phrase}"** → **"${entry.replacement}"**`);
  lines.push(`  - Scope: ${entry.scope}`);
  lines.push(`  - ID: ${entry.id}`);
  if (entry.voice_id) lines.push(`  - Voice: ${entry.voice_id}`);

  return lines.join("\n");
}

/**
 * Format snippet
 */
export function formatSnippet(
  snippet: Snippet,
  format: ResponseFormat
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(snippet, null, 2);
  }

  const lines: string[] = [];
  lines.push(`### ${snippet.title} (${snippet.id})`);
  if (snippet.category) lines.push(`**Category**: ${snippet.category}`);
  lines.push("");
  lines.push(snippet.content);
  lines.push("");
  lines.push(`*Created: ${formatDate(snippet.created_at)}*`);
  lines.push("");

  return lines.join("\n");
}

// Import types for formatErrorMessage
import { ApiError, RateLimitError } from "../types/index.js";

/**
 * Format error message
 */
export function formatErrorMessage(error: Error): string {
  let message = `**Error**: ${error.message}`;

  if (error instanceof ApiError && error.details) {
    message += `\n\n**Details**: ${JSON.stringify(error.details, null, 2)}`;
  }

  if (error instanceof RateLimitError && error.retryAfter) {
    message += `\n\n**Retry after**: ${error.retryAfter} seconds`;
  }

  return message;
}
