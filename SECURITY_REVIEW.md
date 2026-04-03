# GigShield Backend Security Audit & Code Review

## Configuration Files

FILE: gigshield-backend/src/config/firebase.js
PURPOSE: Initializes the Firebase Admin SDK for FCM notifications.

ISSUES FOUND:
None. The file securely relies on environment variables (used later in the notify service) and does not hardcode any sensitive credentials.

OVERALL FILE HEALTH: PASS


FILE: gigshield-backend/src/config/redis.js
PURPOSE: Initializes and exports the Redis client for caching and queueing, falling back to a mock if disabled.

ISSUES FOUND:
MEDIUM — Silenced Redis error events obscure production issues
FIX:
```javascript
  redis.on('error', (err) => {
    console.error('[REDIS ERROR] Connection issue:', err.message);
  });
```
REASON: While providing an empty callback successfully prevents the unhandled 'error' event from crashing the Node.js process, it completely obscures infrastructure failures. Logging the error ensures visibility without crashing.

OVERALL FILE HEALTH: PASS


FILE: gigshield-backend/src/config/supabase.js
PURPOSE: Creates and exports a Supabase client using the service role key for database operations.

ISSUES FOUND:
None in this file directly. Using the service role key on the backend is standard for administrative operations. However, because it bypasses Row Level Security (RLS), all authorization and ownership checks (to prevent IDOR) must be strictly enforced in the route handlers.

OVERALL FILE HEALTH: PASS


## Middleware and Setup Files

FILE: gigshield-backend/src/middleware/auth.js
PURPOSE: Verifies Supabase JWT tokens to protect authenticated routes.

ISSUES FOUND:
None directly. The middleware correctly extracts the token and uses Supabase's `getUser` which validates token signature and expiry securely.

OVERALL FILE HEALTH: PASS


FILE: gigshield-backend/src/middleware/errorHandler.js
PURPOSE: Global Express error handler to catch errors and return consistent JSON responses without leaking stack traces.

ISSUES FOUND:
None. The handler successfully strips stack traces and avoids exposing raw database errors.

OVERALL FILE HEALTH: PASS


FILE: gigshield-backend/src/index.js
PURPOSE: Main entry point for the Express server, setting up middleware, routes, cron triggers, and the queue worker.

ISSUES FOUND:
MEDIUM — Missing rate limiting middleware for API routes
FIX:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests, please try again later.' }
});

app.use(apiLimiter);
```
REASON: Without a global rate limiter, the API is vulnerable to basic DoS and brute-force attacks.


LOW — Basic health check
FIX:
```javascript
app.get('/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('workers').select('id').limit(1);
    if (error) throw error;
    res.json({ success: true, status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ success: false, status: 'error', db: 'disconnected' });
  }
});
```
REASON: A simple `status: ok` doesn't verify backend connectivity to the database or Redis.

OVERALL FILE HEALTH: NEEDS WORK

## Routes

FILE: gigshield-backend/src/routes/auth.js
PURPOSE: Handles OTP generation and verification for worker authentication.

ISSUES FOUND:
CRITICAL — OTP endpoints lack specific rate limiting, allowing SMS bombing and brute-force attacks
FIX:
```javascript
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window`
  message: { error: 'Too many OTP requests, please try again later.' }
});

router.post('/send-otp', otpLimiter, async (req, res, next) => { ... });
router.post('/verify-otp', otpLimiter, async (req, res, next) => { ... });
```
REASON: Attackers could repeatedly hit the `/send-otp` and `/verify-otp` endpoints, causing financial loss via SMS costs and potentially guessing OTPs.

MEDIUM — Lack of strict input validation for phone number
FIX:
```javascript
  if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
```
REASON: Validating that the input matches expected phone number formats prevents garbage input from hitting Supabase.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/routes/workers.js
PURPOSE: Manages worker profile data and FCM token updates.

ISSUES FOUND:
CRITICAL — Insecure Direct Object Reference (IDOR) on GET `/workers/:id` and PATCH `/workers/:id/fcm-token`
FIX:
```javascript
// GET /workers/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // IDOR Check
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
```javascript
// PATCH /workers/:id/fcm-token
router.patch('/:id/fcm-token', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fcm_token } = req.body;

    // IDOR Check
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
REASON: The backend uses the Supabase service role key, bypassing database-level RLS. Without application-level authorization checks, any authenticated user can read or modify any other worker's profile by guessing their UUID.

OVERALL FILE HEALTH: CRITICAL


FILE: gigshield-backend/src/routes/policies.js
PURPOSE: Manages policy creation, cancellation, and retrieval for workers.

