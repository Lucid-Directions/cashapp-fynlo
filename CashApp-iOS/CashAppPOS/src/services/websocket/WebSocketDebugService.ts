/**
 * WebSocket Debug Service - Temporary debugging utility
 * This file helps diagnose WebSocket connection issues
 */

import logger from '../../utils/logger';

export class WebSocketDebugService {
  static logURLConstruction(
    stage: string,
    data: {
      token?: string;
      userId?: string | number | null | undefined;
      restaurantId?: string;
      wsUrl?: string;
      params?: any;
    }
  ): void {
    logger.info(`🔍 WebSocket URL Debug - ${stage}:`);
    
    if (data.token) {
      logger.info(`  Token: ${data.token ? `${data.token.substring(0, 10)}...` : 'NOT AVAILABLE'}`);
    }
    
    if (data.userId !== undefined) {
      logger.info(`  User ID: ${data.userId} (type: ${typeof data.userId})`);
    }
    
    if (data.restaurantId) {
      logger.info(`  Restaurant ID: ${data.restaurantId}`);
    }
    
    if (data.params) {
      logger.info(`  Params object: ${JSON.stringify(data.params)}`);
      if (typeof data.params.toString === 'function') {
        logger.info(`  Params toString(): ${data.params.toString()}`);
      }
    }
    
    if (data.wsUrl) {
      logger.info(`  Final URL: ${data.wsUrl}`);
      // Check if URL has query parameters
      const hasQueryParams = data.wsUrl.includes('?') && data.wsUrl.split('?')[1]?.length > 0;
      logger.info(`  Has query params: ${hasQueryParams}`);
      if (hasQueryParams) {
        const queryString = data.wsUrl.split('?')[1];
        logger.info(`  Query string: ${queryString}`);
      }
    }
  }

  static testURLSearchParams(): boolean {
    try {
      if (typeof URLSearchParams === 'undefined') {
        logger.error('❌ URLSearchParams is NOT defined in this environment');
        return false;
      }

      const params = new URLSearchParams();
      params.append('test', 'value');
      const result = params.toString();
      
      if (result === 'test=value') {
        logger.info('✅ URLSearchParams works correctly');
        return true;
      } else {
        logger.error(`❌ URLSearchParams not working as expected. Got: ${result}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ URLSearchParams test failed:', error);
      return false;
    }
  }

  static buildQueryStringManually(token: string, userId?: string | number | null): string {
    const parts: string[] = [];
    
    // Always add token
    parts.push(`token=${encodeURIComponent(token)}`);
    
    // Add user_id if it's defined (including 0, which is valid)
    if (userId !== undefined && userId !== null) {
      parts.push(`user_id=${encodeURIComponent(String(userId))}`);
    }
    
    const queryString = parts.join('&');
    logger.info(`🔧 Manual query string built: ${queryString}`);
    return queryString;
  }
}

export default WebSocketDebugService;