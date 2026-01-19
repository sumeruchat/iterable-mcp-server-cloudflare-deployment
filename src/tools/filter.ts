/**
 * Tool filtering system for MCP server restrictions
 * Ported from @iterable/mcp - uses safe-list approach
 */

import type { McpServerConfig } from "../types/env.js";

/**
 * Tools that don't expose user PII
 */
export const NON_PII_TOOLS: Set<string> = new Set([
  "abort_campaign",
  "activate_triggered_campaign",
  "archive_campaigns",
  "bulk_delete_catalog_items",
  "cancel_campaign",
  "create_campaign",
  "create_catalog",
  "create_list",
  "create_snippet",
  "deactivate_triggered_campaign",
  "delete_catalog",
  "delete_catalog_item",
  "delete_list",
  "delete_snippet",
  "delete_templates",
  "get_campaign",
  "get_campaign_metrics",
  "get_campaigns",
  "get_catalog_field_mappings",
  "get_catalog_item",
  "get_catalog_items",
  "get_catalogs",
  "get_channels",
  "get_child_campaigns",
  "get_email_template",
  "get_experiment_metrics",
  "get_inapp_template",
  "get_journeys",
  "get_list_size",
  "get_lists",
  "get_message_types",
  "get_push_template",
  "get_sms_template",
  "get_snippet",
  "get_snippets",
  "get_template_by_client_id",
  "get_templates",
  "get_user_fields",
  "get_webhooks",
  "partial_update_catalog_item",
  "preview_email_template",
  "preview_inapp_template",
  "replace_catalog_item",
  "schedule_campaign",
  "send_campaign",
  "trigger_campaign",
  "update_catalog_field_mappings",
  "update_catalog_items",
  "update_email_template",
  "update_inapp_template",
  "update_push_template",
  "update_sms_template",
  "update_snippet",
  "update_webhook",
  "upsert_email_template",
  "upsert_inapp_template",
  "upsert_push_template",
  "upsert_sms_template",
]);

/**
 * Tools that only read data (no modifications)
 */
export const READ_ONLY_TOOLS: Set<string> = new Set([
  "get_campaign",
  "get_campaign_metrics",
  "get_campaigns",
  "get_catalog_field_mappings",
  "get_catalog_item",
  "get_catalog_items",
  "get_catalogs",
  "get_channels",
  "get_child_campaigns",
  "get_email_template",
  "get_embedded_messages",
  "get_experiment_metrics",
  "get_export_files",
  "get_export_jobs",
  "get_in_app_messages",
  "get_inapp_template",
  "get_journeys",
  "get_list_preview_users",
  "get_list_size",
  "get_list_users",
  "get_lists",
  "get_message_types",
  "get_push_template",
  "get_sent_messages",
  "get_sms_template",
  "get_snippet",
  "get_snippets",
  "get_template_by_client_id",
  "get_templates",
  "get_user_by_email",
  "get_user_by_user_id",
  "get_user_events_by_email",
  "get_user_events_by_user_id",
  "get_user_fields",
  "get_webhooks",
  "preview_email_template",
  "preview_inapp_template",
]);

/**
 * Tools that can directly or indirectly trigger sending messages
 */
export const SEND_TOOLS: Set<string> = new Set([
  // Campaign sends and enablers
  "send_campaign",
  "trigger_campaign",
  "schedule_campaign",
  "create_campaign",
  "activate_triggered_campaign",
  // Journey triggers
  "trigger_journey",
  // Events may drive sends
  "track_event",
  "track_bulk_events",
  // Direct messaging
  "send_email",
  "send_sms",
  "send_whatsapp",
  "send_web_push",
  "send_push",
  "send_in_app",
  // Template proofs
  "send_email_template_proof",
  "send_sms_template_proof",
  "send_push_template_proof",
  "send_inapp_template_proof",
]);

/**
 * Check if a tool should be available based on configuration
 */
export function isToolAllowed(toolName: string, config: McpServerConfig): boolean {
  // Check PII restriction
  if (!config.allowUserPii && !NON_PII_TOOLS.has(toolName)) {
    return false;
  }

  // Check write restriction
  if (!config.allowWrites && !READ_ONLY_TOOLS.has(toolName)) {
    return false;
  }

  // Check send restriction
  if (!config.allowSends && SEND_TOOLS.has(toolName)) {
    return false;
  }

  return true;
}

/**
 * Get a human-readable reason why a tool is blocked
 */
export function getBlockedReason(toolName: string, config: McpServerConfig): string | null {
  if (!config.allowUserPii && !NON_PII_TOOLS.has(toolName)) {
    return "This tool exposes user PII. Enable with ITERABLE_USER_PII=true";
  }

  if (!config.allowWrites && !READ_ONLY_TOOLS.has(toolName)) {
    return "This tool modifies data. Enable with ITERABLE_ENABLE_WRITES=true";
  }

  if (!config.allowSends && SEND_TOOLS.has(toolName)) {
    return "This tool can send messages. Enable with ITERABLE_ENABLE_SENDS=true";
  }

  return null;
}
