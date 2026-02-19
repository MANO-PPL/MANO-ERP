import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './config.js';

import AppError from './utils/AppError.js';
import errorHandler from './middleware/errorHandler.js';
import Login from './routers/Authentication/Login.js';
import Admin from './routers/Admin/Admin.js';
import { authenticateJWT } from './middleware/auth.js';


const app = express();

const PORT = process.env.PORT || 5001;
const public_ip = process.env.URI || '127.0.0.1';

// CORS Configuration
const allowedOrigins = [
    `http://localhost:5173`,
    `http://127.0.0.1:5173`,
    `http://${public_ip}:5173`,
    'https://erp.mano.co.in',
    'https://mano.co.in',
    'https://www.mano.co.in'
];

app.use(cookieParser());
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



app.use(express.json());

// Register Auth Routes
app.use("/api/auth", Login);
app.use("/admin", Admin);

// Routes Placeholder
app.get('/', (req, res) => {
    res.json({ message: "Backend is running 🚀" });
});

// app.use('/auth', LoginRoutes);
// ... attach other routes ...

// Upload/Static files placeholder
// app.use('/uploads', express.static('uploads'));

// Handle 404
// Handle 404
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

// HTTP Server & Socket.IO Setup
const server = createServer(app);
const io = new SocketIO(server, {
    path: '/socket.io/',
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});


