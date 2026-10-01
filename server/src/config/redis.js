import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const createRedisClient = () => {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy(times) {
      // In dev: give up after 3 attempts — Redis is optional (BullMQ degrades gracefully)
      if (times > 3) return null;
      return Math.min(times * 300, 2000);
    },
    reconnectOnError() {
      // Don't auto-reconnect on non-auth errors in dev
      return false;
    },
  });

  // Silently swallow Redis errors — server runs in no-queue mode without Redis
  client.on('error', () => {});

  client.on('connect', () => {
    console.log('[Redis] Connected successfully.');
  });

  return client;
};

export const redisConnection = createRedisClient();
export default redisConnection;
