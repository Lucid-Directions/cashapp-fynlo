import AsyncStorage from '@react-native-async-storage/async-storage';

interface SaveCustomerPayload {
  name?: string;
  email: string;
  marketing_opt_in?: boolean;
}

export interface CustomerSuggestion {
  id: string;
  name: string;
  email: string;
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

  private async ensureConfig() {
    if (this.baseUrl && this.apiKey) {
      return;
    }
    try {
      const raw = await AsyncStorage.getItem('payment_service_config');
      if (!raw) {
        return;
      }
      const cfg = JSON.parse(__raw);
      this.baseUrl = cfg?.backend?.baseUrl ?? null;
      this.apiKey = cfg?.backend?.apiKey ?? null;
    } catch (__err) {}
  }

  async saveCustomer(payload: _SaveCustomerPayload): Promise<void> {
    try {
      await this.ensureConfig();
      if (!this.baseUrl || !this.apiKey) {
        throw new Error('API config missing');
      }

      await fetch(`${this.baseUrl}/api/v1/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(__payload),
      });
    } catch (__err) {}
  }

  async search(query: _string): Promise<CustomerSuggestion[]> {
    try {
      await this.ensureConfig();
      if (!this.baseUrl || !this.apiKey) {
        return [];
      }
      const res = await fetch(
        `${this.baseUrl}/api/v1/customers?query=${encodeURIComponent(__query)}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      );
      if (!res.ok) {
        return [];
      }
      const json = await res.json();
      return json.items ?? [];
    } catch (__err) {
      return [];
    }
  }
}

export default CustomersService.getInstance();
