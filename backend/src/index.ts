import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import importRoutes from './routes/importRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // For development flexibility; can restrict to frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Express middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Register import API routes
app.use('/api/import', importRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Global Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 GrowEasy CRM Lead Importer Server running`);
  console.log(`   Local Address: http://localhost:${PORT}`);
  console.log(`   Health Check:  http://localhost:${PORT}/health`);
  console.log(`=========================================`);
});
