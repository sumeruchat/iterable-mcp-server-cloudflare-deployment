/**
 * Unit tests for tool filtering
 */

import { describe, it, expect } from "vitest";
import {
  isToolAllowed,
  getBlockedReason,
  NON_PII_TOOLS,
  READ_ONLY_TOOLS,
  SEND_TOOLS,
} from "./filter";
import type { McpServerConfig } from "../types/env";

describe("Tool Filter", () => {
  describe("isToolAllowed", () => {
    it("should allow read-only non-PII tools with default config", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // Tool that is both read-only and non-PII
      expect(isToolAllowed("get_campaigns", config)).toBe(true);
      expect(isToolAllowed("get_templates", config)).toBe(true);
      expect(isToolAllowed("get_lists", config)).toBe(true);
    });

    it("should block PII tools when allowUserPii is false", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // Tools that expose PII
      expect(isToolAllowed("get_user_by_email", config)).toBe(false);
      expect(isToolAllowed("get_user_by_user_id", config)).toBe(false);
      expect(isToolAllowed("get_user_events_by_email", config)).toBe(false);
    });

    it("should allow PII tools when allowUserPii is true", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: false,
      };

      expect(isToolAllowed("get_user_by_email", config)).toBe(true);
      expect(isToolAllowed("get_user_by_user_id", config)).toBe(true);
    });

    it("should block write tools when allowWrites is false", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // Write tools (not in READ_ONLY_TOOLS)
      expect(isToolAllowed("create_campaign", config)).toBe(false);
      expect(isToolAllowed("update_user", config)).toBe(false);
      expect(isToolAllowed("delete_list", config)).toBe(false);
    });

    it("should allow write tools when allowWrites is true", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: false,
      };

      // Non-send write tools
      expect(isToolAllowed("abort_campaign", config)).toBe(true);
    });

    it("should block send tools when allowSends is false", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: false,
      };

      expect(isToolAllowed("send_campaign", config)).toBe(false);
      expect(isToolAllowed("trigger_campaign", config)).toBe(false);
      expect(isToolAllowed("send_email", config)).toBe(false);
    });

    it("should allow send tools when allowSends is true", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
      };

      expect(isToolAllowed("send_campaign", config)).toBe(true);
      expect(isToolAllowed("send_email", config)).toBe(true);
    });

    it("should enforce all restrictions together", () => {
      const restrictedConfig: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // Tool that is read-only, non-PII, non-send should work
      expect(isToolAllowed("get_campaigns", restrictedConfig)).toBe(true);

      // Tool that requires PII should fail
      expect(isToolAllowed("get_user_by_email", restrictedConfig)).toBe(false);

      const permissiveConfig: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
      };

      // Everything should work with permissive config
      expect(isToolAllowed("get_campaigns", permissiveConfig)).toBe(true);
      expect(isToolAllowed("get_user_by_email", permissiveConfig)).toBe(true);
      expect(isToolAllowed("send_campaign", permissiveConfig)).toBe(true);
    });
  });

  describe("getBlockedReason", () => {
    it("should return PII reason when blocked by PII restriction", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      const reason = getBlockedReason("get_user_by_email", config);
      expect(reason).toContain("PII");
      expect(reason).toContain("ITERABLE_USER_PII=true");
    });

    it("should return write reason when blocked by write restriction", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: false,
      };

      const reason = getBlockedReason("create_campaign", config);
      expect(reason).toContain("modifies data");
      expect(reason).toContain("ITERABLE_ENABLE_WRITES=true");
    });

    it("should return send reason when blocked by send restriction", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: false,
      };

      const reason = getBlockedReason("send_campaign", config);
      expect(reason).toContain("send messages");
      expect(reason).toContain("ITERABLE_ENABLE_SENDS=true");
    });

    it("should return null when tool is allowed", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      const reason = getBlockedReason("get_campaigns", config);
      expect(reason).toBeNull();
    });

    it("should prioritize PII check first", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // send_email requires PII, writes, AND sends
      // Should return PII reason first
      const reason = getBlockedReason("send_email", config);
      expect(reason).toContain("PII");
    });
  });

  describe("Tool categorization", () => {
    it("NON_PII_TOOLS should not overlap with PII-requiring tools", () => {
      // These tools require PII so should NOT be in NON_PII_TOOLS
      expect(NON_PII_TOOLS.has("get_user_by_email")).toBe(false);
      expect(NON_PII_TOOLS.has("get_user_by_user_id")).toBe(false);
      expect(NON_PII_TOOLS.has("get_sent_messages")).toBe(false);
    });

    it("READ_ONLY_TOOLS should include all get_ tools", () => {
      expect(READ_ONLY_TOOLS.has("get_campaigns")).toBe(true);
      expect(READ_ONLY_TOOLS.has("get_templates")).toBe(true);
      expect(READ_ONLY_TOOLS.has("get_lists")).toBe(true);
    });

    it("READ_ONLY_TOOLS should not include write operations", () => {
      expect(READ_ONLY_TOOLS.has("create_campaign")).toBe(false);
      expect(READ_ONLY_TOOLS.has("update_user")).toBe(false);
      expect(READ_ONLY_TOOLS.has("delete_list")).toBe(false);
    });

    it("SEND_TOOLS should include all sending operations", () => {
      expect(SEND_TOOLS.has("send_campaign")).toBe(true);
      expect(SEND_TOOLS.has("send_email")).toBe(true);
      expect(SEND_TOOLS.has("trigger_campaign")).toBe(true);
      expect(SEND_TOOLS.has("track_event")).toBe(true);
    });

    it("SEND_TOOLS should not include read-only tools", () => {
      expect(SEND_TOOLS.has("get_campaigns")).toBe(false);
      expect(SEND_TOOLS.has("get_user_by_email")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle unknown tool names conservatively", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      // Unknown tool should be blocked by default (safe-list approach)
      expect(isToolAllowed("unknown_tool", config)).toBe(false);
    });

    it("should handle empty tool name", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      expect(isToolAllowed("", config)).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("default config should allow basic campaign browsing", () => {
      const defaultConfig: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      expect(isToolAllowed("get_campaigns", defaultConfig)).toBe(true);
      expect(isToolAllowed("get_campaign", defaultConfig)).toBe(true);
      expect(isToolAllowed("get_campaign_metrics", defaultConfig)).toBe(true);
      expect(isToolAllowed("get_templates", defaultConfig)).toBe(true);
    });

    it("analytics config should allow user events", () => {
      const analyticsConfig: McpServerConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: false,
      };

      expect(isToolAllowed("get_user_by_email", analyticsConfig)).toBe(true);
      expect(isToolAllowed("get_user_events_by_email", analyticsConfig)).toBe(true);
      expect(isToolAllowed("get_sent_messages", analyticsConfig)).toBe(true);
    });

    it("full access config should allow everything", () => {
      const fullAccessConfig: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
      };

      expect(isToolAllowed("get_campaigns", fullAccessConfig)).toBe(true);
      expect(isToolAllowed("get_user_by_email", fullAccessConfig)).toBe(true);
      expect(isToolAllowed("create_campaign", fullAccessConfig)).toBe(true);
      expect(isToolAllowed("send_email", fullAccessConfig)).toBe(true);
    });
  });
});
