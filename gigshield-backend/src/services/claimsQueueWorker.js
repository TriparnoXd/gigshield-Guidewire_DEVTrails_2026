// Continuously reads from Redis claims queue and initiates claims
const redis = require('../config/redis');
const supabase = require('../config/supabase');
const axios = require('axios');
const { getFraudScore, getStatusFromFraudScore } = require('../services/fraudService');
const notifyService = require('../services/notifyService');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid trigger types
const VALID_TRIGGER_TYPES = ['heavy_rainfall', 'severe_aqi', 'extreme_heat', 'platform_outage'];

async function processClaimsQueue() {
  console.log('[CLAIMS QUEUE] Worker started');

  // Process items from the queue
  while (true) {
    try {
      // Block until item appears in queue (timeout 5s)
      const item = await redis.brpop('claims:queue', 5);

      if (!item) continue;

      const payload = JSON.parse(item[1]);
      const { trigger_event_id, trigger_type, zone, disruption_start } = payload;

      // Input validation
      if (!trigger_event_id || !trigger_type || !zone || !disruption_start) {
        console.log('[QUEUE WARNING] Invalid payload received, skipping:', payload);
        continue;
      }

      if (!UUID_REGEX.test(trigger_event_id)) {
        console.log('[QUEUE WARNING] Invalid trigger event ID format, skipping:', trigger_event_id);
        continue;
      }

      if (!VALID_TRIGGER_TYPES.includes(trigger_type)) {
        console.log('[QUEUE WARNING] Invalid trigger type, skipping:', trigger_type);
        continue;
      }

      // Validate disruption_start is a valid date
      const disruptionStartDate = new Date(disruption_start);
      if (isNaN(disruptionStartDate.getTime())) {
        console.log('[QUEUE WARNING] Invalid disruption_start timestamp, skipping:', disruption_start);
        continue;
      }

      // Find all workers with active policies in this zone
      const { data: workers, error } = await supabase
        .from('workers')
        .select('id, avg_active_hrs, avg_weekly_earn, fcm_token, policies(*)')
        .eq('zone', zone)
        .eq('policies.status', 'active');

      if (error) {
        console.error('[QUEUE ERROR] Failed to fetch workers:', error.message);
        // Wait before retrying to avoid tight loop on persistent errors
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      if (!workers || workers.length === 0) {
        console.log(`[QUEUE] No workers with active policies in ${zone}`);
        continue;
      }

      for (const worker of workers) {
        try {
          const activePolicy = worker.policies?.[0];
          if (!activePolicy) continue;

          // Get fraud score from ML service with timeout
          let fraudScore = 0;
          try {
            const fraudRes = await axios.post(
              `${process.env.ML_SERVICE_URL}/ml/fraud/score`,
              { worker_id: worker.id, trigger_type, zone },
              { timeout: 5000 } // 5 second timeout
            );
            fraudScore = fraudRes.data.fraud_score || 0;
          } catch (err) {
            console.log('[ML SERVICE] Fraud service unavailable or timeout, defaulting to 0');
            fraudScore = 0;
          }

          // Determine claim status from fraud score using service function
          const status = getStatusFromFraudScore(fraudScore);

          // Validate worker data before calculations
          if (!worker.avg_weekly_earn || !worker.avg_active_hrs || worker.avg_active_hrs <= 0) {
            console.log(`[QUEUE WARNING] Invalid worker data for worker ${worker.id}, skipping`);
            continue;
          }

          // Calculate hourly rate
          const hourlyRate = worker.avg_weekly_earn / (worker.avg_active_hrs * 7);

          // Generate claim number with better uniqueness
          const year = new Date().getFullYear();
          const randomNum = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
          const claimNumber = `GS-${year}-${randomNum}`;

          // Insert claim
          const { data: claim, error: claimError } = await supabase
            .from('claims')
            .insert({
              claim_number: claimNumber,
              worker_id: worker.id,
              policy_id: activePolicy.id,
              trigger_event_id,
              trigger_type,
              zone,
              disruption_start: disruptionStartDate.toISOString(), // Ensure ISO format
              hourly_rate: parseFloat(hourlyRate.toFixed(2)), // Limit decimal places
              fraud_score: fraudScore,
              status,
              upi_id: `${worker.id.substring(0, 8)}@upi`
            })
            .select()
            .single();

          if (claimError) {
            console.error('[QUEUE ERROR] Failed to create claim:', claimError.message);
            continue;
          }

          console.log(`[CLAIM] Created ${claimNumber} for worker ${worker.id} — status: ${status}`);

          // Send FCM notification using service
          if (worker.fcm_token) {
            try {
              await notifyService.sendClaimCreatedNotification(
                worker.fcm_token,
                claim.claim_number,
                claim.status
              );
            } catch (notifyErr) {
              console.log('[FCM] Failed to send notification:', notifyErr.message);
              // Don't fail the claim creation for notification failures
            }
          }
        } catch (workerErr) {
          console.error('[QUEUE ERROR] Failed to process worker:', workerErr.message);
          // Continue with other workers
        }
      }
    } catch (err) {
      console.error('[QUEUE ERROR]', err.message);
      // Wait before retrying to avoid tight loop on persistent errors
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

module.exports = { processClaimsQueue };