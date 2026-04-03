# Backend Code Review Report - GigShield

## Executive Summary
Reviewed backend code in `gigshield-backend/src/`. Found **18 issues** across authentication, authorization, security, and logic categories.

---

## 1. Authentication Middleware (`src/middleware/auth.js`)

### Issues Found:
- **Line 4**: No rate limiting on token validation. Vulnerable to brute-force attacks on API endpoints.

---

## 2. Auth Routes (`src/routes/auth.js`)

### Issues Found:
- **Line 20**: OTP endpoint `/send-otp` has no rate limiting. Attackers could abuse to send spam SMS.
- **Line 41-48**: OTP verification returns generic error "Invalid OTP" for both wrong code and expired code - allows enumeration attacks.

---

## 3. Claims Routes (`src/routes/claims.js`)

### Critical Security Issues:
- **Line 17**: Internal key comparison uses strict `!==` - vulnerable to timing attacks. Should use constant-time comparison.
- **Line 252**: Hardcoded dummy bank account number `'2323230062925652'` in production code.
- **Line 253**: Predictable `fund_account_id` generation (`'fa_' + worker_id.substring(0, 10)`) - easily guessable.

### Authorization Issues:
- **Line 135**: Route `/:workerId` doesn't verify `req.user.id` matches `workerId` - any authenticated user can view any worker's claims.
- **Line 156**: Route `/:workerId/:claimId` has same authorization bypass.
- **Line 187**: Status update endpoint lacks validation that claim belongs to requester's worker.

### Logic Issues:
- **Line 99**: Generated UPI ID `${worker_id.substring(0, 8)}@upi` uses truncated UUID prefix - likely invalid UPI format.
- **Line 243**: No null check on `claim.policies` before accessing `max_weekly_payout` - will crash if policy not loaded.
- **Line 59-68**: Silently defaults fraud score to 0 when ML service fails - could be exploited to bypass fraud detection.

### Idempotency Issues:
- **Line 24-132**: `/initiate` endpoint lacks idempotency - same trigger event could create duplicate claims.

---

## 4. Policies Routes (`src/routes/policies.js`)

### Authorization Issues:
- **Line 14**: `/create` endpoint doesn't verify `req.user.id` matches `worker_id` - any user can create policy for any worker.
- **Line 76**: `/active` endpoint exposes any worker's active policy without ownership check.
- **Line 100**: `/cancel` endpoint has no authorization - any user can cancel any policy.

---

## 5. Workers Routes (`src/routes/workers.js`)

### Authorization Issues:
- **Line 53**: GET `/:id` exposes any worker's full profile without ownership verification.
- **Line 77**: PATCH `/:id/fcm-token` allows updating any worker's FCM token without authorization.

---

## 6. Services

### claimsQueueWorker.js
- **Line 24**: Uses `.eq('policies.status', 'active')` which is invalid Supabase syntax for filtering nested objects - should use a join query.
- **Line 63**: Claim number uses weak random generation (`Math.random() * 9000 + 1000`) - predictable.

### fraudService.js
- **Line 18-20**: Silently returns fraud score of 0 when ML service fails - security bypass vector.

### premiumService.js
- **Line 16-18**: Same issue - defaults to 1.0 when ML unavailable, could be exploited.

### notifyService.js
- **Line 21-24**: Uses Firebase server key directly in header without validation.

---

## 7. Triggers

### All Trigger Files (rainfallTrigger.js, outageTrigger.js, heatTrigger.js, aqiTrigger.js)

### Security Issues:
- **Line 54-62** (rainfallTrigger), **Line 54-59** (outageTrigger), **Line 54-59** (heatTrigger), **Line 58-63** (aqiTrigger): Claims queued without verifying policy exists - creates claims for workers without active policies, wastes resources.

### Logic Issues:
- **Line 53-54**: Redis TTL hardcoded to 7200 seconds (2 hours) - doesn't account for actual trigger duration.
- **Rainfall threshold (line 15)**: 15mm/hr is extremely high - unlikely to trigger in real conditions.
- **Heat threshold (line 15)**: 45°C feels_like is extreme - may never trigger.
- **AQI threshold (line 15)**: 300 AQI is "Hazardous" level - threshold may be inappropriate.

### outageTrigger.js Specific:
- **Line 21**: Hardcoded localhost URL `http://localhost:3001/mock/platform-status` - won't work in production.

---

## 8. Routes/triggers.js

### Issues:
- **Line 51**: `/active` endpoint exposes all trigger events - potential information disclosure.
- **Line 15**: No validation that `trigger_type` is a valid type.

---

## Priority Remediation

### Critical (Fix Immediately):
1. Add authorization checks to all worker-specific routes (claims, policies, workers)
2. Fix internal key comparison to use constant-time comparison
3. Remove hardcoded bank account numbers
4. Add rate limiting to auth endpoints
5. Fix worker ID ownership verification

### High:
1. Add idempotency to claim creation
2. Fix null checks on policy relationships
3. Add proper error messages instead of generic errors
4. Fix Supabase query syntax in queue worker

### Medium:
1. Update trigger thresholds to realistic values
2. Add proper UPI ID validation/generation
3. Remove predictable ID generation patterns
4. Add input validation for trigger types

---

*Report generated by code review. Total issues: 18*
