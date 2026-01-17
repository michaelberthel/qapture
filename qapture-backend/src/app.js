import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import evaluationRoutes from './routes/evaluations.js';
import employeeRoutes from './routes/employees.js';
import adminRoutes from './routes/admin.js';

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// DEBUG: DB Connection Check (Temporary)
import { connectToMongo } from './services/mongo.js';
app.get('/api/debug-connection', async (req, res) => {
    try {
        const db = await connectToMongo();
        const collections = await db.listCollections().toArray();
        const surveyCount = await db.collection('mongosurveys').countDocuments();

        res.json({
            node_env: process.env.NODE_ENV,
            db_name: db.databaseName,
            collections: collections.map(c => c.name),
            survey_count: surveyCount,
            full_uri_masked: process.env.MONGODB_ATLAS_URI ? '...' + process.env.MONGODB_ATLAS_URI.slice(-20) : 'undefined'
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// API Routes
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api', (req, res) => {
    res.json({
        message: 'Qapture API v1.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            teams: '/api/teams',
            catalogs: '/api/catalogs',
            evaluations: '/api/evaluations',
            analytics: '/api/analytics',
            export: '/api/export',
            email: '/api/email',
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await prisma.$disconnect();
    process.exit(0);
});

export default app;
