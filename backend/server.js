import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './config.js';   


const app = express();

const PORT = process.env.PORT;
const public_ip = process.env.URI || '127.0.0.1';

const allowedOrigins = [
  `http://localhost:5173`,
  `http://127.0.0.1:5173`,
  `http://${public_ip}:5173`,
  'https://erp.mano.co.in',
  'https://mano.co.in',
  'https://www.mano.co.in'
];

// Middleware
app.use(express.json());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(cookieParser());

// Test Route
app.get('/', (req, res) => {
    res.json({ message: "Backend is running successfully!" });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
