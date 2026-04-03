# GigShield Backend

AI-powered parametric income insurance platform for Q-Commerce delivery partners in India (Zepto & Blinkit).

## Tech Stack

- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (OTP via phone)
- **API Server**: Node.js + Express
- **Cache / Queue**: Redis (ioredis)
- **ML Service**: Python FastAPI (separate repo, call via HTTP)
- **Payment**: Razorpay (sandbox mode)
- **Notifications**: Firebase Cloud Messaging

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   # Fill in all the required values
   ```

3. Run the Supabase schema:
   - Open Supabase SQL Editor
   - Copy contents of `supabase/schema.sql`
   - Run to create tables

4. Start the server:
   ```bash
   npm run dev
   ```

5. Start mock API (optional, for testing):
   ```bash
   npm run mock-api
   ```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/send-otp` | POST | Send OTP to phone |
| `/auth/verify-otp` | POST | Verify OTP and get token |
| `/workers/profile` | POST | Create/update worker profile |
| `/workers/:id` | GET | Get worker profile |
| `/workers/:id/fcm-token` | PATCH | Update FCM token |
| `/policies/create` | POST | Create new policy |
| `/policies/:workerId/active` | GET | Get active policy |
| `/policies/:id/cancel` | PATCH | Cancel policy |
| `/claims/:workerId` | GET | Get worker's claims |
| `/claims/:workerId/:claimId` | GET | Get single claim details |
| `/triggers/active` | GET | Get active triggers |
| `/health` | GET | Health check |

## Triggers

All triggers run every 15 minutes:

- **Rainfall**: Checks OpenWeatherMap for heavy rain (>15mm/hr)
- **AQI**: Checks OpenAQ for severe air quality (>300 AQI)
- **Heat**: Checks OpenWeatherMap feels_like (>45°C)
- **Outage**: Checks mock platform status API

## Environment Variables

See `.env.example` for all required variables.

## License

Private
