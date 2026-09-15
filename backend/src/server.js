const fs = require('fs');
const path = require('path');

const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'krishna-CRM-Backend/.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const logger = require('./config/logger');
const { connectDB } = require('./config/database');
const { syncModels } = require('./models');
const { errorHandler, notFound } = require('./utils/errors');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const customerRoutes  = require('./routes/customers');
const orderRoutes     = require('./routes/orders');
const followUpRoutes  = require('./routes/followUps');
const taskRoutes      = require('./routes/tasks');
const csvRoutes       = require('./routes/csv');
const dashboardRoutes = require('./routes/dashboard');
const whatsappRoutes  = require('./routes/whatsapp');
const reportRoutes    = require('./routes/reports');
const shippingRoutes  = require('./routes/shipping');
const callLogRoutes   = require('./routes/callLogs');
const employeeRoutes  = require('./routes/employees');
const userAccessRoutes = require('./routes/userAccess');
const dailyTaskRoutes  = require('./routes/dailyTask');
const dailyActivityRoutes = require('./routes/dailyActivity');
const employeeAuditRoutes = require('./routes/employeeAudit');
const warrantyRoutes = require('./routes/warranty.routes');
const settingsRoutes = require('./routes/settings');
const payrollRoutes = require('./routes/payroll');

const hrRoutes = require('./routes/hr.routes');
const biometricRoutes = require('./routes/biometric.routes');
const smartOfficeAttendanceRoutes = require('./routes/smartOfficeAttendance.routes');
const presenceRoutes = require('./routes/presence.routes');
// const reviewRoutes = require('./routes/reviews');
// const accountingRoutes = require('./routes/accounting');
// const spnAdsRoutes = require('./routes/spnAds');
// const accountManagementRoutes = require('./routes/accountManagement');
// const deliveryRoutes = require('./routes/delivery');
const agentRoutes = require('./routes/agent');
const uploadRoutes = require('./routes/upload');

const app = express();

