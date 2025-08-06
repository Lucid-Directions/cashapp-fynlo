import { SecurePaymentConfig } from '../../src/services/SecurePaymentConfig';
import * as Keychain from 'react-native-keychain';

jest.mock('react-native-keychain');

describe('SecurePaymentConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store credentials securely', async () => {
    const credentials = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
    };

    (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

    const result = await SecurePaymentConfig.storeCredentials('stripe', credentials);

    expect(result).toBe(true);
    expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
      'payment_stripe',
      'credentials',
      JSON.stringify(credentials)
    );
  });

  it('should retrieve credentials', async () => {
    const credentials = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
    };

    (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
      password: JSON.stringify(credentials),
    });

    const result = await SecurePaymentConfig.getCredentials('stripe');

    expect(result).toEqual(credentials);
  });

  it('should handle missing credentials', async () => {
    (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue(false);

    const result = await SecurePaymentConfig.getCredentials('stripe');

    expect(result).toBeNull();
  });

  it('should remove credentials', async () => {
    (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

    const result = await SecurePaymentConfig.removeCredentials('stripe');

    expect(result).toBe(true);
    expect(Keychain.resetInternetCredentials).toHaveBeenCalledWith('payment_stripe');
  });
});
