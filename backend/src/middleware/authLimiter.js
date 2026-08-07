import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis.js';

/**
 * Resilient Redis Store wrapper for rate limiting.
 * Delegates rate-limit operations to Redis when online,
 * and falls back gracefully when Redis is offline or not running locally.
 */
class ResilientRedisStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.redisStore = null;
    }

    getStore() {
        if (redis.status === 'ready') {
            if (!this.redisStore) {
                try {
                    this.redisStore = new RedisStore({
                        sendCommand: (...args) => redis.call(...args),
                        prefix: this.prefix,
                    });
                } catch {
                    return null;
                }
            }
            return this.redisStore;
        }
        return null;
    }

    async increment(key) {
        const store = this.getStore();
        if (store) {
            try {
                return await store.increment(key);
            } catch {
                this.redisStore = null;
            }
        }
        return { totalHits: 1, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
    }

    async decrement(key) {
        const store = this.getStore();
        if (store) {
            try {
                return await store.decrement(key);
            } catch {}
        }
    }

    async resetKey(key) {
        const store = this.getStore();
        if (store) {
            try {
                return await store.resetKey(key);
            } catch {}
        }
    }
}

// Global Limiter - General API usage (15 mins, 300 requests per IP)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: new ResilientRedisStore('rl:gen:'),
    message: {
        ok: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
});

// Auth Limiter - Strict for Login/Signup (15 mins, 10 requests per IP)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new ResilientRedisStore('rl:auth:'),
    message: {
        ok: false,
        message: 'Too many login attempts, please try again after 15 minutes',
    },
});