// Trust first proxy hop (Nginx, AWS ELB, Cloudflare, Render) for express-rate-limit
app.set('trust proxy', 1);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:8001,https://khrishacrm.vasifytech.com,http://khrishacrm.vasifytech.com,https://krishacrm.vasifytech.com,http://krishacrm.vasifytech.com,https://krishabackend.vasifytech.com,https://khrishabackend.vasifytech.com,https://akuabeat.com,http://akuabeat.com,https://krishna-crm-frontend-v2.vercel.app,https://akua-beat-git.vercel.app';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/$/, '').toLowerCase();
  if (
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(cleanOrigin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin) ||
    /^https?:\/\/[a-z0-9_.-]*vasifytech\.com(:[0-9]+)?$/i.test(cleanOrigin) ||
    /^https?:\/\/[a-z0-9_.-]*akuabeat\.com(:[0-9]+)?$/i.test(cleanOrigin) ||
    /^https:\/\/[a-z0-9_.-]*vercel\.app$/i.test(cleanOrigin) ||
    /^https:\/\/[a-z0-9_.-]*onrender\.com$/i.test(cleanOrigin) ||
    /^https:\/\/[a-z0-9_.-]*render\.com$/i.test(cleanOrigin) ||
    /^https:\/\/[a-z0-9_.-]*railway\.app$/i.test(cleanOrigin) ||
    allowedOrigins.some(ao => ao && cleanOrigin.endsWith(ao.replace(/^https?:\/\//, '').toLowerCase()))
  ) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie', 'Authorization'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

// Global CORS Middleware + Preflight Handler
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, X-CSRF-Token');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const isTestOrLocal = process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes
  message: { status: 'fail', message: 'Too many login attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestOrLocal || req.path === '/demo-accounts',
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute
  message: { status: 'fail', message: 'Too many requests from this IP. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestOrLocal || req.path.startsWith('/whatsapp/webhook') || req.path === '/health',
});

app.use('/api/auth/login', authLimiter);
app.use('/api', apiLimiter);

// ─── Parsers & Middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ─── Static Uploads & Media ───────────────────────────────────────────────────
const uploadRoot = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadRoot));
app.use('/customer_images', express.static(path.join(uploadRoot, 'customer_images')));

// S3 Fallback for static media: if file is not on container disk, redirect to presigned S3 object
app.use(['/uploads', '/customer_images'], async (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  try {
    const s3Service = require('./services/s3Service');
    const relPath = req.path.replace(/^\/+/, '');
    const candidateKeys = [
      relPath,
      `customer_images/${relPath}`,
      relPath.replace(/^customer_images\//, ''),
      `uploads/${relPath}`,
    ];

    for (const key of candidateKeys) {
      if (!key) continue;
      const presigned = await s3Service.getPresignedViewUrl({ key, expiresIn: 3600 });
      if (presigned && /^https?:\/\//i.test(presigned) && !presigned.includes('/uploads/')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.redirect(302, presigned);
      }
    }
  } catch (err) {
    logger.debug(`S3 static fallback notice: ${err.message}`);
  }
  next();
});

let dbInitialized = false;

// ─── Health Check ─────────────────────────────────────────────────────────────
const healthHandler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  let dbStatus = 'disconnected';
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    dbLatencyMs = Date.now() - t0;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'ok' : 'degraded',
    app: process.env.APP_NAME || 'KhrishaEnterprisesCRM',
    env: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    uptime: Math.round(process.uptime()),
    memory: {
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ─── API Routes ───────────────────────────────────────────────────────────────
const { protect } = require('./middleware/auth');

app.use('/api/auth',        authRoutes);
app.use('/api/hr',          hrRoutes);

// Operational routes restriction for HR role
const hrRestrict = (req, res, next) => {
  // HR can access employees, HR, tasks, user access, and auth. Block direct access to sales & shipping operational modules.
  if (req.user && req.user.role === 'hr') {
    return res.status(403).json({
      status: 'error',
      message: 'HR accounts cannot access sales & shipping operational modules.',
    });
  }
  next();
};

// Public image viewing route (so browser <img> tags can fetch images without Bearer header)
app.get([
  '/api/orders/images/view',
  '/api/orders/images/:imageId/view',
  '/api/orders/:id/images/:imageId/view',
], orderRoutes.viewCustomerImage);

app.use('/api/customers',   protect, hrRestrict, customerRoutes);
app.use('/api/orders',      protect, hrRestrict, orderRoutes);
app.use('/api/follow-ups',  protect, hrRestrict, followUpRoutes);
app.use('/api/tasks',       taskRoutes);
app.use('/api/csv',         protect, hrRestrict, csvRoutes);
app.use('/api/dashboard',   dashboardRoutes);
app.use('/api/whatsapp',          whatsappRoutes);
// Webhook aliases routed strictly to the webhook handlers
app.get(['/api/webhook', '/api/webhook/whatsapp', '/api/whatsapp', '/webhook'], whatsappRoutes.handleGetWebhook);
app.post(['/api/webhook', '/api/webhook/whatsapp', '/api/whatsapp', '/webhook'], whatsappRoutes.handlePostWebhook);
app.all(['/api/test/image-webhook', '/test-simulate-image'], whatsappRoutes.handleTestSimulateImage);
app.use('/api/reports',     protect, hrRestrict, reportRoutes);
app.use('/api/shipping',    protect, hrRestrict, shippingRoutes);
app.use('/api/call-logs',   callLogRoutes);
app.use('/api/employees',   employeeRoutes);
app.use('/api/user-access', userAccessRoutes);
app.use('/api/user-management', userAccessRoutes);
app.use('/api/daily-tasks', dailyTaskRoutes);
app.use('/api/daily-activities', dailyActivityRoutes);
app.use('/api/employee-audit', employeeAuditRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/attendance', smartOfficeAttendanceRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/settings', settingsRoutes);
// app.use('/api/reviews', reviewRoutes);
// app.use('/api/accounting', accountingRoutes);
// app.use('/api/spn-ads', spnAdsRoutes);
// app.use('/api/account-management', accountManagementRoutes);
// app.use('/api/delivery', deliveryRoutes);
// app.use('/api/ecommerce-ops', ecommerceOpsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/upload', uploadRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || parseInt(process.env.APP_PORT, 10) || 8034;

const initDatabase = async () => {
  if (dbInitialized) return;
  try {
    await connectDB();
    await syncModels();
    dbInitialized = true;

    // Auto-bootstrap and verify all system accounts
    try {
      const { User } = require('./models');
      const demoUsers = [
        { name: 'Super Admin', email: 'admin@krishnacrm.com', password: 'Admin@123456', role: 'admin', department: 'Executive Management', designation: 'Super Admin' },
        { name: 'Vikram Malhotra', email: 'manager@krishnacrm.com', password: 'Manager@123456', role: 'manager', department: 'Operations', designation: 'Operations Manager' },
        { name: 'Pooja Hegde', email: 'hr@krishnacrm.com', password: 'Hr@123456', role: 'hr', department: 'Human Resources', designation: 'HR Executive' },
        { name: 'Neha Sharma', email: 'telecaller@krishnacrm.com', password: 'Telecaller@123456', role: 'telecaller', department: 'Customer Support', designation: 'Telecaller' },
        { name: 'Rahul Deshmukh', email: 'sales@krishnacrm.com', password: 'Sales@123456', role: 'sales', department: 'Sales & Marketing', designation: 'Sales Executive' },
        { name: 'Amit Shinde', email: 'technician@krishnacrm.com', password: 'Technician@123456', role: 'technician', department: 'Field Service', designation: 'Field Technician' },
        { name: 'Standard Employee', email: 'employee@krishnacrm.com', password: 'Employee@123456', role: 'employee', department: 'General Operations', designation: 'Operations Staff' },
        { name: 'Biometric Test User', email: 'biometric.test@krishnacrm.com', password: 'Employee@123456', role: 'employee', department: 'General Operations', designation: 'Operations Staff' },
        { name: 'Sushil', email: 'sushil@akuabeat.com', password: 'Reviewer@123456', role: 'reviewer', department: 'Product Quality', designation: 'Product Reviewer' },
        { name: 'Yash', email: 'yash.telecaller@nityamenterprises.com', password: 'Telecaller@123456', role: 'telecaller', department: 'Customer Support', designation: 'Telecaller' },
        { name: 'Meenakshi', email: 'meenakshi.telecaller@nityamenterprises.com', password: 'Telecaller@123456', role: 'telecaller', department: 'Customer Support', designation: 'Telecaller' },
        { name: 'Sanjay', email: 'sanjay.accountant@leretailproject.com', password: 'Accountant@123456', role: 'accountant', department: 'Finance & Accounts', designation: 'Accountant' },
        { name: 'Riya', email: 'riya.accountant@leretailproject.com', password: 'Accountant@123456', role: 'accountant', department: 'Finance & Accounts', designation: 'Accountant' },
        { name: 'Priti', email: 'priti.accountant@leretailproject.com', password: 'Accountant@123456', role: 'accountant', department: 'Finance & Accounts', designation: 'Accountant' },
        { name: 'Naushad', email: 'smallbusiness.ecs@gmail.com', password: 'Manager@123456', role: 'spn_ads_manager', department: 'Marketing & Ads', designation: 'SPN & Ads Manager' },
        { name: 'Bharat', email: 'bharat.manager@nityamenterprises.com', password: 'Manager@123456', role: 'senior_account_manager', department: 'Account Management', designation: 'Senior Account Manager' },
        { name: 'Manoj', email: 'manoj.delivery@krishnacrm.com', password: 'Delivery@123456', role: 'delivery_boy', department: 'Logistics & Office', designation: 'Delivery Boy' },
        { name: 'Shruti', email: 'shruti.ecom@nityamenterprises.com', password: 'Executive@123456', role: 'ecommerce_executive', department: 'E-Commerce Operations', designation: 'E-Commerce Executive' },
        { name: 'Faijal', email: 'faijal.ecom@nityamenterprises.com', password: 'Executive@123456', role: 'ecommerce_executive', department: 'E-Commerce Operations', designation: 'E-Commerce Executive' },
        { name: 'Priya', email: 'priya.ecom@nityamenterprises.com', password: 'Executive@123456', role: 'ecommerce_executive', department: 'E-Commerce Operations', designation: 'E-Commerce Executive' },
        { name: 'Laxmi', email: 'laxmi.exec@nityamenterprises.com', password: 'Employee@123456', role: 'employee', department: 'General Operations', designation: 'Operations Executive' },
        { name: 'Manish', email: 'manish.exec@nityamenterprises.com', password: 'Employee@123456', role: 'employee', department: 'General Operations', designation: 'Operations Executive' },
        { name: 'CEO User', email: 'ceo@krishnacrm.com', password: 'Ceo@123456', role: 'ceo', department: 'Executive Management', designation: 'Chief Executive Officer' },
        { name: 'Customer Support', email: 'support@krishnacrm.com', password: 'Support@123456', role: 'support', department: 'Customer Support', designation: 'Support Specialist' },
      ];

      for (const d of demoUsers) {
        let u = await User.findOne({ where: { email: d.email }, paranoid: false });
        if (u) {
          if (u.deletedAt) {
            await u.restore();
          }
          u.is_active = true;
          u.status = 'active';
          if (!u.display_password) {
            u.display_password = d.password;
          }
          await u.save();
        } else {
          await User.create({
            name: d.name,
            email: d.email,
            password: d.password,
            display_password: d.password,
            role: d.role,
            department: d.department,
            designation: d.designation,
            is_active: true,
            status: 'active',
          });
          logger.info(`Created system account: ${d.email}`);
        }
      }
      logger.info('✅ Verified all system accounts.');
    } catch (bootErr) {
      logger.warn(`Notice during default system accounts initialization: ${bootErr.message}`);
    }

    // Clean up any stale batches left in 'processing' or 'uploaded' from previous crashes/restarts
    try {
      const { CsvImportBatch } = require('./models');
      const { Op } = require('sequelize');
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const [updatedCount] = await CsvImportBatch.update(
        {
          status: 'failed',
          error_log: [{ error: 'Import interrupted by server restart or process termination.' }],
        },
        {
          where: {
            status: { [Op.in]: ['processing', 'uploaded'] },
            updated_at: { [Op.lt]: tenMinutesAgo },
          },
        }
      );
      if (updatedCount > 0) {
        logger.info(`Cleaned up ${updatedCount} stale/interrupted CSV import batch(es).`);
      }
    } catch (cleanErr) {
      logger.warn(`Stale batch cleanup notice: ${cleanErr.message}`);
    }

    // Safe zero-downtime database migration for WhatsApp Orchestration tables
    try {
      const { migrateWhatsAppOrchestrator, verifySchemaPreFlight } = require('./scripts/migrate_whatsapp_orchestrator');
      await migrateWhatsAppOrchestrator();
      await verifySchemaPreFlight();
    } catch (mErr) {
      logger.error(`❌ CRITICAL SCHEMA PRE-FLIGHT ERROR: ${mErr.message}`);
      throw new Error(`Worker startup aborted due to schema mismatch: ${mErr.message}`);
    }

    // Start background jobs once DB is connected
    const reminderJob = require('./services/reminderJob');
    reminderJob.start();
    const activityShiftScheduler = require('./services/activityShiftScheduler');
    activityShiftScheduler.start();
    const warrantyActivationWorker = require('./services/warrantyActivationWorker');
    warrantyActivationWorker.start();
    const orderVerificationWorker = require('./services/orderVerificationWorker');
    orderVerificationWorker.startOrderVerificationWorker();
    const attendanceSyncWorker = require('./services/attendanceSyncWorker');
    attendanceSyncWorker.start();
    const smartOfficeAttendanceWorker = require('./services/smartoffice/smartOfficeAttendanceWorker');
    smartOfficeAttendanceWorker.start();
    const whatsappOutboxQueue = require('./services/whatsappOutboxQueue');
    whatsappOutboxQueue.startWorker(3000);
    logger.info('✅ Database initialization & background workers started successfully.');
  } catch (err) {
    dbInitialized = false;
    logger.error('⚠️ Initial database connection error:', err.message);
    logger.info('🔄 Retrying MySQL connection in 10 seconds...');
    setTimeout(initDatabase, 10000);
  }
};

const start = async () => {
  // Start HTTP server immediately so /health endpoint responds instantly during deployment health checks
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`
╔══════════════════════════════════════════════════╗
║      Khrisha Enterprises CRM – Backend API       ║
║      Port  : ${String(PORT).padEnd(35)}║
║      Host  : 0.0.0.0                            ║
║      Env   : ${(process.env.NODE_ENV || 'development').padEnd(35)}║
╚══════════════════════════════════════════════════╝`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    try {
      const reminderJob = require('./services/reminderJob');
      reminderJob.stop();
      const activityShiftScheduler = require('./services/activityShiftScheduler');
      activityShiftScheduler.stop();
      const warrantyActivationWorker = require('./services/warrantyActivationWorker');
      warrantyActivationWorker.stop();
      const orderVerificationWorker = require('./services/orderVerificationWorker');
      orderVerificationWorker.stopOrderVerificationWorker();
      const attendanceSyncWorker = require('./services/attendanceSyncWorker');
      attendanceSyncWorker.stop();
      const smartOfficeAttendanceWorker = require('./services/smartoffice/smartOfficeAttendanceWorker');
      smartOfficeAttendanceWorker.stop();
      const whatsappOutboxQueue = require('./services/whatsappOutboxQueue');
      whatsappOutboxQueue.stopWorker();
    } catch (_) {}
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000); // force exit after 10s
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Initialize MySQL database asynchronously
  initDatabase();
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

if (require.main === module) {
  start();
}

module.exports = app;
