# 🎓 GigShield Technical Interview Preparation Guide

This guide is designed to help you ace your technical interview for GigShield. It covers the architecture, core innovations, machine learning components, security measures, and common technical questions.

---

## 🏗️ 1. High-Level Architecture

GigShield follows a **Microservices Architecture** to ensure scalability and separation of concerns.

1.  **Mobile Frontend (React Native/Expo):**
    *   **Purpose:** The primary interface for delivery partners.
    *   **Key Tech:** Zustand (State Management), NativeWind (Styling), React Navigation.
    *   **Core Flow:** Onboarding → Policy Purchase → Dashboard Monitoring → Automated Payouts.

2.  **Backend API (Node.js/Express):**
    *   **Purpose:** Orchestrates business logic, manages users/policies/claims, and handles external integrations.
    *   **Key Tech:** Supabase (PostgreSQL), Redis (Queue/Cache), node-cron (Triggers).
    *   **Role:** Listens for triggers, pushes claim tasks to Redis, and communicates with the ML Service.

3.  **ML Service (Python/FastAPI):**
    *   **Purpose:** Specialized service for compute-heavy AI tasks.
    *   **Key Tech:** Scikit-learn, XGBoost, Pandas, Joblib.
    *   **Role:** Calculates dynamic premiums and performs fraud detection on claims.

---

## ⚡ 2. Core Innovation: Parametric Triggers

Traditional insurance requires manual filing. GigShield uses **Parametric Insurance**—claims are triggered by *data*, not by *filing*.

*   **Automated Detection:** Cron jobs monitor external APIs (OpenWeather, CPCB AQI).
*   **Threshold-Based:** If Rain > 15mm/hr or AQI > 300, a `trigger_event` is created.
*   **Zero-Touch Claims:** Once a trigger is active, the backend automatically finds affected workers and initiates claims.
*   **Instant Payouts:** Integrated with Razorpay/UPI for near-instant disbursement once fraud checks clear.

---

## 🤖 3. Artificial Intelligence & Machine Learning

### A. Dynamic Premium Model
*   **Model:** XGBoost (Gradient Boosted Trees).
*   **Objective:** Predict a fair weekly premium based on risk.
*   **Features:** Zone risk score (top feature), historical weather patterns, worker activity hours, and claim history.
*   **Explainability:** Uses **SHAP (SHapley Additive exPlanations)** to show which factors influenced the premium calculation.

### B. Fraud Detection Engine
*   **Model:** Isolation Forest (Anomaly Detection) + Rule-based logic.
*   **Objective:** Identify GPS spoofing and ring-based fraud.
*   **Signals:**
    *   **Sensor Flatline:** Real devices have accelerometer noise. Flat lines indicate a simulated device.
    *   **GPS vs. Network Mismatch:** Cross-referencing GPS with WiFi/Cell tower data.
    *   **Temporal Anomaly:** Claiming for a disruption when the worker wasn't even logged into the platform app.

---

## 🛡️ 4. Security & Anti-Fraud (The "Market Crash" Defense)

One of GigShield's strongest points is its defense against coordinated fraud rings.

*   **Layer 1 (Telemetry):** Passive fingerprinting (Mock Location API detection, Sensor consistency).
*   **Layer 2 (Behavioral):** Comparing the current claim location against the worker's historical baseline zones.
*   **Layer 3 (Graph Analysis):** Louvain algorithm to detect "clusters" of accounts sharing IPs or Device IDs.
*   **Tiered Adjudication:**
    *   `0-30 Score`: Auto-approve.
    *   `31-60 Score`: Soft hold (4-hour delay).
    *   `61+ Score`: Manual review/Reject.

---

## ❓ 5. Expected Technical Questions & Answers

### Q1: Why did you choose Node.js for the backend and Python for the ML service?
**A:** Node.js is excellent for I/O-intensive tasks like handling API requests, managing Redis queues, and orchestrating microservices due to its non-blocking event loop. Python is the industry standard for ML because of its rich ecosystem (Scikit-learn, Pandas, XGBoost) and is better suited for the heavy data processing required for our models.

### Q2: How do you handle race conditions when multiple triggers fire at once?
**A:** We implemented a "mutex lock" mechanism in our cron jobs using an `isRunning` flag. This prevents overlapping executions of the same trigger script, which could lead to duplicate claim entries. Additionally, we use Redis as a reliable queue to process claims sequentially.

### Q3: What happens if the OpenWeather API is down?
**A:** Our backend includes robust error handling with timeouts (10s for external APIs). If an API fails, the error is caught and logged, but it doesn't crash the server. We also have a "degraded" health state that alerts admins if a critical dependency is unavailable. In a production environment, we would implement a fallback to secondary weather providers (e.g., AccuWeather).

### Q4: Explain how the "Parametric" aspect works in your database schema.
**A:** We have a `trigger_events` table that stores the ground truth (e.g., Rain = 20mm/hr). The `claims` table has a foreign key `trigger_event_id`. This decouples the "event" from the "individual claim," allowing us to audit exactly why a claim was paid based on objective data.

### Q5: How did you ensure the security of the API?
**A:** We performed a security audit and implemented several layers of defense:
1.  **IDOR Protection:** Every request to `/workers/:id` or `/claims` validates that the authenticated user matches the resource owner.
2.  **Rate Limiting:** OTP endpoints are limited to 5 requests per 15 minutes to prevent brute-force attacks.
3.  **Input Validation:** Strict UUID and data-type validation using middleware before any database operation.

---

## 🚀 The Elevator Pitch (Technical)
"GigShield is an AI-driven parametric insurance platform for gig workers. We've built a multi-layered architecture using **React Native** for the frontend, **Node.js** for event orchestration, and **FastAPI** for ML inference. Our core innovation is the **zero-touch claim system** that uses **XGBoost** for risk-based pricing and **Isolation Forest** for automated fraud detection, ensuring that workers get paid instantly when disruptions like floods or hazardous AQI occur, with zero paperwork required."
