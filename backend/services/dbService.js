import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mano_erp',
        port: process.env.DB_PORT || 3306,
        timezone: 'Z',
    },
    pool: {
        min: 2,
        max: 10,
    },
    acquireConnectionTimeout: 10000,
});

// Test connection
db.raw('SELECT 1')
    .then(() => {
        console.log('Database connected successfully');
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
    });

export default db;