ISSUES FOUND:
CRITICAL — Insecure Direct Object Reference (IDOR) on POST `/policies/create`, GET `/policies/:workerId/active`, and PATCH `/policies/:id/cancel`
FIX:
```javascript
// POST /policies/create
router.post('/create', auth, async (req, res, next) => {
  try {
    const { worker_id, plan } = req.body;

    if (req.user.id !== worker_id) {
       return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
```javascript
// GET /policies/:workerId/active
router.get('/:workerId/active', auth, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    if (req.user.id !== workerId) {
       return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
```javascript
// PATCH /policies/:id/cancel
// Requires looking up the policy first to confirm ownership
router.patch('/:id/cancel', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: policy } = await supabase.from('policies').select('worker_id').eq('id', id).single();
    if (!policy || policy.worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
REASON: Just like worker profiles, policy access control is missing. Any user can create, read, or cancel policies for other workers.

HIGH — ML Service HTTP call lacks timeout
FIX:
```javascript
    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/ml/premium/calculate`, {
        worker_id,
        plan
      }, { timeout: 5000 });
      multiplier = mlRes.data.multiplier || 1.0;
    }
```
REASON: If the external Python FastAPI service hangs, the policy creation request will hang indefinitely, leading to connection pool exhaustion.

OVERALL FILE HEALTH: CRITICAL


FILE: gigshield-backend/src/routes/claims.js
PURPOSE: Handles claim initiation, retrieval, and settlement.

ISSUES FOUND:
CRITICAL — Insecure Direct Object Reference (IDOR) on GET `/claims/:workerId` and GET `/claims/:workerId/:claimId`
FIX:
```javascript
// GET /claims/:workerId
router.get('/:workerId', auth, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    if (req.user.id !== workerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
```javascript
// GET /claims/:workerId/:claimId
router.get('/:workerId/:claimId', auth, async (req, res, next) => {
  try {
    const { workerId, claimId } = req.params;

    if (req.user.id !== workerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // ...
```
REASON: Same IDOR flaw. Workers can view claims belonging to other workers. Note that returning `fraud_flags` in the response is also flagged in the code itself as something that should not go to production.

HIGH — Missing timeout and SSRF considerations for ML and Firebase calls
FIX:
```javascript
    try {
      const fraudRes = await axios.post(`${process.env.ML_SERVICE_URL}/ml/fraud/score`, {
        worker_id,
        trigger_type,
        zone
      }, { timeout: 5000 });
// ...
            await axios.post('https://fcm.googleapis.com/fcm/send', {
              to: worker.fcm_token,
              notification: { ... }
            }, {
              headers: { ... },
              timeout: 5000
            });
```
REASON: Missing timeouts can cause connection pool exhaustion if the external service hangs.

MEDIUM — Business Logic in Route Controllers
FIX:
```javascript
// Example refactoring into a service
// Move payout calculation to payoutService.js
const { calculatePayout } = require('../services/payoutService');
// Inside router.post('/:id/settle', ...)
const disruptionHours = (new Date(claim.disruption_end) - new Date(claim.disruption_start)) / (1000 * 60 * 60);
const payoutAmount = calculatePayout(disruptionHours, claim.hourly_rate, claim.policies.max_weekly_payout);
```
REASON: Complex logic should reside in service layer functions.


HIGH — Unvalidated payment webhook (missing)
FIX:
```javascript
// Example webhook validation (assuming a new webhook route is created, as none exists)
const crypto = require('crypto');
router.post('/webhook', (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  if (expectedSignature !== signature) return res.status(400).send('Invalid signature');
  // Add idempotency check before processing
  // ...
});
```
REASON: Without webhook validation and an idempotency layer, duplicate payouts could occur, or attackers could mock successful payments. Payment amounts also must be strictly checked server-side, not trusted from any client.

MEDIUM — Inconsistent Response Shape
FIX: Update responses to consistently use `{ success: true, data: { ... } }` or `{ success: false, error: '...', message: '...' }`.
REASON: Currently the API directly returns objects like `{ claim }` or arrays without a consistent wrapper.

OVERALL FILE HEALTH: CRITICAL


FILE: gigshield-backend/src/routes/triggers.js
PURPOSE: Internal endpoints for logging and fetching active triggers.

ISSUES FOUND:
None directly. The routes correctly use `internalAuth` protecting them with `process.env.INTERNAL_KEY`.

OVERALL FILE HEALTH: PASS


## Services

FILE: gigshield-backend/src/services/claimsQueueWorker.js
PURPOSE: Continuously reads from Redis claims queue and initiates claims.

ISSUES FOUND:
HIGH — ML Service and FCM HTTP calls lack timeout
FIX:
```javascript
        try {
          const fraudRes = await axios.post(
            `${process.env.ML_SERVICE_URL}/ml/fraud/score`,
            { worker_id: worker.id, trigger_type, zone },
            { timeout: 5000 }
          );
// ...
            await axios.post('https://fcm.googleapis.com/fcm/send', {
              to: worker.fcm_token,
              notification: { ... }
            }, {
              headers: { ... },
              timeout: 5000
            });
```
REASON: A hanging external service will stall the queue processor entirely.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/services/fraudService.js
PURPOSE: Helper service to get fraud score and determine status.

ISSUES FOUND:
HIGH — ML Service HTTP call lacks timeout
FIX: Add `timeout: 5000` to the axios call.
```javascript
    await axios.post('https://fcm.googleapis.com/fcm/send', {
      to: fcmToken,
      notification: { title, body }
    }, {
      headers: {
        Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
```
REASON: Connection hangs.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/services/notifyService.js
PURPOSE: Handles push notifications.

ISSUES FOUND:
HIGH — FCM HTTP call lacks timeout
FIX: Add `timeout: 5000` to the axios call.
```javascript
    await axios.post('https://fcm.googleapis.com/fcm/send', {
      to: fcmToken,
      notification: { title, body }
    }, {
      headers: {
        Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
```
REASON: Connection hangs.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/services/payoutService.js
PURPOSE: Calculates payout amounts.

ISSUES FOUND:
None directly.

OVERALL FILE HEALTH: PASS


FILE: gigshield-backend/src/services/premiumService.js
PURPOSE: Calculates premium multipliers.

ISSUES FOUND:
HIGH — ML Service HTTP call lacks timeout
FIX: Add `timeout: 5000` to the axios call.
```javascript
    const res = await axios.post(`${process.env.ML_SERVICE_URL}/ml/premium/calculate`, {
      worker_id,
      plan
    }, { timeout: 5000 });
```
REASON: Connection hangs.

OVERALL FILE HEALTH: NEEDS WORK

## Triggers

FILE: gigshield-backend/src/triggers/aqiTrigger.js
PURPOSE: Cron job checking OpenAQ for severe pollution levels.

ISSUES FOUND:
HIGH — Potential overlapping executions and race conditions
FIX:
```javascript
      const redisKey = `trigger:aqi:${zone.name}`;
      // Use atomic SET with NX and EX to prevent deadlocks
      const locked = await redis.set(`${redisKey}:lock`, "1", "EX", 60, "NX");
      if (!locked) continue;

      const existing = await redis.get(redisKey);
// ...
```
REASON: The trigger runs every 15 minutes. If OpenAQ is slow, the next cron tick might start before the first finishes. `redis.get` followed by `redis.setex` is not atomic, leading to duplicate triggers.

HIGH — Missing timeout for external API
FIX: Add `timeout: 5000` to the axios GET request.
```javascript
      const res = await axios.get(`${process.env.OPENAQ_BASE_URL}/measurements`, {
        params: {
          coordinates: `${zone.lat},${zone.lon}`,
          parameter: 'pm25',
          radius: 5000,
          limit: 1,
          sort: 'desc'
        },
        timeout: 5000
      });
```
REASON: OpenAQ might hang.

OVERALL FILE HEALTH: NEEDS WORK



MEDIUM — Hardcoded threshold values (magic numbers)
FIX:
```javascript
// Replace const HEAT_THRESHOLD = 45;
const HEAT_THRESHOLD = process.env.HEAT_THRESHOLD || 45;
```
REASON: Keeping thresholds in code requires deployments to change business rules.

MEDIUM — Trigger state persistence is only in memory/Redis
FIX:
```javascript
// Add a startup script or cron to sync DB state with Redis state
const { data: activeTriggers } = await supabase.from('trigger_events').select('id, zone, trigger_type').eq('is_active', true);
// iterate and check if redis key exists, if not, mark as inactive in DB
```
REASON: If the node crashes, Redis might clear the key while the database thinks the trigger is still active, causing desync.

MEDIUM — FCM Notification Deduplication missing
FIX:
```javascript
// Add a check in claimsQueueWorker.js before sending FCM
const alreadySent = await redis.get(`fcm_sent:${worker.id}:${trigger_event_id}`);
if (!alreadySent) {
  await sendPushNotification(...);
  await redis.setex(`fcm_sent:${worker.id}:${trigger_event_id}`, 86400, "1");
}
```
REASON: Workers might receive multiple notifications for the same ongoing disruption.

OVERALL FILE HEALTH: NEEDS WORK

FILE: gigshield-backend/src/triggers/heatTrigger.js
PURPOSE: Cron job checking OpenWeatherMap for extreme heat.

ISSUES FOUND:
HIGH — Potential overlapping executions and race conditions
FIX:
```javascript
      const redisKey = `trigger:heat:${zone.name}`;
      // Use atomic SET with NX and EX to prevent deadlocks
      const locked = await redis.set(`${redisKey}:lock`, "1", "EX", 60, "NX");
      if (!locked) continue;

      const existing = await redis.get(redisKey);
// ...
```
REASON: Same race condition risk.

HIGH — Missing timeout for external API
FIX: Add `timeout: 5000` to the axios GET request.
```javascript
      const res = await axios.get(`${process.env.OPENWEATHER_BASE_URL}/weather`, {
        params: {
          lat: zone.lat,
          lon: zone.lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 5000
      });
```
REASON: OpenWeatherMap might hang.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/triggers/outageTrigger.js
PURPOSE: Cron job checking a mock API for platform outages.

ISSUES FOUND:
HIGH — Potential overlapping executions and race conditions
FIX:
```javascript
      const redisKey = `trigger:outage:${zone}`;
      // Use atomic SET with NX and EX to prevent deadlocks
      const locked = await redis.set(`${redisKey}:lock`, "1", "EX", 60, "NX");
      if (!locked) continue;

      const existing = await redis.get(redisKey);
// ...
```
REASON: Same race condition risk.

OVERALL FILE HEALTH: NEEDS WORK


FILE: gigshield-backend/src/triggers/rainfallTrigger.js
PURPOSE: Cron job checking OpenWeatherMap for heavy rainfall.

ISSUES FOUND:
HIGH — Potential overlapping executions and race conditions
FIX:
```javascript
      const redisKey = `trigger:rainfall:${zone.name}`;
      // Use atomic SET with NX and EX to prevent deadlocks
      const locked = await redis.set(`${redisKey}:lock`, "1", "EX", 60, "NX");
      if (!locked) continue;

      const existing = await redis.get(redisKey);
// ...
```
REASON: Same race condition risk.

HIGH — Missing timeout for external API
FIX: Add `timeout: 5000` to the axios GET request.
```javascript
      const res = await axios.get(`${process.env.OPENWEATHER_BASE_URL}/weather`, {
        params: {
          lat: zone.lat,
          lon: zone.lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 5000
      });
```
REASON: OpenWeatherMap might hang.

OVERALL FILE HEALTH: NEEDS WORK

## SUMMARY

**Total Issues by Severity:**
- CRITICAL: 5 (IDOR vulnerabilities across multiple routes, Missing Rate Limiting for OTP)
- HIGH: 9 (Missing timeouts for external API calls, Race conditions in triggers)
- MEDIUM: 8 (Silenced Redis errors, Missing global rate limiting, Business logic in controllers)
- LOW: 0

**Top 3 Most Urgent Fixes:**
1. **Fix IDOR Vulnerabilities**: Immediately implement authorization checks (e.g., `req.user.id !== requestedId`) on all `/workers`, `/policies`, and `/claims` endpoints. The use of the Supabase service role key means application-level checks are the only defense against horizontal privilege escalation.
2. **Implement Rate Limiting for OTPs**: Add strict rate limiting to `/auth/send-otp` to prevent SMS bombing, which can lead to rapid financial drain and potential account takeover.
3. **Add Timeouts to External Calls and Implement Trigger Locks**: Ensure all Axios calls (ML service, OpenAQ, OpenWeatherMap, FCM) have strict timeouts (e.g., `timeout: 5000`), and implement atomic Redis locks (`SET` with `NX` and `EX`) in the cron triggers to prevent overlapping executions and queue floods.

**Missing Files / Components:**
- No global `rateLimiter.js` or specific OTP limiter.
- No robust input validation middleware (e.g., Joi or express-validator schemas) to sanitize incoming payloads before processing.
- Missing test files or a test script in `package.json` to verify business logic and endpoints.

**Overall Security Posture:**
The current gigshield-backend exhibits a weak security posture primarily due to severe Insecure Direct Object Reference (IDOR) vulnerabilities caused by bypassing database RLS with a service role key while failing to implement compensating application-level ownership checks. Additionally, the lack of rate limiting on sensitive endpoints (OTP) and missing timeouts on external dependencies make the system highly susceptible to both abuse (SMS bombing) and cascading failures (DoS via connection pool exhaustion). While the architecture (Express, Supabase, Redis) is standard, the implementation requires immediate remediation of these critical flaws before it can be considered safe for production use.
