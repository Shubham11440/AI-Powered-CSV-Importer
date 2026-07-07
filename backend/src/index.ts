import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import importRoutes from './routes/importRoutes';
import logger from './services/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and compression middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allow CDN resources for Swagger/Redoc
}));
app.use(compression());

// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// Rate limiter for imports and generic API usage
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Express middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS for frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key', 'x-request-id'],
}));

// Winston Logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      requestId: req.headers['x-request-id'],
      durationMs: duration,
    });
  });
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date(), requestId: _req.headers['x-request-id'] });
});

// Swagger JSON Definition
app.get('/swagger.json', (_req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'GrowEasy CSV Importer API Specification',
      version: '1.0.0',
      description: 'API for processing, mapping, and converting raw lead CSV formats into standardized GrowEasy CRM leads using Gemini AI.',
    },
    paths: {
      '/health': {
        get: {
          summary: 'Retrieve API health check',
          responses: {
            200: {
              description: 'API is functional and running.'
            }
          }
        }
      },
      '/api/import': {
        post: {
          summary: 'Import and process raw CRM leads',
          description: 'Pass parsed raw JSON records (or files via multipart form) to map fields using Gemini.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['records'],
                  properties: {
                    records: {
                      type: 'array',
                      items: {
                        type: 'object'
                      },
                      description: 'Array of raw lead rows as key-value pairs.'
                    },
                    batchSize: {
                      type: 'number',
                      default: 25,
                      description: 'Batch size processing limit.'
                    },
                    apiKey: {
                      type: 'string',
                      description: 'Custom Gemini API Key to use (optional).'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Successfully parsed and mapped CRM leads.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      imported: { type: 'array', items: { type: 'object' } },
                      skipped: { type: 'array', items: { type: 'object' } },
                      stats: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

// Redoc Interactive API Docs endpoint
app.get('/api-docs', (_req, res) => {
  res.header('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GrowEasy CSV Importer API Docs</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
          body { margin: 0; padding: 0; background-color: #0b0d19; color: #fff; }
        </style>
      </head>
      <body>
        <div id="redoc-container"></div>
        <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        <script>
          Redoc.init('/swagger.json', {
            theme: {
              colors: {
                primary: { main: '#4f46e5' }
              }
            }
          }, document.getElementById('redoc-container'));
        </script>
      </body>
    </html>
  `);
});

// Register import API routes
app.use('/api/import', importRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled Global Error:', { error: err.message, stack: err.stack, requestId: _req.headers['x-request-id'] });
  res.status(500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
    requestId: _req.headers['x-request-id'],
  });
});

// Start listening
app.listen(PORT, () => {
  logger.info(`GrowEasy CRM Lead Importer Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Interactive API docs: http://localhost:${PORT}/api-docs`);
});
