
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

// API Routes
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const reviewRoutes = require('./routes/review.routes');
const settingsRoutes = require('./routes/settings.routes');
const authRoutes = require('./routes/auth.routes');

const { seedDefaultAdmin } = require('./controllers/auth.controller');
const { verifySmtpAtStartup } = require('./services/email.service');
const { seedDatabase } = require('./seed-data');
const Product = require('./models/Product');

// Application setup
const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================
// CORS Configuration
// ============================================

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(',')
]
  .filter(Boolean)
  .map(origin => origin.trim().replace(/\/+$/, ''));

const allowedOrigins = [
  ...new Set([...defaultOrigins, ...configuredOrigins])
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ============================================
// General Middleware
// ============================================

app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({
  extended: true,
  limit: '1mb'
}));

app.use((req, res, next) => {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`
  );

  next();
});

// ============================================
// Serve Frontend Static Files
// ============================================

app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================
// Main Routes
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Coffee House API',
    version: '2.0.0',
    author: 'Coffee House Team',
    documentation: 'Visit / for endpoint details'
  });
});

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'healthy' : 'unhealthy',
    database: databaseConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// API Routes
// ============================================

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requestedUrl: req.originalUrl,
    method: req.method,
    suggestions: [
      'Check the endpoint URL',
      'Verify the HTTP method (GET, POST, PUT, DELETE)',
      'Visit / for all available endpoints'
    ]
  });
});

// ============================================
// Global Error Handler
// ============================================

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('[ERROR]', err.stack || err);

  const statusCode = err.statusCode || 500;

  const message = IS_PRODUCTION && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
});

// ============================================
// Database Connection
// ============================================

let mongoServer;

const connectDB = async () => {
  const configuredMongoURI = process.env.MONGODB_URI;

  if (IS_PRODUCTION && !configuredMongoURI) {
    throw new Error(
      'MONGODB_URI must be configured in production.'
    );
  }

  let mongoURI = configuredMongoURI ||
    'mongodb://localhost:27017/coffee-house';

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    console.log('Connected to MongoDB successfully');

  } catch (databaseError) {
    if (IS_PRODUCTION) {
      throw new Error(
        `Production MongoDB connection failed: ${databaseError.message}`
      );
    }

    console.warn(
      'MongoDB is unavailable. Starting development in-memory database.'
    );

    mongoServer = await MongoMemoryServer.create();
    mongoURI = mongoServer.getUri();

    await mongoose.connect(mongoURI);

    console.log(
      'Connected to development in-memory MongoDB successfully'
    );

    const productsCount = await Product.countDocuments();

    if (productsCount === 0) {
      console.log('Seeding development database with demo data...');

      await seedDatabase({
        useExistingConnection: true,
        skipClear: true
      });
    }
  }

  await seedDefaultAdmin();

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });
};

// ============================================
// Start Server
// ============================================

let httpServer;

const startServer = async () => {
  try {
    await connectDB();

    httpServer = app.listen(PORT, async () => {
      console.log('='.repeat(50));
      console.log('Coffee House is running!');
      console.log(`Port: ${PORT}`);

      if (!IS_PRODUCTION) {
        console.log(`Open: http://localhost:${PORT}`);
      }

      console.log('='.repeat(50));

      try {
        await verifySmtpAtStartup();
      } catch (smtpError) {
        console.error(
          'SMTP startup verification failed:',
          smtpError.message
        );
      }

      console.log('\nAPI Endpoints:');
      console.log('GET  /api/health');
      console.log('GET  /api/products');
      console.log('POST /api/orders');
      console.log('GET  /api/reviews');
      console.log('GET  /api/settings');
      console.log('POST /api/auth/admin-recovery/send-code-email');
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// ============================================
// Graceful Shutdown
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(
    `\n${signal} received. Starting graceful shutdown...`
  );

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }

    if (mongoServer) {
      await mongoServer.stop();
      console.log('In-memory MongoDB stopped.');
    }

    process.exit(0);

  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// Start application
startServer();

// Export application for tests
module.exports = app;
