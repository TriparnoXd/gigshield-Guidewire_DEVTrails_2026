# 🛒 GigShield — AI-Powered Parametric Income Insurance for Q-Commerce Delivery Partners

> **Guidewire DEVTrails 2026 | University Hackathon**
> Protecting Zepto & Blinkit delivery partners from income loss due to uncontrollable external disruptions.

---

## 📌 The Problem

Zepto and Blinkit delivery partners operate in a high-pressure, time-sensitive environment — delivering groceries and essentials within 10–20 minutes. Unlike food delivery, Q-Commerce workers face **unique and compounded disruptions**:

- **Hyperlocal weather events** (sudden rain, hailstorms, waterlogging) that make last-mile delivery impossible
- **Severe air pollution / AQI spikes** that make outdoor work unsafe
- **Local curfews, bandhs, or zone-level shutdowns** that block access to dark stores or customer zones
- **Platform outages / app downtime** that eliminate order availability entirely

When any of these events occur, the worker earns **₹0** — with no protection, no notice, and no recourse.

> **GigShield** is a weekly parametric income insurance platform that automatically detects these disruptions and pays workers their lost wages — with zero claim filing required.

---

## 👤 Persona: The Q-Commerce Delivery Partner

**Name:** Ravi, 27, Zepto delivery partner, Bengaluru (Koramangala zone)  
**Daily Schedule:** 8 AM – 9 PM (avg. 11 active hours, ~30–40 deliveries/day)  
**Weekly Earnings:** ₹3,500 – ₹5,500  
**Pain Points:**
- Loses ₹500–₹800 on rainy days when orders drop and roads flood
- Has no savings buffer; relies entirely on weekly payouts from Zepto
- Cannot afford traditional insurance; finds monthly premiums too heavy
- Doesn't have time to file claims — needs instant, automatic protection

### Persona-Based Workflow

```
[Ravi downloads GigShield app]
        ↓
[Onboarding: Links Zepto Partner ID, sets home zone, selects weekly plan]
        ↓
[GigShield calculates weekly premium based on Ravi's zone risk score]
        ↓
[Ravi pays ₹49–₹99/week via UPI — deducted every Monday]
        ↓
[System monitors weather, AQI, curfew & platform status 24x7]
        ↓
[Disruption detected in Ravi's zone → parametric trigger fires]
        ↓
[Claim auto-initiated, fraud checks run in background]
        ↓
[Payout of ₹X sent to Ravi's UPI within 2 hours — ZERO action needed from Ravi]
```

---

## 💰 Weekly Premium Model

GigShield is structured entirely on a **weekly pricing model** to match Q-Commerce workers' payout cycles.

### Premium Tiers

| Plan | Weekly Premium | Max Weekly Payout | Coverage Hours/Week |
|------|---------------|-------------------|---------------------|
| **Basic Shield** | ₹49 | ₹500 | Up to 8 hrs |
| **Standard Shield** | ₹79 | ₹900 | Up to 15 hrs |
| **Pro Shield** | ₹99 | ₹1,400 | Up to 22 hrs |

### Dynamic Premium Calculation (AI-Driven)

Base premium is adjusted weekly using the following factors:

| Factor | Direction | Example |
|--------|-----------|---------|
| Zone waterlogging history | ↑ increase | Koramangala flood-prone → +₹10 |
| Low AQI risk historically | ↓ decrease | Whitefield cleaner zone → -₹5 |
| Worker's average active hours | ↑ increase | Works 10+ hrs/day → higher exposure |
| Previous week's disruption patterns | ↑ increase | Monsoon season → +₹8 |
| Clean claim history (no fraud flags) | ↓ decrease | Loyalty discount → -₹3/week |

> **Formula:** `Weekly Premium = Base Tier × Zone Risk Multiplier × Season Factor × Loyalty Discount`

### Payout Calculation

Payout is parametric — **not based on what the worker claims, but on what the data says**.

```
Disruption Hours = Time window when trigger conditions were active in worker's zone
Hourly Rate = (Worker's avg weekly earnings) / (Avg active hours per week)
Payout = Disruption Hours × Hourly Rate (capped at plan limit)
```

