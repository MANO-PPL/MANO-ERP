import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import './src/config/config.js';

export const allowedOrigins = [
    `http://localhost:5173`,
    `http://127.0.0.1:5173`,
    `http://${process.env.URI || '127.0.0.1'}:5173`,
    'https://erp.mano.co.in',
    'https://mano.co.in',
    'https://www.mano.co.in'
];

import app from './src/app.js';
import { initializeCrmSchema } from './src/modules/clients/clientService.js';
import { initializeQualitySchema } from './src/modules/projects/quality/qualityService.js';
import { initializeProjectSchema } from './src/modules/projects/core/projectService.js';
import { initializeResourceSchema } from './src/modules/inventory/resourceService.js';
import { initializeProjectResourceSchema } from './src/modules/projects/resources/projectResourceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5001;

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
    
    try {
        await initializeCrmSchema();
        await initializeQualitySchema();
        await initializeProjectSchema();
        await initializeResourceSchema();
        await initializeProjectResourceSchema();
    } catch (schemaErr) {
        console.error('Schema initialization warning/error:', schemaErr.message || schemaErr);
    }

    
    // Auto-start Python AI Microservice
    try {
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
            try { pythonProcess.kill(); } catch (e) {}
            process.exit();
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (pyErr) {
        console.error('Error starting Python Microservice:', pyErr.message || pyErr);
    }
});

// Nodemon restart trigger comment
