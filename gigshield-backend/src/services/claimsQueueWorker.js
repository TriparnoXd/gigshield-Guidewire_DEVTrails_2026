// Continuously reads from Redis claims queue and initiates claims
const redis = require('../config/redis');
const supabase = require('../config/supabase');
const axios = require('axios');

async function processClaimsQueue() {
  console.log('[CLAIMS QUEUE] Worker started');

  while (true) {
    try {
      // Block until item appears in queue (timeout 5s)
      const item = await redis.brpop('claims:queue', 5);

      if (!item) continue;

      const payload = JSON.parse(item[1]);
      const { trigger_event_id, trigger_type, zone, disruption_start } = payload;

      // Find all workers with active policies in this zone
      const { data: workers, error } = await supabase
        .from('workers')
        .select('id, avg_active_hrs, avg_weekly_earn, fcm_token, policies(*)')
        .eq('zone', zone)
        .eq('policies.status', 'active');

      if (error) {
        console.error('[QUEUE ERROR] Failed to fetch workers:', error.message);
        continue;
      }

      if (!workers || workers.length === 0) {
        console.log(`[QUEUE] No workers with active policies in ${zone}`);
        continue;
      }

      for (const worker of workers) {
        const activePolicy = worker.policies?.[0];
        if (!activePolicy) continue;

        // Get fraud score from ML service
        let fraudScore = 0;
        try {
          const fraudRes = await axios.post(
            `${process.env.ML_SERVICE_URL}/ml/fraud/score`,
            { worker_id: worker.id, trigger_type, zone }
          );
          fraudScore = fraudRes.data.fraud_score;
        } catch {
          fraudScore = 0; // default to clean if ML service unavailable
        }

        // Determine claim status from fraud score
        let status = 'approved';
        if (fraudScore > 85) status = 'rejected';
        else if (fraudScore > 60) status = 'soft_hold';
        else if (fraudScore > 30) status = 'verifying';

        // Calculate hourly rate
        const hourlyRate = worker.avg_weekly_earn / (worker.avg_active_hrs * 7);

        // Generate claim number
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
            disruption_start,
            hourly_rate: hourlyRate,
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

        // Send FCM notification
        if (worker.fcm_token) {
          try {
            await axios.post('https://fcm.googleapis.com/fcm/send', {
              to: worker.fcm_token,
              notification: {
                title: 'GigShield Claim Created',
                body: `Your claim ${claimNumber} has been ${status}`
              }
            }, {
              headers: {
                Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
                'Content-Type': 'application/json'
              }
            });
          } catch (notifyErr) {
            console.log('[FCM] Failed to send notification:', notifyErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[QUEUE ERROR]', err.message);
    }
  }
}

module.exports = { processClaimsQueue };
