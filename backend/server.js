import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import './src/config/config.js';
import app from './src/app.js';

const PORT = process.env.PORT || 5001;
const allowedOrigins = [
    `http://localhost:5173`,
    `http://127.0.0.1:5173`,
    `http://${process.env.URI || '127.0.0.1'}:5173`,
    'https://erp.mano.co.in',
    'https://mano.co.in',
    'https://www.mano.co.in'
];

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
