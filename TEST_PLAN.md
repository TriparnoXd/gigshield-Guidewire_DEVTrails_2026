# GigShield Localhost Test Plan

This document outlines the steps to verify that the GigShield application is fully functional on `localhost`.

## Prerequisites
1.  **Backend:** Ensure the Node.js server is running on `http://localhost:3000`.
2.  **Frontend:** Ensure the Expo web app is running on `http://localhost:4000`.
3.  **Browser DevTools:** Open the **Network** tab in your browser (F12) to monitor API calls.

---

## Step 1: Onboarding & OTP Request
1.  Open `http://localhost:4000` in your browser.
2.  Enter a mobile number (e.g., `9876543210`) and a Rider ID.
3.  Select an "Operating Hub".
4.  Click **"Secure My Income"**.
5.  **Expected Behavior:**
    *   A `POST` request to `http://localhost:3000/auth/send-otp` is visible in the Network tab.
    *   Response status: `200 OK` (or `400/500` if Supabase isn't configured, but the call *must* fire).
    *   UI navigates to the **OTP Verification** screen.

## Step 2: OTP Verification
1.  Enter the 6-digit OTP (e.g., `123456`).
2.  Click **"Verify & Continue"**.
3.  **Expected Behavior:**
    *   A `POST` request to `http://localhost:3000/auth/verify-otp` is visible in the Network tab.
    *   Response should contain `access_token` and `worker` object.
    *   UI stores the token in the store (check `console.log` for success message).
    *   UI navigates to the **Protection Plans** screen.

## Step 3: Protection Plans
1.  Wait for the Protection Plans screen to load.
2.  **Expected Behavior:**
    *   A `GET` request to `http://localhost:3000/policies/plans` is visible in the Network tab.
    *   The UI displays the plans fetched from the backend (Basic, Standard, Pro).

---

## Debugging Tips
*   **CORS Issues:** If you see "CORS error" in the console, verify that `gigshield-backend/src/index.js` allows `http://localhost:4000`.
*   **Base URL:** Check `mobile/src/api/client.ts` to ensure `baseURL` is set to `http://localhost:3000`.
*   **Logs:** Check the browser console and backend terminal for `[API Request]` and `[API Response]` logs.
