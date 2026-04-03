const Redis = require('ioredis');

// Check if Redis is enabled
const redisEnabled = process.env.REDIS_ENABLED !== 'false';

let redis;
if (redisEnabled) {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('[REDIS] Max retries reached, continuing without Redis');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: true
  });

  redis.on('connect', () => {
    console.log('[REDIS] Connected successfully');
  });

  redis.on('error', (err) => {
    // Silently handle connection errors after initial retries
  });
} else {
  // Create a mock Redis for when Redis is not available
  const mockRedis = {
    data: new Map(),
    async get(key) { return this.data.get(key) || null; },
    async setex(key, seconds, value) { this.data.set(key, value); return 'OK'; },
    async del(key) { this.data.delete(key); return 1; },
    async lpush(key, value) {
      if (!this.data.has(key)) this.data.set(key, []);
      this.data.get(key).unshift(value);
      return 1;
    },
    async brpop(key, timeout) {
      const list = this.data.get(key);
      if (list && list.length > 0) {
        const item = list.pop();
        return [key, item];
      }
      // Simulate blocking with timeout
      await new Promise(r => setTimeout(r, timeout * 1000));
      return null;
    }
  };
  redis = mockRedis;
  console.log('[REDIS] Running in mock mode (no Redis server)');
}

module.exports = redis;
