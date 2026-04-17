# PayGaurd Deployment Guide

## Quick Deployment Links

### Option 1: Railway (Recommended - Free)
1. Go to: https://railway.app
2. Sign up with GitHub
3. Create new project → Deploy from GitHub
4. Select: `TriparnoXd/PayGaurd-GigShield-Devtrails`
5. Configure environment variables:
   - `RAZORPAY_KEY_ID`: Your key
   - `RAZORPAY_KEY_SECRET`: Your secret
   - `SUPABASE_URL`: Your URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your key

Your deployed link: `https://<project-name>.up.railway.app`

### Option 2: Render (Recommended - One-Click)
1. Go to: https://render.com
2. Sign up with GitHub
3. New → Blueprint
4. Select this repository.
5. Enter your environment variables when prompted.
6. Click **Apply**.

Your link: https://mobile-web.onrender.com

### Option 3: Local (Works Now)
```bash
docker compose up -d
```
Frontend: http://localhost:4000

## GitHub
https://github.com/TriparnoXd/PayGaurd-GigShield-Devtrails

## GitHub Container Registry (GHCR)
Images are automatically pushed to GHCR on every push to main.
