import { DatabaseService } from '../DatabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save data to storage', async () => {
    const data = { id: 1, name: 'Test' };
    await DatabaseService.save('test-key', data);
    
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(data));
  });

  it('should retrieve data from storage', async () => {
    const data = { id: 1, name: 'Test' };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(data));
    
    const result = await DatabaseService.get('test-key');
    
    expect(result).toEqual(data);
  });

  it('should return null for non-existent keys', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    
    const result = await DatabaseService.get('non-existent');
    
    expect(result).toBeNull();
  });

  it('should delete data from storage', async () => {
    await DatabaseService.delete('test-key');
    
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
  });
});