---

## ⚡ Parametric Triggers

These are the 5 automated triggers that fire claims — **no manual input from worker needed**.

| # | Trigger | Data Source | Threshold | Income Impact |
|---|---------|------------|-----------|--------------|
| 1 | **Heavy Rainfall** | OpenWeatherMap API | >15mm/hr in worker's pin code | Deliveries halt, roads flood |
| 2 | **Severe AQI** | CPCB / IQAir API | AQI > 300 (Hazardous) | Unsafe outdoor work |
| 3 | **Extreme Heat** | OpenWeatherMap API | Feels-like temp > 45°C | Heat advisory, reduced orders |
| 4 | **Local Curfew / Bandh** | Government alerts + news NLP | Official order in worker's district | Zero order availability |
| 5 | **Platform Outage** | Zepto/Blinkit status mock API | >60 min outage in zone | Orders unavailable |

### Trigger Logic (Example: Heavy Rain)

```python
if rainfall_mm_per_hour > 15 and zone == worker.active_zone:
    disruption_start = timestamp
    # Monitor until rain drops below threshold
    disruption_duration_hrs = calculate_window(disruption_start, disruption_end)
    if worker.policy_active and not fraud_flag:
        initiate_payout(worker_id, disruption_duration_hrs)
```

---

## 🤖 AI/ML Integration Plan

### 1. Dynamic Premium Calculation (ML Model)
- **Model Type:** Gradient Boosted Regression (XGBoost)
- **Features:** Zone coordinates, historical rainfall/AQI, seasonal trends, worker activity hours, claim history
- **Output:** Weekly premium multiplier per worker per zone
- **Training Data:** IMD weather archives, CPCB AQI data, synthetic gig worker income datasets

### 2. Fraud Detection Engine
- **Model Type:** Isolation Forest (anomaly detection) + Rule-based layer
- **Fraud Signals Detected:**
  - GPS spoofing: Worker's location doesn't match claimed disruption zone
  - Temporal mismatch: Claim for disruption period when worker was active on platform
  - Cluster fraud: Multiple new accounts claiming same disruption simultaneously
  - Historical abuse: Workers with >3x claim frequency vs. peers in same zone
- **Output:** Fraud Risk Score (0–100). Score >70 → manual review. Score >90 → auto-reject.

### 3. Disruption Prediction (Proactive Alerts)
- **Model Type:** Time-series forecasting (LSTM or Prophet)
- **Use Case:** Predict next week's likely disruption days → pre-warn workers, adjust premium dynamically
- **Data:** 3-year historical weather + disruption event log

---

## 🏗️ Tech Stack

### Frontend
| Layer | Technology | Reason |
|-------|-----------|--------|
| Mobile App | React Native (Expo) | Single codebase for Android (primary market) + iOS |
| UI Library | NativeWind + Tailwind | Fast, responsive UI |
| State Management | Zustand | Lightweight, simple |

### Backend
| Layer | Technology | Reason |
|-------|-----------|--------|
| API Server | Node.js + Express | Fast REST API development |
| Database | PostgreSQL | Relational data for policies, claims, workers |
| Cache / Queue | Redis | Real-time trigger queue, session management |
| ML Service | Python (FastAPI) | Separate microservice for ML models |
| Auth | Firebase Auth / JWT | Simple OTP-based login for workers |

### AI/ML
| Component | Technology |
|-----------|-----------|
| Premium Model | Python + XGBoost + scikit-learn |
| Fraud Detection | Python + Isolation Forest (scikit-learn) |
| Disruption Prediction | Facebook Prophet / LSTM (TensorFlow Lite) |
| NLP for Curfew Detection | spaCy + news API |

### Integrations & APIs
| Integration | API / Service | Mode |
|------------|--------------|------|
| Weather | OpenWeatherMap (free tier) | Live |
| Air Quality | OpenAQ API (free) | Live |
| Platform Status | Mock API (simulated) | Mock |
| Payment | Razorpay Test Mode | Sandbox |
| Maps / Zone | Google Maps API | Live (free tier) |
| Notifications | Firebase Cloud Messaging | Live |

