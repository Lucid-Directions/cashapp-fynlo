import * as Keychain from 'react-native-keychain';

export class SecurePaymentConfig {
  static async storeCredentials(provider: string, credentials: any): Promise<boolean> {
    try {
      return await Keychain.setInternetCredentials(
        `payment_${provider}`,
        'credentials',
        JSON.stringify(credentials)
      );
    } catch (error) {
      console.error('Failed to store credentials:', error);
      return false;
    }
  }

  static async getCredentials(provider: string): Promise<any> {
    try {
      const result = await Keychain.getInternetCredentials(`payment_${provider}`);
      if (result && result.password) {
        return JSON.parse(result.password);
      }
      return null;
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  }

  static async removeCredentials(provider: string): Promise<boolean> {
    try {
      return await Keychain.resetInternetCredentials(`payment_${provider}`);
    } catch (error) {
      console.error('Failed to remove credentials:', error);
      return false;
    }
  }
}
