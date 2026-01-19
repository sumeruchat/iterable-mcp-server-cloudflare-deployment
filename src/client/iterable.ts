/**
 * Fetch-based Iterable API client for Cloudflare Workers
 * Replaces the axios-based @iterable/api client
 */

export interface IterableClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class IterableApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown
  ) {
    super(`Iterable API error: ${status} ${statusText}`);
    this.name = "IterableApiError";
  }
}

/**
 * Fetch-based Iterable API client compatible with Cloudflare Workers
 */
export class IterableClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: IterableClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.iterable.com";
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Add query params if provided
    if (options?.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "iterable-mcp-cloudflare/1.0.0",
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new IterableApiError(response.status, response.statusText, body);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      // Try to parse as JSON, fallback to raw text
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (error) {
      // Network errors, DNS failures, etc.
      if (error instanceof IterableApiError) {
        throw error;
      }
      throw new IterableApiError(
        0,
        "Network Error",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ==================== CAMPAIGNS ====================

  async getCampaigns(params?: {
    page?: number;
    pageSize?: number;
    sort?: string;
  }) {
    return this.request<{
      campaigns: Array<{
        id: number;
        name: string;
        type: string;
        campaignState: string;
        messageMedium: string;
        createdAt: number;
        updatedAt: number;
      }>;
      totalCampaignsCount: number;
    }>("GET", "/api/campaigns", {
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        sort: params?.sort,
      },
    });
  }

  async getCampaign(id: number) {
    return this.request<{
      id: number;
      name: string;
      type: string;
      campaignState: string;
      messageMedium: string;
      createdAt: number;
      updatedAt: number;
      templateId?: number;
      listIds?: number[];
    }>("GET", `/api/campaigns/${id}`);
  }

  async getCampaignMetrics(params: {
    campaignId: number;
    startDateTime?: string;
    endDateTime?: string;
  }) {
    return this.request<string>("GET", "/api/campaigns/metrics", {
      params: {
        campaignId: params.campaignId,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
      },
    });
  }

  async getChildCampaigns(params: {
    id: number;
    page?: number;
    pageSize?: number;
  }) {
    return this.request<{
      campaigns: Array<{
        id: number;
        name: string;
        type: string;
        campaignState: string;
      }>;
      totalCampaignsCount: number;
    }>("GET", `/api/campaigns/recurring/${params.id}/childCampaigns`, {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });
  }

  // ==================== TEMPLATES ====================

  async getTemplates(params?: {
    templateType?: string;
    messageMedium?: string;
    startDateTime?: string;
    endDateTime?: string;
  }) {
    return this.request<{
      templates: Array<{
        templateId: number;
        name: string;
        templateType: string;
        messageMedium: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("GET", "/api/templates", {
      params: {
        templateType: params?.templateType,
        messageMedium: params?.messageMedium,
        startDateTime: params?.startDateTime,
        endDateTime: params?.endDateTime,
      },
    });
  }

  async getEmailTemplate(params: { templateId: number; locale?: string }) {
    return this.request<{
      templateId: number;
      name: string;
      fromEmail: string;
      fromName: string;
      subject: string;
      html: string;
      plainText?: string;
    }>("GET", "/api/templates/email/get", {
      params: {
        templateId: params.templateId,
        locale: params.locale,
      },
    });
  }

  async getSMSTemplate(params: { templateId: number; locale?: string }) {
    return this.request<{
      templateId: number;
      name: string;
      message: string;
    }>("GET", "/api/templates/sms/get", {
      params: {
        templateId: params.templateId,
        locale: params.locale,
      },
    });
  }

  async getPushTemplate(params: { templateId: number; locale?: string }) {
    return this.request<{
      templateId: number;
      name: string;
      title: string;
      body: string;
    }>("GET", "/api/templates/push/get", {
      params: {
        templateId: params.templateId,
        locale: params.locale,
      },
    });
  }

  async getInAppTemplate(params: { templateId: number; locale?: string }) {
    return this.request<{
      templateId: number;
      name: string;
      html: string;
    }>("GET", "/api/templates/inapp/get", {
      params: {
        templateId: params.templateId,
        locale: params.locale,
      },
    });
  }

  async getTemplateByClientId(clientTemplateId: string) {
    return this.request<{
      templateId: number;
      clientTemplateId: string;
      name: string;
    }>("GET", "/api/templates/getByClientTemplateId", {
      params: { clientTemplateId },
    });
  }

  // ==================== USERS ====================

  async getUserByEmail(email: string) {
    return this.request<{
      user: {
        email: string;
        userId?: string;
        dataFields?: Record<string, unknown>;
        signupDate?: string;
      };
    }>("GET", `/api/users/${encodeURIComponent(email)}`);
  }

  async getUserByUserId(userId: string) {
    return this.request<{
      user: {
        email: string;
        userId: string;
        dataFields?: Record<string, unknown>;
        signupDate?: string;
      };
    }>("GET", `/api/users/byUserId/${encodeURIComponent(userId)}`);
  }

  async getUserFields() {
    return this.request<{
      fields: Array<{
        name: string;
        type: string;
      }>;
    }>("GET", "/api/users/getFields");
  }

  async getSentMessages(params: {
    email?: string;
    userId?: string;
    limit?: number;
    campaignIds?: number[];
    startDateTime?: string;
    endDateTime?: string;
    messageMedium?: string;
  }) {
    const queryParams: Record<string, string | number | undefined> = {
      email: params.email,
      userId: params.userId,
      limit: params.limit,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      messageMedium: params.messageMedium,
    };

    // Handle array params
    let path = "/api/users/getSentMessages";
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }

    if (params.campaignIds) {
      for (const id of params.campaignIds) {
        searchParams.append("campaignIds", String(id));
      }
    }

    const queryString = searchParams.toString();
    if (queryString) {
      path += `?${queryString}`;
    }

    return this.request<{
      messages: Array<{
        messageId: string;
        campaignId: number;
        messageStatus: string;
        createdAt: string;
      }>;
    }>("GET", path);
  }

  // ==================== LISTS ====================

  async getLists() {
    return this.request<{
      lists: Array<{
        id: number;
        name: string;
        listType: string;
        createdAt: number;
      }>;
    }>("GET", "/api/lists");
  }

  async getListSize(listId: number) {
    const result = await this.request<string>("GET", `/api/lists/${listId}/size`);
    return { size: parseInt(result, 10) };
  }

  async getListUsers(params: { listId: number; maxResults?: number }) {
    const result = await this.request<string>("GET", "/api/lists/getUsers", {
      params: {
        listId: params.listId,
        maxResults: params.maxResults,
      },
    });

    // Parse newline-delimited email addresses
    if (typeof result === "string") {
      const emails = result
        .trim()
        .split("\n")
        .filter((email) => email.trim());
      return { users: emails.map((email) => ({ email: email.trim() })) };
    }

    return result as unknown as { users: Array<{ email: string }> };
  }

  // ==================== CHANNELS ====================

  async getChannels() {
    return this.request<{
      channels: Array<{
        id: number;
        name: string;
        channelType: string;
      }>;
    }>("GET", "/api/channels");
  }

  async getMessageTypes() {
    return this.request<{
      messageTypes: Array<{
        id: number;
        name: string;
        channelId: number;
      }>;
    }>("GET", "/api/messageTypes");
  }

  // ==================== EVENTS ====================

  async getUserEventsByEmail(params: {
    email: string;
    limit?: number;
  }) {
    return this.request<{
      events: Array<{
        eventName: string;
        createdAt: number;
        dataFields?: Record<string, unknown>;
      }>;
    }>("GET", "/api/events", {
      params: {
        email: params.email,
        limit: params.limit,
      },
    });
  }

  async getUserEventsByUserId(params: {
    userId: string;
    limit?: number;
  }) {
    return this.request<{
      events: Array<{
        eventName: string;
        createdAt: number;
        dataFields?: Record<string, unknown>;
      }>;
    }>("GET", "/api/events", {
      params: {
        userId: params.userId,
        limit: params.limit,
      },
    });
  }

  // ==================== JOURNEYS ====================

  async getJourneys() {
    return this.request<{
      journeys: Array<{
        id: number;
        name: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("GET", "/api/journeys");
  }

  // ==================== EXPERIMENTS ====================

  async getExperimentMetrics(params: { experimentId: number }) {
    return this.request<{
      experimentId: number;
      metrics: Record<string, unknown>;
    }>("GET", `/api/experiments/metrics/${params.experimentId}`);
  }

  // ==================== WEBHOOKS ====================

  async getWebhooks() {
    return this.request<{
      webhooks: Array<{
        id: string;
        url: string;
        events: string[];
        enabled: boolean;
      }>;
    }>("GET", "/api/webhooks");
  }

  // ==================== SNIPPETS ====================

  async getSnippets() {
    return this.request<{
      snippets: Array<{
        id: number;
        name: string;
        content: string;
      }>;
    }>("GET", "/api/snippets");
  }

  async getSnippet(id: number) {
    return this.request<{
      id: number;
      name: string;
      content: string;
    }>("GET", `/api/snippets/${id}`);
  }

  // ==================== CATALOGS ====================

  async getCatalogs() {
    return this.request<{
      catalogs: Array<{
        name: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("GET", "/api/catalogs");
  }

  async getCatalogItems(params: {
    catalogName: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.request<{
      items: Array<Record<string, unknown>>;
      totalItemsCount: number;
    }>("GET", `/api/catalogs/${params.catalogName}/items`, {
      params: {
        page: params.page,
        pageSize: params.pageSize,
      },
    });
  }

  async getCatalogItem(params: { catalogName: string; itemId: string }) {
    return this.request<Record<string, unknown>>(
      "GET",
      `/api/catalogs/${params.catalogName}/items/${params.itemId}`
    );
  }
}
