/**
 * Billing Tools
 * Tools for plans, subscriptions, and invoices
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PlansListSchema,
  SubscriptionGetSchema,
  InvoicesListSchema,
  InvoiceGetSchema
} from "../schemas/index.js";
import {
  PlansListParams,
  SubscriptionGetParams,
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
  // List available plans
  server.registerTool(
    "sixtydb_list_plans",
    {
      title: "List Available Plans",
      description: `List all available subscription plans with pricing and features.

This tool retrieves all available subscription plans including free, pro, and enterprise tiers with their respective pricing and feature sets.

**Parameters:**
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- List of all plans with pricing
- Feature comparison between plans
- Billing intervals (monthly/yearly)

For JSON format:
{
  "plans": [                // Array of plan objects
    {
      "id": string,          // Plan ID
      "name": string,        // Plan name (e.g., "Free", "Pro", "Enterprise")
      "price": number,       // Plan price
      "currency": string,    // Currency code (USD, EUR)
      "interval": string,    // Billing interval: monthly|yearly
      "credits": number,     // Monthly credit allowance
      "features": string[]   // List of features included
    }
  ],
  "total": number           // Total number of plans
}

**Plan Tiers:**
- **Free**: Basic features with limited credits
- **Pro**: Full access with generous credit allowance
- **Enterprise**: Custom plans with unlimited credits

**Use Cases:**
- Compare available plans
- Review feature sets
- Plan upgrades or downgrades
- Check pricing for billing decisions

**Examples:**
- List all plans: {}

**Error Handling:**
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: PlansListSchema,
      annotations: {
        title: "List Available Plans",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: PlansListParams) => {
      try {
        const apiClient = getApiClient();

        const plans = await apiClient.get<unknown[]>("/plans");

        const lines: string[] = [];
        lines.push(`# Available Subscription Plans (${plans.length})`);
        lines.push("");

        if (params.response_format === ResponseFormat.JSON) {
          const response = { plans, total: plans.length };
          const formatted = JSON.stringify(response, null, 2);

          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
        }

        // Markdown format
        for (const plan of plans as any) {
          lines.push(`## ${plan.name}`);
          lines.push("");
          lines.push(`- **Price**: ${plan.currency === "USD" ? "$" : "€"}${plan.price}/${plan.interval}`);
          lines.push(`- **Credits**: ${plan.credits.toLocaleString()} credits/month`);
          lines.push(`- **Features**:`);
          for (const feature of plan.features) {
            lines.push(`  - ${feature}`);
          }
          lines.push(`- **Plan ID**: \`${plan.id}\``);
          lines.push("");
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

  // Get current subscription
  server.registerTool(
    "sixtydb_get_subscription",
    {
      title: "Get Current Subscription",
      description: `Retrieve details of the current active subscription.

This tool provides information about the user's current subscription plan, billing period, and subscription status.

**Parameters:**
- response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

**Returns:**
For Markdown format (default):
- Current plan details
- Billing period information
- Subscription status and renewal info

For JSON format:
{
  "id": string,                  // Subscription ID
  "plan_id": string,             // Current plan ID
  "plan_name": string,           // Plan name
  "status": string,              // active|cancelled|expired|past_due
  "current_period_start": string, // Current period start
  "current_period_end": string,   // Current period end
  "cancel_at_period_end": boolean, // Will cancel at period end
  "credits_remaining": number,    // Credits left this period
  "credits_used": number          // Credits used this period
}

**Subscription Statuses:**
- **active**: Subscription is active and renewing
- **cancelled**: Will cancel at period end
- **expired**: Subscription has ended
- **past_due**: Payment failed, action required

**Use Cases:**
- Check current plan status
- Verify billing period dates
- Confirm cancellation status
- Review credit allowance

**Examples:**
- Get subscription: {}

**Error Handling:**
- Returns "Error: No active subscription" if user has no subscription
- Returns "Error: Authentication required" if API key/JWT is invalid`,
      inputSchema: SubscriptionGetSchema,
      annotations: {
        title: "Get Current Subscription",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SubscriptionGetParams) => {
      try {
        const apiClient = getApiClient();

        const subscription = await apiClient.get<unknown>("/billing/current-plan");

        const lines: string[] = [];
        lines.push(`# Current Subscription`);
        lines.push("");

        const sub = subscription as any;
        const plan = sub.plan || {};

        lines.push(`## Plan: ${plan.name || sub.plan_id}`);
        lines.push("");
        lines.push(`- **Status**: ${sub.status?.toUpperCase()}`);
        lines.push(`- **Period**: ${formatDate(sub.current_period_start)} to ${formatDate(sub.current_period_end)}`);
        lines.push(`- **Price**: ${plan.currency === "USD" ? "$" : "€"}${plan.price}/${plan.interval}`);
        lines.push(`- **Credits**: ${sub.credits_used?.toLocaleString() || 0} / ${plan.credits?.toLocaleString() || 0} used`);
        if (sub.cancel_at_period_end) {
          lines.push(`- **⚠️ Cancelling**: Subscription will end at period end`);
        }
        lines.push("");

        if (params.response_format === ResponseFormat.JSON) {
          const formatted = JSON.stringify(subscription, null, 2);

          const { content } = truncateIfNeeded(formatted, true);

          return {
            content: [{ type: "text", text: content }]
          };
        }

        function formatDate(dateString: string): string {
          try {
            const date = new Date(dateString);
            return date.toISOString().split("T")[0];
          } catch {
            return dateString;
          }
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

  // List invoices
  server.registerTool(
    "sixtydb_list_invoices",
    {
      title: "List Invoices",
      description: `List billing invoices with filtering and pagination.

This tool retrieves all invoices for the account with payment status, amounts, and download links.

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
  "invoices": [              // Array of invoice objects
    {
      "id": string,           // Invoice ID
      "amount": number,       // Invoice amount
      "currency": string,     // Currency code
      "status": string,       // paid|pending|failed
      "due_date": string,     // Payment due date
      "paid_at": string,      // Payment date (if paid)
      "invoice_url": string   // Download URL
    }
  ],
  "has_more": boolean,
  "next_offset": number
}

**Invoice Statuses:**
- **paid**: Successfully paid
- **pending**: Awaiting payment
- **failed**: Payment failed, retry needed

**Use Cases:**
- Review billing history
- Download paid invoices
- Check for unpaid invoices
- Track payment status

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

This tool retrieves complete details for a single invoice including line items, payment status, and download links.

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
  "id": string,              // Invoice ID
  "amount": number,          // Invoice amount
  "currency": string,        // Currency code
  "status": string,          // paid|pending|failed
  "due_date": string,        // Payment due date
  "paid_at": string,         // Payment date (if paid)
  "invoice_url": string,     // PDF download URL
  "line_items": [            // Invoice line items
    {
      "description": string,
      "amount": number
    }
  ]
}

**Use Cases:**
- Review specific invoice details
- Download invoice PDF
- Verify payment status
- Check billing breakdown

**Examples:**
- Get invoice details: { "id": "inv_abc123" }

**Error Handling:**
- Returns "Error: Invoice not found" if ID doesn't exist (404 status)
- Returns "Error: Access denied" if invoice belongs to different account`,
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
