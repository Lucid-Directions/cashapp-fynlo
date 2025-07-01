import AsyncStorage from '@react-native-async-storage/async-storage';

interface SaveCustomerPayload {
  name?: string;
  email: string;
  marketing_opt_in?: boolean;
}

class CustomersService {
  private static instance: CustomersService;
  private baseUrl: string | null = null;
  private apiKey: string | null = null;

  private constructor() {}

  static getInstance(): CustomersService {
    if (!CustomersService.instance) {
      CustomersService.instance = new CustomersService();
    }
    return CustomersService.instance;
  }

  /**
   * Load API config from secure storage (shared with PaymentService)
   */
  async loadConfig(): Promise<void> {
    try {
      const configRaw = await AsyncStorage.getItem('payment_service_config');
      if (!configRaw) return;
      const cfg = JSON.parse(configRaw);
      this.baseUrl = cfg?.backend?.baseUrl ?? null;
      this.apiKey = cfg?.backend?.apiKey ?? null;
    } catch (err) {
      console.warn('CustomersService: failed to load config', err);
    }
  }

  private async ensureConfigLoaded() {
    if (!this.baseUrl || !this.apiKey) {
      await this.loadConfig();
    }
  }

  /**
   * Upsert customer by e-mail (case-insensitive) so we can reuse later.
   */
  async saveCustomer(payload: SaveCustomerPayload): Promise<void> {
    try {
      await this.ensureConfigLoaded();
      if (!this.baseUrl || !this.apiKey) throw new Error('API config missing');

      const res = await fetch(`${this.baseUrl}/api/v1/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn('saveCustomer non-200', res.status);
      }
    } catch (err) {
      console.error('CustomersService.saveCustomer error', err);
    }
  }

  /**
   * Query customers for type-ahead search.
   */
  async search(query: string): Promise<Array<{ id: string; name: string; email: string }>> {
    try {
      await this.ensureConfigLoaded();
      if (!this.baseUrl || !this.apiKey) return [];
      const res = await fetch(`${this.baseUrl}/api/v1/customers?query=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.items ?? [];
    } catch (err) {
      console.error('CustomersService.search error', err);
      return [];
    }
  }
}

export default CustomersService.getInstance(); 