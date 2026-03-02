"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ResendError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Resend API error ${status}: ${body}`);
    this.name = "ResendError";
  }
}

// ─── Template Definitions ─────────────────────────────────────────────────────

interface EmailTemplate {
  subject: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: Record<string, EmailTemplate> = {
  flagged_call_admin: {
    subject:
      "{{programName}} — Flagged Call — {{coachName}} — Call #{{callNumber}} — {{score}}/100",
    body: `{{adminName}},

{{coachName}}'s Call #{{callNumber}} ({{callTitle}}) scored {{score}}/100 and has been flagged for review.

Key concerns: {{concern1}}{{#concern2}}; {{concern2}}{{/concern2}}

Review the full report here: {{reportUrl}}`,
  },

  report_sent_to_coach: {
    subject:
      "{{coachName}}, {{adminName}} has shared feedback from your {{callDate}} call",
    body: `Hi {{coachName}},

{{adminName}} has shared feedback from your {{callDate}} coaching call (Call #{{callNumber}}: {{callTitle}}).

You can view the full report in your dashboard: {{coachPortalUrl}}`,
  },
};

// ─── Variable Substitution ────────────────────────────────────────────────────

/**
 * Substitutes {{variable_name}} placeholders in a template string.
 *
 * Supports:
 * - Simple substitution: {{key}} → variables[key]
 * - Conditional sections: {{#key}}content{{/key}} — rendered only if key exists and is truthy
 * - Unmatched variables are left as-is (not replaced with empty string)
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  // Process conditional sections first: {{#key}}content{{/key}}
  let result = template.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key: string, content: string) => {
      const value = variables[key];
      if (value !== undefined && value !== null && value !== "") {
        // Substitute the key inside the conditional block content
        return content.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => {
          return variables[k] !== undefined ? variables[k] : `{{${k}}}`;
        });
      }
      return "";
    }
  );

  // Process simple substitutions: {{key}} → value
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });

  return result;
}

// ─── Internal Action ──────────────────────────────────────────────────────────

/**
 * Sends a transactional notification email via Resend.
 *
 * Called from the agent pipeline — internal only. Email sends are
 * fire-and-forget: callers should catch ResendError and log it rather
 * than letting it fail the run.
 */
export const sendNotificationEmail = internalAction({
  args: {
    templateName: v.string(),
    to: v.string(),
    subject: v.optional(v.string()),
    variables: v.record(v.string(), v.string()),
    fromEmail: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    { templateName, to, subject, variables, fromEmail }
  ): Promise<{ messageId: string }> => {
    const template = NOTIFICATION_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }

    const resolvedSubject = substituteVariables(
      subject ?? template.subject,
      variables
    );
    const resolvedBody = substituteVariables(template.body, variables);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    const from = fromEmail ?? "noreply@onplinth.ai";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: resolvedSubject,
        html: resolvedBody.replace(/\n/g, "<br>"),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ResendError(response.status, body);
    }

    const data = (await response.json()) as { id: string };
    return { messageId: data.id };
  },
});
