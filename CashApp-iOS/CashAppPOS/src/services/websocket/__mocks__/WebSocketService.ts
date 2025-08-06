export class WebSocketService {
  private static instance: WebSocketService;
  
  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  connect = jest.fn(() => Promise.resolve());
  disconnect = jest.fn();
  send = jest.fn();
  subscribe = jest.fn(() => jest.fn());
  isConnected = jest.fn(() => true);
  reconnect = jest.fn(() => Promise.resolve());
  
  on = jest.fn();
  off = jest.fn();
  emit = jest.fn();
}

export default WebSocketService;
