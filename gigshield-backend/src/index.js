require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

app.use('/auth',     authRoutes);
app.use('/workers',  workerRoutes);
app.use('/policies', policyRoutes);
app.use('/claims',   claimRoutes);
app.use('/triggers', triggerRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gigshield-backend' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GigShield backend running on port ${PORT}`));
