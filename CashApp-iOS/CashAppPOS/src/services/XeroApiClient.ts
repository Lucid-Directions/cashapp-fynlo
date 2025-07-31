import XeroAuthService, { _XeroTokens } from './XeroAuthService';

export interface XeroApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface XeroApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export interface RateLimitInfo {
  remainingRequests: number;
  resetTime: number;
  dailyLimit: number;
  minuteLimit: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

interface QueuedRequest {
  url: string;
  options: RequestOptions;
  resolve: (value: XeroApiResponse) => void;
  reject: (error: XeroApiError) => void;
  timestamp: number;
  retryCount: number;
}

export class XeroApiClient {
  private static instance: XeroApiClient;
  private authService: XeroAuthService;
  private requestQueue: QueuedRequest[] = [];
  private processingQueue = false;

  // Rate limiting configuration
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MAX_REQUESTS_PER_DAY = 5000;
  private readonly MAX_CONCURRENT_REQUESTS = 5;

  // Rate limiting state
  private requestsThisMinute = 0;
  private requestsToday = 0;
  private activeRequests = 0;
  private minuteResetTime = 0;
  private dayResetTime = 0;

  // Configuration
  private readonly BASE_URL = 'https://api.xero.com/api.xro/2.0';
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.authService = XeroAuthService.getInstance();
    this.initializeRateLimiting();
  }

  public static getInstance(): XeroApiClient {
    if (!XeroApiClient.instance) {
      XeroApiClient.instance = new XeroApiClient();
    }
    return XeroApiClient.instance;
  }

  /**
   * Initialize rate limiting timers
   */
  private initializeRateLimiting(): void {
    const now = Date.now();
    this.minuteResetTime = now + 60000; // Reset every minute
    this.dayResetTime = now + 86400000; // Reset every 24 hours

    // Reset minute counter every minute
    setInterval(() => {
      this.requestsThisMinute = 0;
      this.minuteResetTime = Date.now() + 60000;
    }, 60000);

    // Reset daily counter every 24 hours
    setInterval(() => {
      this.requestsToday = 0;
      this.dayResetTime = Date.now() + 86400000;
    }, 86400000);
  }

  /**
   * Make authenticated API request with rate limiting
   */
  public async makeRequest<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<XeroApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        url: endpoint,
        options,
        resolve: resolve as (value: XeroApiResponse) => void,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check rate limits
      if (!this.canMakeRequest()) {
        const waitTime = this.getWaitTime();
        console.log(`Rate limit reached. Waiting ${waitTime}ms`);
        await this.delay(waitTime);
        continue;
      }

