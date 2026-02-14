# SURVIVAL MODE v3.0 — Self-Evolving AI (Stateless Edition)

## What Was Built

A fully autonomous, self-evolving crypto trading AI that:
- **Learns** from its own trades and auto-adjusts strategy
- **Heals** itself (retry with backoff, graceful degradation, auto-restart)
- **Protects** capital (emergency shutdown at $2, daily loss limits)
- **Shows earnings** in a clean, no-jargon dashboard

---

## v3 New Features

### 🛡️ Stateless Mode (Anti-Mati)
The bot now runs in **Stateless Mode**.
- **No Database Dependency**: It reads your balance and trade history directly from the Exchange every 5 minutes.
- **Immortal**: Even if Vercel server restarts or crashes, the bot loses nothing. It simply "wakes up", checks the blockchain/exchange, and continues where it left off.
- **Minimum Balance**: Lowered to **$2** (though $10+ is recommended for smooth trading).

### 🧠 Strategy Engine: "The Predator"
- **Dip Sniper**: Buys when RSI < 40 in an Uptrend (Buy Low).
- **Breakout Chaser**: Buys when Price hits Highs + Volume Spike (Momentum).
- **Trend Follower**: Buys when MACD & Trend align perfectly.
- **AI Veto**: If AI detects bad sentiment, it cancels any signal.

### 🛡️ Risk Manager: "Profit Locking"
Once a trade is green, we never let it go red.
- **+1% Profit** → SL moves to Break-Even.
- **+3% Profit** → SL moves to +1.5% (Locked).
- **+5% Profit** → SL moves to +3% (Locked).
- **+10% Profit** → SL moves to +8% (Moonbag).

### 🩹 Self-Healing
- API failures → retry 3x with 2s/4s/6s backoff
- AI goes down → falls back to indicators only
- Balance drops below $2 → emergency shutdown
- Balance recovers → auto-restart trading

### 💰 Owner-First Dashboard
- Giant **"Your Earnings"** display — only number that matters
- ROI percentage
- Simple status: RUNNING / STOPPED / OFFLINE
- **Equity Chart**: Visual graph of profit/loss over time (Dynamic Start Balance)

---

## 🚀 Deployment & Setup Guide (Vercel)

### Step 1: Deploy to Vercel
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import repository: `arra7trader/survival`.
3. Open **Environment Variables** section. Add your keys:

#### Option A: Use Binance (Recommended)
| Name | Value |
|------|-------|
| `BINANCE_API_KEY` | Your Binance API Key |
| `BINANCE_SECRET` | Your Binance Secret |
| `GROQ_API_KEY` | Your Groq AI Key |
| `CRON_SECRET` | `survival-secret-123` |

#### Option B: Use Bitget
| Name | Value |
|------|-------|
| `BITGET_API_KEY` | Your Bitget API Key |
| `BITGET_SECRET` | Your Bitget Secret |
| `BITGET_PASSPHRASE`| Your Bitget Passphrase (Password) |
| `GROQ_API_KEY` | Your Groq AI Key |
| `CRON_SECRET` | `survival-secret-123` |

4. Click **Deploy**.

### Step 2: Setup Cron Job (Wajib!)
Since Vercel Hobby plan limits cron jobs, use **[cron-job.org](https://cron-job.org)** (It's free).

1. **Sign Up** at cron-job.org.
2. **Create Cron Job** (Trade Loop):
   - URL: `https://<YOUR-VERCEL-URL>.vercel.app/api/cron/trade`
   - Schedule: **Every 5 minutes**
   - Headers (Advanced):
     - Key: `Authorization`
     - Value: `Bearer survival-secret-123` (Match your CRON_SECRET)
3. **Simulate**: Check if it returns "200 OK".

---

## 🔑 How to Get API Keys

### Binance
1. Login → Profile → **API Management**.
2. Create API (System Generated).
3. **Copy Secret Key** immediately.
4. Edit Restrictions: Enable **Spot & Margin Trading**.

### Bitget
1. Login → Profile → **API Management**.
2. Create API Key.
3. Note: You must set a **Passphrase** (password) for the key. Remember it!
4. Permissions: Select **Spot** → **Trade**.
5. Copy **Access Key**, **Secret Key**, and your **Passphrase**.
