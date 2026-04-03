require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const workerRoutes  = require('./routes/workers');
const policyRoutes  = require('./routes/policies');
const claimRoutes   = require('./routes/claims');
const triggerRoutes = require('./routes/triggers');
const errorHandler  = require('./middleware/errorHandler');

// Start trigger cron services
require('./triggers/rainfallTrigger');
require('./triggers/aqiTrigger');
require('./triggers/heatTrigger');
require('./triggers/outageTrigger');

// Start claims queue worker
const { processClaimsQueue } = require('./services/claimsQueueWorker');
processClaimsQueue();

const app = express();
app.use(cors());
app.use(express.json());

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  next();
});

// Rate limiting for auth endpoints to prevent abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests, please try again later' }
});

// Apply rate limiting to auth routes
app.use('/auth/send-otp', authLimiter);
app.use('/auth/verify-otp', authLimiter);

app.use('/auth',     authRoutes);
app.use('/workers',  workerRoutes);
app.use('/policies', policyRoutes);
app.use('/claims',   claimRoutes);
app.use('/triggers', triggerRoutes);

// Enhanced health check with dependency verification
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthCheck = {
    status: 'ok',
    service: 'gigshield-backend',
    timestamp: new Date().toISOString(),
    request_id: req.id,
    version: '1.0.0',
    uptime: process.uptime(),
    dependencies: {}
  };

  try {
    // Check Supabase connection
    const supabase = require('./config/supabase');
    const { error: dbError } = await supabase.from('workers').select('count').limit(1);
    healthCheck.dependencies.database = dbError ? 
      { status: 'error', error: dbError.message } : 
      { status: 'connected' };
    
    // Check Redis connection
    const redis = require('./config/redis');
    let redisStatus = 'disconnected';
    if (redis && typeof redis.ping === 'function') {
      await redis.ping();
      redisStatus = 'connected';
    } else if (redis && redis.data instanceof Map) {
      redisStatus = 'mock';
    }
    healthCheck.dependencies.redis = { status: redisStatus };

    // Determine overall status
    const dbOk = healthCheck.dependencies.database.status === 'connected';
    const redisOk = ['connected', 'mock'].includes(healthCheck.dependencies.redis.status);
    
    if (!dbOk || !redisOk) {
      healthCheck.status = 'degraded';
    }

    healthCheck.response_time_ms = Date.now() - startTime;
    res.status(healthCheck.status === 'ok' ? 200 : 503).json(healthCheck);
  } catch (err) {
    healthCheck.status = 'error';
    healthCheck.response_time_ms = Date.now() - startTime;
    res.status(503).json(healthCheck);
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => 
  console.log(`GigShield backend running on port ${PORT}`)
);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app; // For testing