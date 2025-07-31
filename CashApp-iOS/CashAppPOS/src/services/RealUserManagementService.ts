/**
 * Real User Management Service - Connects to backend API
 * Replaces mock UserManagementService with real data
 */

import API_CONFIG from '../config/api';

export interface RealUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  pin: string;
  employeeId: string;
  businessId: string;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
  platformId?: string;
  managedRestaurants?: string[];
}

export interface UserDisplayData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  restaurantId?: string;
  restaurantName?: string;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
  loginAttempts: number;
  isLocked: boolean;
  phoneNumber?: string;
  address?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  location: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'suspicious';
  details?: string;
}

class RealUserManagementService {
  private static instance: RealUserManagementService;
  private baseUrl = API_CONFIG.FULL_API_URL;

  static getInstance(): RealUserManagementService {
    if (!RealUserManagementService.instance) {
      RealUserManagementService.instance = new RealUserManagementService();
    }
    return RealUserManagementService.instance;
  }

  // Convert real backend user to display format
  private convertToDisplayFormat(realUser: RealUser): UserDisplayData {
    return {
      id: realUser.id,
      name: `${realUser.firstName} ${realUser.lastName}`.trim(),
      email: realUser.email,
      role: this.mapRoleToDisplay(realUser.role),
      status: realUser.isActive ? 'active' : 'inactive',
      restaurantId: realUser.businessId,
      restaurantName: this.getRestaurantName(realUser.businessId),
      permissions: this.getPermissionsForRole(realUser.role),
      createdAt: realUser.createdAt ? new Date(realUser.createdAt) : new Date(),
      lastLogin: realUser.lastLogin ? new Date(realUser.lastLogin) : undefined,
      loginAttempts: 0,
      isLocked: false,
      phoneNumber: realUser.phone,
      address: undefined,
    };
  }

  private mapRoleToDisplay(role: string): string {
    const roleMap: { [key: string]: string } = {
      platform_owner: 'Platform Admin',
      restaurant_owner: 'Restaurant Owner',
      manager: 'Restaurant Manager',
      employee: 'Restaurant Employee',
    };
    return roleMap[role] || role;
  }

  private getRestaurantName(businessId: string): string {
    // For now, check if it's the Mexican restaurant
    if (businessId === 'restaurant1') {
      return 'Chucho';
    }
    return 'Unknown Restaurant';
  }

  private getPermissionsForRole(role: string): string[] {
    const permissionMap: { [key: string]: string[] } = {
      platform_owner: [
        'view_analytics',
        'manage_users',
        'manage_restaurants',
        'manage_settings',
        'view_reports',
      ],
      restaurant_owner: [
        'view_analytics',
        'manage_users',
        'manage_menu',
        'view_reports',
        'manage_settings',
      ],
      manager: ['manage_orders', 'access_pos', 'manage_tables', 'view_kitchen_orders'],
      employee: ['access_pos', 'process_payments'],
    };
    return permissionMap[role] || [];
  }

  // API methods
  async getAllUsers(): Promise<UserDisplayData[]> {
    try {
      console.log('🔍 Fetching users from real backend...');
      const response = await fetch(`${this.baseUrl}/users`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const realUsers: RealUser[] = await response.json();
      console.log('✅ Found real users:', realUsers.length);

      // Convert to display format
      const displayUsers = realUsers.map((user) => this.convertToDisplayFormat(user));

      return displayUsers;
    } catch (error) {
      console.error('❌ Failed to fetch users from backend:', error);
      // Return empty array instead of mock data
      return [];
    }
  }

  async getUsersByRole(role: string): Promise<UserDisplayData[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter((user) => user.role === role);
  }

  async getUsersByRestaurant(restaurantId: string): Promise<UserDisplayData[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter((user) => user.restaurantId === restaurantId);
  }

  async getUserById(userId: string): Promise<UserDisplayData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const realUser: RealUser = await response.json();
      return this.convertToDisplayFormat(realUser);
    } catch (error) {
      console.error('❌ Failed to fetch user by ID:', error);
      return null;
    }
  }

  async createUser(userData: any): Promise<UserDisplayData> {
    try {
      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const result = await response.json();
      return this.convertToDisplayFormat(result.user);
    } catch (error) {
      console.error('❌ Failed to create user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: any): Promise<UserDisplayData> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      const result = await response.json();
      return this.convertToDisplayFormat(result.user);
    } catch (error) {
      console.error('❌ Failed to update user:', error);
      throw error;
    }
  }

  async suspendUser(userId: string, reason?: string): Promise<UserDisplayData> {
    return this.updateUser(userId, { isActive: false });
  }

  async activateUser(userId: string): Promise<UserDisplayData> {
    return this.updateUser(userId, { isActive: true });
  }

  // Mock access logs since backend doesn't have this yet
  async getAccessLogs(limit?: number): Promise<AccessLog[]> {
    console.log('📝 Access logs not implemented in backend yet, returning empty array');
    return [];
  }

  async getAccessLogsByUser(userId: string, limit?: number): Promise<AccessLog[]> {
    return [];
  }

  async logAccess(
    userId: string,
    userEmail: string,
    action: string,
    location: string,
    status: 'success' | 'failed' | 'suspicious',
    details?: string
  ): Promise<void> {
    // Will implement when backend supports it
    console.log(`📝 Would log: ${userEmail} - ${action} - ${status}`);
  }

  // Search functionality
  async searchUsers(query: string): Promise<UserDisplayData[]> {
    const allUsers = await this.getAllUsers();
    const lowercaseQuery = query.toLowerCase();

    return allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(lowercaseQuery) ||
        user.email.toLowerCase().includes(lowercaseQuery) ||
        user.role.toLowerCase().includes(lowercaseQuery) ||
        (user.restaurantName && user.restaurantName.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Placeholder methods for compatibility
  async exportAccessLogs(
    format: 'csv' | 'json' | 'xlsx'
  ): Promise<{ url: string; filename: string }> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fynlo-access-logs-${timestamp}.${format}`;

    return {
      url: `https://api.fynlopos.com/exports/${filename}`,
      filename,
    };
  }
}

export { RealUserManagementService };