### Infrastructure
| Component | Service |
|-----------|---------|
| Hosting | Render.com / Railway (free tier) |
| ML Model Serving | Hugging Face Spaces or local FastAPI |
| Database | Supabase (Postgres, free tier) |
| CI/CD | GitHub Actions |

---

## 📱 Platform Choice: Mobile App (React Native)

**Justification:**
- Zepto/Blinkit delivery partners are exclusively smartphone-based workers
- They check earnings and app status on mobile — natural fit
- React Native allows rapid development with near-native performance
- Android-first (90%+ market share among gig workers in India)
- Offline resilience possible with local SQLite cache

---

## 🗺️ Application Workflow (Screens)

```
1. ONBOARDING
   ├── Phone OTP Login
   ├── Partner ID linking (Zepto/Blinkit)
   ├── Zone selection (pin code / map)
   └── Weekly plan selection

2. DASHBOARD (Worker)
   ├── Active policy status + expiry
   ├── This week's earnings protected
   ├── Live disruption alerts in zone
   └── Payout history

3. POLICY MANAGEMENT
   ├── Weekly plan upgrade/downgrade
   ├── Auto-renew toggle
   └── Premium breakdown (AI-calculated)

4. CLAIMS & PAYOUTS
   ├── Active disruption detected → auto-claim card
   ├── Claim status tracker
   └── Payout confirmation + UPI receipt

5. ADMIN DASHBOARD (Insurer)
   ├── Live disruption map (all zones)
   ├── Claims pipeline + fraud flags
   ├── Loss ratio analytics
   └── Next-week disruption forecast
```

---

## 📅 6-Week Development Plan

### Phase 1 (Weeks 1–2): Ideation & Foundation ✅ *[Current Phase]*
- [x] Define persona (Zepto/Blinkit Q-Commerce)
- [x] Design parametric triggers (5 triggers)
- [x] Design weekly premium model
- [x] Tech stack finalized
- [ ] GitHub repo initialized with this README
- [ ] Basic project scaffold (React Native + Node.js backend)
- [ ] 2-min strategy video

### Phase 2 (Weeks 3–4): Automation & Protection
- [ ] Worker registration + onboarding flow
- [ ] Policy creation with dynamic weekly premium (XGBoost model v1)
- [ ] 3–5 automated trigger integrations (Weather + AQI + Platform mock)
- [ ] Basic claims management system
- [ ] Zero-touch claim UX prototype

### Phase 3 (Weeks 5–6): Scale & Optimise
- [ ] Fraud detection engine (Isolation Forest)
- [ ] Razorpay sandbox payout integration
- [ ] Intelligent dual dashboard (Worker + Admin)
- [ ] Disruption prediction model
- [ ] 5-minute demo video
- [ ] Final pitch deck (PDF)

---

## 🚫 Out of Scope (By Design)

In compliance with hackathon constraints, **GigShield explicitly excludes:**
- ❌ Health or medical insurance
- ❌ Life insurance
- ❌ Accident coverage
- ❌ Vehicle repair payouts
- ❌ Any monthly pricing structures

---

## 📁 Repository Structure

```
gigshield/
├── mobile/               # React Native app (Expo)
│   ├── screens/
│   ├── components/
│   └── store/
├── backend/              # Node.js + Express API
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── triggers/         # Parametric trigger listeners
├── ml/                   # Python ML microservice (FastAPI)
│   ├── premium_model/
│   ├── fraud_detection/
│   └── disruption_forecast/
├── mock-apis/            # Simulated platform & payment APIs
└── docs/                 # Architecture diagrams, pitch deck
```

---

## 👥 Team
RA2411003010885 Triparno Das
RA2411003010896 Rishit Asthana
RA2411003010902 Adrija Dey
RA2411003010911 Kamya Singhal
RA2411003010922 Aryan Kadam

---

## 📜 License

MIT License — Built for Guidewire DEVTrails 2026 University Hackathon.
