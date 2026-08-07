import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisTls = process.env.REDIS_TLS === 'true';

const redisConfig = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    tls: redisTls ? {} : undefined,
    retryStrategy(times) {
        return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
    console.log(`[Redis Client] Successfully connected to ${redisHost}:${redisPort}`);
});

redis.on('error', (err) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        // Suppress connection refused logs when Redis is not active locally
        return;
    }
    console.error('[Redis Client] Connection Error:', err.message);
});

// Attempt background connection
redis.connect().catch(() => {});

export default redis;
