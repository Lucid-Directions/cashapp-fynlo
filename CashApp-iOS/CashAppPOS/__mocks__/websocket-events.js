// WebSocket event polyfills for tests
if (typeof CloseEvent === 'undefined') {
  global.CloseEvent = class CloseEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.code = options.code || 1000;
      this.reason = options.reason || '';
      this.wasClean = options.wasClean || true;
    }
  };
}

if (typeof MessageEvent === 'undefined') {
  global.MessageEvent = class MessageEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.data = options.data || '';
      this.origin = options.origin || '';
      this.lastEventId = options.lastEventId || '';
      this.source = options.source || null;
      this.ports = options.ports || [];
    }
  };
}
