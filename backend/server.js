import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import './src/config/config.js';
import app from './src/app.js';
import { initializePermissionsSchema } from './src/modules/admin/permissionService.js';
import { initializeTasksSchema } from './src/modules/projects/tasks/tasksService.js';
import { initializeCrmSchema } from './src/modules/clients/clientService.js';
import { initializeDocumentsSchema } from './src/modules/documents/documentService.js';
import { initializeDrawingsSchema } from './src/modules/projects/drawings/drawingsService.js';
import { initializeTokenSchema } from './src/modules/auth/tokenService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    await initializeTokenSchema();
    await initializePermissionsSchema();
    await initializeTasksSchema();
    await initializeCrmSchema();
    await initializeDocumentsSchema();
    await initializeDrawingsSchema();
    
    // Auto-start Python AI Microservice
    const pythonDir = path.join(__dirname, 'src', 'modules', 'ai', 'python_engine');
    console.log('Booting Python AI Engine...');
    
    const isWin = process.platform === 'win32';
    const command = isWin ? 'cmd.exe' : path.join(pythonDir, 'venv', 'bin', 'uvicorn');
    const args = isWin 
        ? ['/c', 'venv\\Scripts\\uvicorn main:app --port 8000 --reload'] 
        : ['main:app', '--port', '8000', '--reload'];

    const pythonProcess = spawn(command, args, {
        cwd: pythonDir,
        stdio: 'inherit',
        shell: isWin
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python Microservice:', err);
    });
    
    // Gracefully kill Python when Node shuts down
    const shutdown = () => {
        console.log('\nShutting down Python AI Engine...');
        pythonProcess.kill();
        process.exit();
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
});

// Nodemon restart trigger comment
