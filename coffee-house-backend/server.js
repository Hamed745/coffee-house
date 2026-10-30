const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

// استيراد مسارات الـ API
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const reviewRoutes = require('./routes/review.routes');
const settingsRoutes = require('./routes/settings.routes');
const authRoutes = require('./routes/auth.routes');
const { seedDefaultAdmin } = require('./controllers/auth.controller');
const { verifySmtpAtStartup } = require('./services/email.service');
const { seedDatabase } = require('./seed-data');
const Product = require('./models/Product');

// تهيئة التطبيق
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware
// ============================================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5001',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تسجيل الطلبات (للتحقق)
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// Serve Frontend Static Files
// ============================================
app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================
// Routes
// ============================================

// الصفحة الرئيسية - تقديم الفرونت اند
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// معلومات عن الـ API
app.get('/api', (req, res) => {
  res.json({
    name: 'Coffee House API',
    version: '2.0.0',
    author: 'Coffee House Team',
    documentation: 'Visit / for endpoint details'
  });
});

// حالة الخادم
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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
// Error Handling
// ============================================

// 404 - Route Not Found
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// Database Connection
// ============================================
let mongoServer;

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffee-house';
    
    // Try local MongoDB first, if fails use in-memory
    try {
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 2000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to MongoDB successfully');
      await seedDefaultAdmin();
    } catch (localError) {
      console.log('⚠️  Local MongoDB not available, starting in-memory database...');
      mongoServer = await MongoMemoryServer.create();
      mongoURI = mongoServer.getUri();
      await mongoose.connect(mongoURI);
      console.log('✅ Connected to In-Memory MongoDB successfully');
      await seedDefaultAdmin();

      const productsCount = await Product.countDocuments();
      if (productsCount === 0) {
        console.log('🌱 Seeding in-memory database with demo data...');
        await seedDatabase({ useExistingConnection: true, skipClear: true });
      }
    }
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

// ============================================
// Start Server
// ============================================
const startServer = async () => {
  try {
    // الاتصال بقاعدة البيانات أولاً
    await connectDB();
    
    // بدء الخادم
    app.listen(PORT, async () => {
      console.log('='.repeat(50));
      console.log(`☕ Coffee House is running!`);
      console.log(`🌐 Open: http://localhost:${PORT}`);
      console.log('='.repeat(50));
      await verifySmtpAtStartup();
      console.log('\n📊 API Endpoints:');
      console.log('  GET  /api/health    - Server Health Check');
      console.log('  GET  /api/products  - Get all products');
      console.log('  POST /api/orders    - Create new order');
      console.log('  GET  /api/reviews   - Get all reviews');
      console.log('  GET  /api/settings  - Get store settings');
      console.log('  POST /api/auth/admin-recovery/send-code-email - Admin reset code → real SMTP only');
      console.log('='.repeat(50));
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ============================================
// Graceful Shutdown
// ============================================
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  
  if (mongoServer) {
    await mongoServer.stop();
    console.log('In-memory MongoDB stopped.');
  }
  
  process.exit(0);
};

// إعداد معالجات الإغلاق
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // للنودمن

// بدء الخادم
startServer();

// تصدير التطبيق للاختبارات
module.exports = app;