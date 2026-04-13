/**
 * Billing Tools
 * Tools for invoices and billing history.
 * Plans, subscriptions, and wallet top-ups are managed via the Dashboard only.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  InvoicesListSchema,
  InvoiceGetSchema
} from "../schemas/index.js";
import {
  InvoicesListParams,
  InvoiceGetParams
} from "../schemas/index.js";
import { getApiClient } from "../services/api-client.js";
import {
  formatInvoice,
  truncateIfNeeded,
  formatErrorMessage
} from "../services/response-formatter.js";
import { ResponseFormat } from "../types/index.js";

/**
 * Register billing tools
 */
export function registerBillingTools(server: McpServer): void {

  // List invoices
  server.registerTool(
    "sixtydb_list_invoices",
    {
      title: "List Invoices",
      description: `List billing invoices with filtering and pagination.

This tool retrieves all invoices for the workspace with payment status, amounts, and download links.

**Parameters:**
- status ('paid' | 'pending' | 'failed', optional): Filter by payment status
- from_date (string, optional): Filter by start date (ISO 8601 format)
- to_date (string, optional): Filter by end date (ISO 8601 format)
- limit (number, optional): Maximum results to return (1-100, default: 20)
- offset (number, optional): Number of results to skip for pagination (default: 0)
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of invoices with amounts and status
- Download links for PDF invoices
- Payment dates and due dates

For JSON format:
{
  "total": number,
  "count": number,
  "offset": number,
  "invoices": [
    {
      "id": string,
      "amount": number,
      "currency": "USD",
      "status": string,
      "due_date": string,
      "paid_at": string,
      "invoice_url": string
    }
  ],
  "has_more": boolean,
  "next_offset": number
}

**Note:** All billing is USD-only. Wallet top-ups and plan management are done via the Dashboard at https://app.60db.ai.

**Examples:**
- Recent invoices: { "limit": 10 }
- Pending only: { "status": "pending" }
- Date range: { "from_date": "2024-01-01T00:00:00Z", "to_date": "2024-01-31T23:59:59Z" }

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: InvoicesListSchema,
      annotations: {
        title: "List Invoices",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: InvoicesListParams) => {
      try {
        const apiClient = getApiClient();

        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset
        };

        if (params.status) queryParams.status = params.status;
        if (params.from_date) queryParams.from_date = params.from_date;
        if (params.to_date) queryParams.to_date = params.to_date;

        const data = await apiClient.get<{
          invoices: unknown[];
          total: number;
        }>("/billing/invoices", queryParams);

        const invoices = data.invoices || [];
        const total = data.total || invoices.length;
        const hasMore = params.offset + invoices.length < total;

        const lines: string[] = [];
        lines.push(`# Invoices (${total} total)`);
        lines.push("");
        lines.push(`Showing ${invoices.length} invoices (offset: ${params.offset})`);
        lines.push("");

        for (const invoice of invoices as any) {
          lines.push(formatInvoice(invoice, params.response_format));
        }

        if (hasMore) {
          lines.push(`---\n**More results available.** Use offset=${params.offset + invoices.length} to see more.`);
        }

        if (params.response_format === ResponseFormat.JSON) {
          const response = {
            total,
            count: invoices.length,
            offset: params.offset,
            invoices,
            has_more: hasMore,
            next_offset: hasMore ? params.offset + invoices.length : undefined
          };

          const formatted = JSON.stringify(response, null, 2);

          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
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

  // Get invoice details
  server.registerTool(
    "sixtydb_get_invoice",
    {
      title: "Get Invoice Details",
      description: `Get detailed information about a specific invoice.

This tool retrieves complete details for a single invoice including payment status and download links.

**Parameters:**
- id (string, required): Invoice ID
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Complete invoice details
- Payment status and dates
- Download link for PDF

For JSON format:
{
  "id": string,
  "amount": number,
  "currency": "USD",
  "status": string,
  "due_date": string,
  "paid_at": string,
  "invoice_url": string
}

**Examples:**
- Get invoice details: { "id": "inv_abc123" }

**Error Handling:**
- Returns "Error: Invoice not found" if ID doesn't exist (404 status)
- Returns "Error: Access denied" if invoice belongs to different workspace`,
      inputSchema: InvoiceGetSchema,
      annotations: {
        title: "Get Invoice Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: InvoiceGetParams) => {
      try {
        const apiClient = getApiClient();

        const invoice = await apiClient.get<unknown>(`/billing/invoices/${params.id}`);

        const formatted = formatInvoice(invoice as any, params.response_format);

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