      // Check concurrent request limit
      if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
        await this.delay(100); // Short delay before checking again
        continue;
      }

      const request = this.requestQueue.shift();
      if (!request) {
        continue;
      }

      // Check if request has expired (older than 5 minutes)
      if (Date.now() - request.timestamp > 300000) {
        request.reject({
          message: 'Request expired in queue',
          code: 'REQUEST_EXPIRED',
        });
        continue;
      }

      this.executeRequest(request);
    }

    this.processingQueue = false;
  }

  /**
   * Execute individual request
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    this.activeRequests++;
    this.requestsThisMinute++;
    this.requestsToday++;

    try {
      const response = await this.performHttpRequest(request.url, request.options);
      request.resolve(response);
    } catch (error) {
      await this.handleRequestError(error as XeroApiError, request);
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Perform HTTP request
   */
  private async performHttpRequest(
    endpoint: string,
    options: RequestOptions
  ): Promise<XeroApiResponse> {
    const accessToken = await this.authService.getAccessToken();
    if (!accessToken) {
      throw {
        message: 'No valid access token available',
        code: 'AUTH_REQUIRED',
      } as XeroApiError;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Xero-tenant-id': (await this.getTenantId()) || '',
      ...options.headers,
    };

    const requestConfig: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT),
    };

    if (
      options.body &&
      (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')
    ) {
      requestConfig.body =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(url, requestConfig);

    // Update rate limit info from headers
    this.updateRateLimitInfo(response.headers);

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw {
        message: errorData.message || `HTTP ${response.status}`,
        status: response.status,
        code: errorData.code,
        details: errorData,
      } as XeroApiError;
    }

    const data = await response.json();

    return {
      data,
      status: response.status,
      headers: this.headersToObject(response.headers),
    };
  }

  /**
   * Handle request errors with retry logic
   */
  private async handleRequestError(error: XeroApiError, request: QueuedRequest): Promise<void> {
    const shouldRetry = this.shouldRetryRequest(error, request);

    if (shouldRetry && request.retryCount < (request.options.retries || this.MAX_RETRIES)) {
      request.retryCount++;
      const delay = this.calculateRetryDelay(request.retryCount);

      console.log(`Retrying request in ${delay}ms (attempt ${request.retryCount})`);

      setTimeout(() => {
        this.requestQueue.unshift(request); // Add back to front of queue
        this.processQueue();
      }, delay);
    } else {
      request.reject(error);
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetryRequest(error: XeroApiError, _request: QueuedRequest): boolean {
    // Retry on network errors, timeouts, and specific HTTP status codes
    const retryableStatuses = [429, 500, 502, 503, 504];
    return !error.status || retryableStatuses.includes(error.status);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000); // Max 30 seconds
  }

  /**
   * Check if request can be made based on rate limits
   */
  private canMakeRequest(): boolean {
    return (
      this.requestsThisMinute < this.MAX_REQUESTS_PER_MINUTE &&
      this.requestsToday < this.MAX_REQUESTS_PER_DAY
    );
  }

  /**
   * Calculate wait time until next request can be made
   */
  private getWaitTime(): number {
    if (this.requestsThisMinute >= this.MAX_REQUESTS_PER_MINUTE) {
      return this.minuteResetTime - Date.now();
    }
    if (this.requestsToday >= this.MAX_REQUESTS_PER_DAY) {
      return this.dayResetTime - Date.now();
    }
    return 0;
  }

  /**
   * Get rate limit information
   */
  public getRateLimitInfo(): RateLimitInfo {
    return {
      remainingRequests: Math.min(
        this.MAX_REQUESTS_PER_MINUTE - this.requestsThisMinute,
        this.MAX_REQUESTS_PER_DAY - this.requestsToday
      ),
      resetTime: Math.min(this.minuteResetTime, this.dayResetTime),
      dailyLimit: this.MAX_REQUESTS_PER_DAY,
      minuteLimit: this.MAX_REQUESTS_PER_MINUTE,
    };
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining) {
      // Adjust internal counters based on server response
      const serverRemaining = parseInt(remaining, 10);
      this.requestsThisMinute = Math.max(0, this.MAX_REQUESTS_PER_MINUTE - serverRemaining);
    }

    if (reset) {
      this.minuteResetTime = parseInt(reset, 10) * 1000; // Convert to milliseconds
    }
  }

  /**
   * Get current tenant ID
   */
  private async getTenantId(): Promise<string | null> {
    try {
      const tokens = await this.authService.getStoredTokens();
      return tokens?.tenant_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Parse error response
   */
  private async parseErrorResponse(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return { message: await response.text() };
      }
    } catch {
      return { message: `HTTP ${response.status}` };
    }
  }

  /**
   * Convert Headers to plain object
   */
  private headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/Organisation');
      return response.status === 200;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get organization information
   */
  public async getOrganisation(): Promise<unknown> {
    const response = await this.makeRequest('/Organisation');
    return response.data;
  }

  /**
   * Get contacts (customers)
   */
  public async getContacts(params: Record<string, unknown> = {}): Promise<unknown> {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/Contacts${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  /**
   * Get items (products)
   */
  public async getItems(params: Record<string, unknown> = {}): Promise<unknown> {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/Items${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  /**
   * Get invoices
   */
  public async getInvoices(params: Record<string, unknown> = {}): Promise<unknown> {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/Invoices${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  /**
   * Create invoice
   */
  public async createInvoice(invoice: unknown): Promise<unknown> {
    const response = await this.makeRequest('/Invoices', {
      method: 'POST',
      body: invoice,
    });
    return response.data;
  }

  /**
   * Create contact
   */
  public async createContact(contact: unknown): Promise<unknown> {
    const response = await this.makeRequest('/Contacts', {
      method: 'POST',
      body: contact,
    });
    return response.data;
  }

  /**
   * Get queue status for monitoring
   */
  public getQueueStatus(): {
    queueLength: number;
    activeRequests: number;
    requestsThisMinute: number;
    requestsToday: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      requestsThisMinute: this.requestsThisMinute,
      requestsToday: this.requestsToday,
    };
  }
}

export default XeroApiClient;
