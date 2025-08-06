/**
 * REAL Test Configuration - Pre-Production Testing
 * Uses actual infrastructure, no mocks
 */

import { createClient } from '@supabase/supabase-js';

// Test environment variables are already loaded via testSetup

export const TEST_CONFIG = {
  // Real Supabase Instance
  supabase: {
    url: process.env.SUPABASE_URL || 'https://muukvrmagzsiqpbkmjhl.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dWt2cm1hZ3pzaXFwYmttamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMDkwNzIsImV4cCI6MjA0NTY4NTA3Mn0.YXHqM7BV9u8K5REdpVjNKgJTvPELZ5WXCLyGx_gnxNw',
  },

  // Real Backend API
  api: {
    baseUrl: 'https://fynlopos-9eg2c.ondigitalocean.app',
    version: '/api/v1',
    timeout: 30000, // 30 seconds for real API calls
  },

  // Real WebSocket
  websocket: {
    url: 'wss://fynlopos-9eg2c.ondigitalocean.app/ws',
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 15000, // 15 seconds
  },

  // Test User Account
  testUser: {
    email: 'test@fynlo.co.uk',
    password: 'TestPassword123!',
    restaurantId: 'test-restaurant-001',
  },

  // Test Restaurant
  testRestaurant: {
    id: 'test-restaurant-001',
    name: 'Test Restaurant',
    plan: 'alpha', // Free tier for testing
  },

  // Feature Flags
  features: {
    useRealBackend: true,
    useRealAuth: true,
    useRealWebSocket: true,
    skipMocks: true,
  },
};

// Create real Supabase client for tests
export const supabaseTestClient = createClient(
  TEST_CONFIG.supabase.url,
  TEST_CONFIG.supabase.anonKey
);

// Helper to authenticate test user
export async function authenticateTestUser() {
  const { data, error } = await supabaseTestClient.auth.signInWithPassword({
    email: TEST_CONFIG.testUser.email,
    password: TEST_CONFIG.testUser.password,
  });

  if (error) {
    throw new Error(`Failed to authenticate test user: ${error.message}`);
  }

  return data;
}

// Helper to get authenticated headers
export async function getAuthHeaders() {
  const session = await authenticateTestUser();
  return {
    'Authorization': `Bearer ${session.session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

// Helper to make real API calls
export async function makeRealAPICall(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
) {
  const headers = await getAuthHeaders();
  const url = `${TEST_CONFIG.api.baseUrl}${TEST_CONFIG.api.version}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper to connect to real WebSocket
export function connectRealWebSocket(token: string): WebSocket {
  const ws = new WebSocket(`${TEST_CONFIG.websocket.url}?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected to real server');
    // Send heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, TEST_CONFIG.websocket.heartbeatInterval);
  };

  return ws;
}

export default TEST_CONFIG;