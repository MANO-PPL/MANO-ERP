import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import AppError from './utils/AppError.js';
import errorHandler from './middleware/errorHandler.js';
import routes from './modules/index.js';

const app = express();


const allowedOrigins = [
    `http://localhost:5173`,
    `http://127.0.0.1:5173`,
    `http://${process.env.URI || '127.0.0.1'}:5173`,
    'https://erp.mano.co.in',
    'https://mano.co.in',
    'https://www.mano.co.in'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new AppError('Not allowed by CORS', 403));
        }
    },
    credentials: true
}));

// ============================================================
// Middleware
// ============================================================
app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ============================================================
// Health Check Route
// ============================================================
app.get('/', (req, res) => {
    res.json({ message: "Backend is running 🚀" });
});

// ============================================================
// API Routes
// ============================================================
app.use('/api', routes);

// ============================================================
// 404 Handler
// ============================================================
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});


app.use(errorHandler);

export default app;
