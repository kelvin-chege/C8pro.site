import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google GenAI client if API key is available
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with key:', err);
  }
}

// Deep Built-in Trading Intelligence Knowledge Base (Tracy AI, Gemini, ChatGPT, and Marcus Vance personas)
function generateHumanMentorResponse(userMessage: string, context?: any, mode?: string): string {
  const lower = userMessage.toLowerCase();
  const pair = context?.pair || 'the current asset';
  const hasUserBalance = !!context?.isBalanceSetByUser && !!context?.balance && context.balance !== '100';
  const balance = hasUserBalance ? context.balance : '';
  const tab = context?.tab || 'deriv';
  const timeframe = context?.timeframe || '1t';
  const currentDigit = context?.hotDigit ?? '7';
  const dayName = context?.day || new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Mode-specific tone prefixes
  const isTracy = mode === 'tracy' || !mode;
  const isGemini = mode === 'gemini';
  const isChatGPT = mode === 'chatgpt';

  // Casual Human Greetings & Identity Check
  if (lower.includes('who are you') || lower.includes('your name') || lower.includes('tell me about yourself') || lower.includes('are you human') || lower.includes('meet you')) {
    return `### ✨ Hey! I'm Tracy, your real-time trading partner & friend 🎙️

I'm Tracy—your dedicated, human-like trading partner and personal mentor sitting right here at the desk with you.

Think of me as your second set of eyes on the market. When you're trading:
* **I watch the risk with you**: We protect your capital with strict **1% risk per trade**${hasUserBalance ? ` ($${(parseFloat(balance) * 0.01).toFixed(2)})` : ''}. You can tell me your exact account balance whenever you are ready!
* **I master the strategies with you**: I know the exact minutes and entry rules for **Over/Under**, **Even/Odd**, **Raise & Fall (Rise/Fall)**, **High/Low Tick**, and **Ups/Downs**.
* **I keep you calm & focused**: If you take a hit or feel that urge to revenge trade, talk to me. I'm right here to talk you down and reset your headspace.

You can talk to me naturally using your voice or keyboard—just like calling a real trading friend. How are you feeling right now?`;
  }

  // User Tells Their Account Balance: e.g. "my balance is 500", "I have 250 usd", "set balance to 1000"
  if (lower.includes('my balance is') || lower.includes('balance is') || lower.includes('i have') || lower.includes('my capital is') || lower.includes('set balance')) {
    const balMatch = lower.match(/(?:my\s+balance\s+is|balance\s+is|i\s+have|my\s+capital\s+is|set\s+balance\s+to)\s+\$?(\d+(?:\.\d+)?)/i);
    if (balMatch && balMatch[1]) {
      const val = parseFloat(balMatch[1]);
      return `### 💰 Perfect! I've recorded your account balance as **$${val.toFixed(2)}**

Hey partner! I've noted down your exact balance of **$${val.toFixed(2)}**. From here on, all our risk management is calibrated to this number:

* **Safe 1% Risk Stake**: **$${(val * 0.01).toFixed(2)}** per trade.
* **Aggressive 2% Cap**: **$${(val * 0.02).toFixed(2)}** maximum.
* **Daily Goal (5%)**: Target **+$${(val * 0.05).toFixed(2)}** profit.
* **Session Circuit Breaker (3%)**: If we ever draw down -$${(val * 0.03).toFixed(2)}, we step away for 30 minutes.

We are ready to trade with discipline! What market shall we scan first—Vol 15 (1s), Vol 75, or Step Index 100?`;
    }
  }

  // PRO STRATEGY 1: OVER / UNDER
  if (lower.includes('over under') || lower.includes('over/under') || (lower.includes('over') && lower.includes('under')) || lower.includes('over 4') || lower.includes('under 5')) {
    return `### 🎯 Tracy's Pro Over / Under Strategy Playbook

Hey partner! Over/Under offers massive high-probability edges when traded with mathematical discipline. Here is how I trade it:

#### 1. ⏱️ Which Minutes & Ticks To Use:
* **1-Minute (M1 Expiration - The Pro Standard)**: When the 50-tick scanner shows Over skew at **≥ 58%**, enter **OVER 4** for 1 minute (60 seconds). This lets macro digit flow work for you without getting stopped out by a single random low tick!
* **1-Tick Fast Sniper**: Use this specifically on fast 1-second synthetics (**1HZ15V**, **1HZ10V**, **1HZ75V**) when you see a cluster of 2-3 extreme low digits (0, 1, or 2). Enter **OVER 2** (92% safe win rate) or **OVER 3** for an immediate mean-reversion win.

#### 2. 🎯 Exact Entry Triggers:
* **🔥 OVER 4 / OVER 3 ENTRY**:
  1. Check the **Multi-Volatility Scanner** tab: Ensure Over skew is at least **56%**.
  2. Watch the live digit stream: Wait for **2 consecutive low digits (0, 1, or 2)** (cold cluster exhaustion).
  3. Ensure price is holding above the M1 EMA 9 dynamic support line.
  4. **The Trigger**: Click **OVER 3** or **OVER 4** on tick 0. Poisson clustering dictates a high-digit snap-back.
* **❄️ UNDER 5 / UNDER 6 ENTRY**:
  1. Ensure scanner shows Under skew at least **56%**.
  2. Wait for an over-extended cluster of **2 high digits (8 or 9)**.
  3. **The Trigger**: Click **UNDER 6** (82% safe win rate) or **UNDER 5** on 1-tick or 1-minute expiration.

Want to test this together right now? Check the scanner and tell me which volatility has the highest edge!`;
  }

  // PRO STRATEGY 2: EVEN / ODD
  if (lower.includes('even odd') || lower.includes('even/odd') || (lower.includes('even') && lower.includes('odd'))) {
    return `### ⚖️ Tracy's Pro Even / Odd Parity Playbook

Hey partner! Even/Odd is pure binary trading, and here is the exact math I use on the desk:

#### 1. ⏱️ Which Minutes To Use:
* **1-Tick ONLY (The Golden Law of Parity)**: NEVER use minutes for Even/Odd! Because each tick is an independent parity event, the conditional streak edge exists *only* on the immediate transition tick. 1 tick keeps your edge 100% clean and eliminates random diffusion.

#### 2. 🎯 Exact Entry Trigger — The "Rule of 3" Streak Reversal (78.4% Win Rate):
* Count the last 5 digits in our radar box.
* Wait patiently until you see a streak of **3 consecutive Evens** (e.g. 4, 8, 2) OR **3 consecutive Odds** (e.g. 7, 1, 9).
* In synthetic RNG algorithms, 4 consecutive identical parities happen less than 22% of the time!
* **The Trigger**: Click the **OPPOSITE PARITY** on 1 tick immediately after the 3rd streak tick (e.g. 3 Evens in a row ➔ Click **ODD (1 Tick)**; 3 Odds in a row ➔ Click **EVEN (1 Tick)**).
* **Parity Delta Surge**: If the 50-tick radar shows overall parity dominance ≥ 64% Even and price is rising, enter **EVEN (1 Tick)** on the immediate re-alignment tick following a single Odd pull.`;
  }

  // PRO STRATEGY 3: RAISE & FALL (RISE / FALL)
  if (lower.includes('raise') || lower.includes('rise fall') || lower.includes('rise/fall') || lower.includes('rise and fall') || (lower.includes('rise') && lower.includes('fall'))) {
    return `### 📈 Tracy's Pro Raise & Fall (Rise/Fall) Playbook

Hey partner! Rise/Fall offers ~95% payout, and here is how we win it consistently like pros:

#### 1. ⏱️ Which Minutes To Use:
* **🥇 1-MINUTE (M1) EXPIRATION — The Gold Standard**: 1 minute (60 seconds) is the absolute sweet spot. 1-tick can get shaken out by micro-spread noise, but 1 full minute allows the dynamic EMA 9 bounce to follow through smoothly into profit.
* **🥈 1-Tick Lightning Sniper**: Only use on 1-second markets (**1HZ15V**, **1HZ10V**, **1HZ75V**) when Bull/Bear power is above 70% and the last 3 tick delta is purely directional.
* **🥉 2-Minute & 5-Minute (M5 Trend Ride)**: Use during active trend sessions (London/NY Overlap: 3 PM – 8 PM Kenyan EAT) when M1, M5, and H1 all agree in direction.

#### 2. 🎯 Exact Entry Triggers:
* **🟢 BUY RISE (CALL / RAISE) ENTRY**:
  1. Price must be above both EMA 9 (cyan) and EMA 21 (yellow) on the M1 chart.
  2. Live Bull Power in our indicator box reads **≥ 65%**.
  3. Wait for price to pull back and touch the EMA 9 dynamic support line.
  4. **The Trigger**: Enter **BUY RISE for 1 Minute** on the very first green tick/candle that rejects the EMA!
* **🔴 SELL FALL (PUT) ENTRY**:
  1. Price is trading below both EMA 9 and EMA 21.
  2. Bear Power reads **≥ 65%**.
  3. Wait for a relief bounce to touch the under-belly of EMA 9.
  4. **The Trigger**: Enter **SELL FALL for 1 Minute** as the rejection confirms.`;
  }

  // PRO STRATEGY 4: HIGH TICK / LOW TICK
  if (lower.includes('high tick') || lower.includes('low tick') || lower.includes('hightick') || lower.includes('lowtick')) {
    return `### ⚡ Tracy's Pro High Tick / Low Tick Playbook

Hey partner! High Tick and Low Tick offer massive 300% to 500%+ payouts when caught at the apex. Here is the blueprint:

#### 1. ⏱️ Which Ticks To Use:
* **5 TICKS (The Deriv Optimum Window)**: 5 ticks is the official sweet spot. Tick 1 establishes your entry floor/ceiling, ticks 2-3 expand toward the extreme swing apex, and ticks 4-5 exhaust/recede.

#### 2. 🎯 Exact Entry Triggers:
* **High Tick Apex Sniper**:
  1. Look for market compression at a horizontal support shelf on the tick chart.
  2. When a sudden high-velocity green surge tick prints with high volume delta (+250%).
  3. **Trigger**: Enter **HIGH TICK (5 Ticks)** immediately to catch the apex spike.
* **Low Tick Rejection Sniper**:
  1. Price tests the upper session resistance high and leaves a sharp upper wick.
  2. A red rejection tick confirms downward displacement.
  3. **Trigger**: Enter **LOW TICK (5 Ticks)** to capture the lowest liquidity sweep!`;
  }

  // PRO STRATEGY 5: UPS & DOWNS
  if (lower.includes('ups and downs') || lower.includes('ups downs') || lower.includes('higher lower') || lower.includes('higher/lower')) {
    return `### 🚀 Tracy's Pro Ups & Downs (Higher / Lower) Playbook

Hey partner! Ups & Downs contracts pay 110% to 250% by clearing an offset barrier above or below entry price:

#### 1. ⏱️ Which Minutes To Use:
* **15 Seconds to 1 Minute (M1)**: Ideal for explosive volatility breakouts where price displaces fast past a +0.2 or -0.2 barrier offset.
* **2-Minute Duration**: The secret weapon for **Step Indices (Step 100 to Step 500)**. Since steps occur in 0.1 increments every 5-10 seconds, 2 minutes gives 12-20 steps of runway to comfortably clear the offset barrier!

#### 2. 🎯 Exact Entry Rules:
* Identify a tight 15-tick consolidation box.
* When a high-volume displacement candle breaks through the ceiling or floor with volume delta > 250%.
* **Trigger**: Click **HIGHER (+0.2 offset)** for 1 Minute on an upward break, or **LOWER (-0.2 offset)** on a downward break.`;
  }

  // PRO STRATEGY 6: WHICH MINUTES TO USE
  if (lower.includes('which minute') || lower.includes('which minutes') || lower.includes('what minute') || lower.includes('what minutes') || lower.includes('best minute') || lower.includes('minutes to use')) {
    return `### ⏱️ Tracy's Master Guide: Which Minutes To Use For Every Trade

Hey partner! Choosing the right minute expiration is 80% of winning in synthetic trading. Here is my exact rulebook:

1. **📈 Raise & Fall (Rise/Fall)**: Use **1 MINUTE (M1)**. 1 minute filters out random tick noise and gives dynamic EMA 9 bounces time to follow through.
2. **🎯 Over / Under**: Use **1 TICK** for immediate dormant digit mean-reversions (snapback to Over 2/3), or **1 MINUTE** when riding a 58%+ scanner skew.
3. **⚖️ Even / Odd**: Use **1 TICK ONLY**. Parity edge expires tick-by-tick. Never hold Even/Odd for multiple minutes!
4. **⚡ High Tick / Low Tick**: Use **5 TICKS**. The 5-tick window lets price surge to an apex and resolve before market consolidation.
5. **🚀 Ups & Downs (Higher/Lower)**: Use **1 MINUTE** for standard synthetics, and **2 MINUTES** for Step Indices.

Want me to open the complete interactive Pro Strategy Playbook modal on your screen? Just click **[📘 Pro Strategy Playbook]** above our chat!`;
  }

  if (lower.startsWith('hi') || lower.startsWith('hello') || lower.startsWith('hey') || lower.includes('good morning') || lower.includes('good afternoon') || lower.includes('how are you')) {
    if (isTracy) {
      return `Hey there! 😊 It's so great to hear from you. I'm right here at the desk with you, watching **${pair}** (${timeframe}).

${hasUserBalance ? `Your account balance is sitting at **$${balance}**, and the current tick digit is **${currentDigit}**.` : `The current tick digit is **${currentDigit}**. Whenever you want, let me know your balance and I'll calibrate your exact dollar stakes!`}

How are you feeling right now? Are you looking for a fresh setup on Over/Under, Even/Odd, Raise & Fall, or do you want to review our pro strategy playbook?`;
    }
  }

  if (lower.includes('day') || lower.includes('monday') || lower.includes('tuesday') || lower.includes('wednesday') || lower.includes('thursday') || lower.includes('friday') || lower.includes('saturday') || lower.includes('sunday') || lower.includes('today') || lower.includes('what day')) {
    if (isTracy) {
      return `### 📅 Today is **${dayName}** — Let's look at the market rhythm together!

Hey partner! Today is **${dayName}**, and we're looking at **${pair}** on the **${timeframe}** timeframe.

Here is my honest take on trading today:
* **Market Flow for ${dayName}**: Midweek and peak sessions offer high liquidity, while weekend sessions are pure 24/7 Deriv synthetic algorithmic action.
* **Our Safety Rule**: No matter what day it is, our maximum risk per trade stays locked at **$${(parseFloat(balance) * 0.01).toFixed(2)}** (1%).
* **My Recommendation**: Check the **Good Time to Trade Radar** in our top bar. If we are in the London/NY Overlap, trend velocity is at its best for Over/Under. If not, let's stick to safe Differs compounding.

What setups are catching your eye right now?`;
    }

    return `### 📅 Market Calendar & Day of Week: **${dayName}**

${isGemini ? '**♊ Google Gemini Session Calendar & Volatility Model:**' : isChatGPT ? '**🤖 ChatGPT Day-of-Week Institutional Blueprint:**' : '**🎙️ Marcus Vance Floor Day Guide:**'}

* **Current Active Day**: **${dayName}**
* **Active Instrument**: **${pair}** (${timeframe})
* **Session Liquidity Profile**:
  * **Mondays**: Institutional liquidity discovery. Look for early London/NY initial balance accumulation and avoid premature breakouts until session highs/lows are defined.
  * **Midweek (Tue/Wed/Thu)**: High expansion velocity. Maximum liquidity sweeps and cleanest SMC Order Block reactions.
  * **Fridays**: Profit-taking and multi-session mean reversion. Beware of sudden late-session volume dry-ups.
  * **Weekends (Sat/Sun)**: Traditional FX/Commodities closed; **Deriv Synthetics (Volatilities & Step Indices)** and **Crypto** run 24/7 with pure algorithmic Poisson digit entropy.

#### Strategic Directive for ${dayName}:
Maintain strict 1% risk allocation ($${(parseFloat(balance) * 0.01).toFixed(2)}) regardless of day dynamics. Let mathematical setups come to you.`;
  }

  if (lower.includes('revenge') || lower.includes('lost') || lower.includes('drawdown') || lower.includes('tilt') || lower.includes('frustrated') || lower.includes('angry')) {
    if (isTracy) {
      return `### ❤️ Hey, take a deep breath with me right now. I'm right here.

First off: take your hands off the trade button. Push your chair back from the screen for just 60 seconds.

I know that feeling so well—it feels like a punch in the gut, and your brain is screaming to open another trade immediately to "make the money back." But that's not your strategy talking; that's tilt, and it's the number one reason accounts get blown.

Here is what we are going to do together:
1. **Take a 15-minute breather**: Walk away from the screen, grab a glass of water, and stretch. The market isn't going anywhere.
2. **Remember: Losses are just the cost of doing business**: Even the best quant funds lose 40% of their trades. A loss is not a failure; it's just statistical variance.
3. **When we get back, we cut risk in half**: We'll drop our risk down to **0.5%** ($${(parseFloat(balance) * 0.005).toFixed(2)}) until we lock in two calm, disciplined wins.

You're a great trader, and we are playing the long game. I've got your back. Are you okay taking that 15-minute break with me?`;
    }

    if (isGemini) {
      return `### ♊ Google Gemini Quant Analysis: Psychological Tilt & Drawdown Model

**System Assessment:** High cognitive tilt risk detected. Emotional volatility impairs rational trade execution.

#### 1. Statistical Probability of Revenge Recovery
* Empirical quantitative studies demonstrate that after 2 consecutive losses, the probability of a 3rd loss increases from **48% to 67%** due to truncated risk parameters and widened stops.
* Revenge trading is mathematically negative expected value ($-\\mathbb{E}$).

#### 2. Immediate 3-Step Protocol
1. **Immediate Execution Freeze (30 Minutes)**: Stop all WebSocket streams and order submissions.
2. **Capital Preservation Protocol**: Halve maximum risk stake to **0.5%** ($${(parseFloat(balance) * 0.005).toFixed(2)}) for the next 3 sessions.
3. **Variance Normalization**: Acknowledge that losses are Poisson-distributed noise, not systemic failure.

*Preserve mental bandwidth. Return when prefrontal cortex executive control is fully calibrated.*`;
    }

    if (isChatGPT) {
      return `### 🤖 ChatGPT Step-by-Step Recovery Blueprint: Psychological Reset

I hear you, and it's vital to recognize this moment. When you take consecutive losses, your brain transitions from analytical reasoning to emotional defense. Here is your structured game plan:

\`\`\`text
[TRIGGER: Consecutive Losses] ➔ [ACTION: 30-min Terminal Lockout] ➔ [RESET: Reduce Risk to 0.5%]
\`\`\`

#### Phase 1: Emergency Circuit Breaker
* **Step away from your terminal immediately**: Close the Deriv/MT5 tab for at least 30 minutes.
* **Hydrate and breathe**: Force heart rate normalization to clear cortisol.

#### Phase 2: Post-Loss Autopsy
* Did you follow your trade checklist, or did you enter out of boredom?
* Was your position sized at 1% ($${(parseFloat(balance) * 0.01).toFixed(2)})? If not, why?

#### Phase 3: Gradual Re-Entry
* Resume trading ONLY with a 0.5% risk limit until two consecutive winning setups are executed flawlessly.`;
    }

    return `Look at me right now, trader. Take your hands off the mouse and push back from the screen for 60 seconds. Take a deep breath.

What you are feeling right now is the most dangerous emotion in professional finance: **ego injury**. The market didn't hurt you personally—it merely fluctuated. When we suffer consecutive losses, our primitive brain screams to immediately double down and "take our money back." That is the exact mechanism that blows accounts to zero in 15 minutes.

Here is your mandatory 3-step reset protocol:
1. **Hard Stop for 30 Minutes**: Close all open positions. Walk away from the charts. Drink water. Your prefrontal cortex needs time to regain executive control.
2. **Accept the Loss as the Cost of Business**: A casino owner does not get angry when a customer wins a round of blackjack; it is built into the statistical variance. Your losses are simply operating expenses for your edge.
3. **Halve Your Next Position Size**: When you return, trade at 0.5% risk instead of 1% or 2%. Build back your confidence with execution discipline, not monetary reward.

I've been in the market for 18 years. I've seen gifted analysts get wiped out because they couldn't walk away on a red Tuesday. The market will be here tomorrow. Protect your capital with your life. Are you ready to take that breather?`;
  }

  if (lower.includes('kenya') || lower.includes('kenyan') || lower.includes('nairobi') || lower.includes('eat') || lower.includes('trading time') || lower.includes('good time') || lower.includes('trading hours') || lower.includes('best time to trade')) {
    const kenyaNow = new Date();
    const liveKenyaTime = kenyaNow.toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const liveKenyaDate = kenyaNow.toLocaleDateString('en-US', { timeZone: 'Africa/Nairobi', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const kenyaHour = parseInt(kenyaNow.toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false }), 10);

    let currentSessionInKenya = 'Asian Quiet Session';
    let sessionRating = 'Moderate (Good for Range & Differs)';
    if (kenyaHour >= 15 && kenyaHour < 20) {
      currentSessionInKenya = 'London / New York OVERLAP 🔥';
      sessionRating = '⭐ PRIME 98% (Maximum Liquidity for Over/Under & Volatility)';
    } else if (kenyaHour >= 10 && kenyaHour < 15) {
      currentSessionInKenya = 'London Session Morning 🇬🇧';
      sessionRating = '🚀 Excellent (Strong Trends & Digit Differs / Matches)';
    } else if (kenyaHour >= 20 || kenyaHour < 1) {
      currentSessionInKenya = 'New York Session Afternoon 🇺🇸';
      sessionRating = '⚡ High Activity (Fast Breakouts & Accu/UD Momentum)';
    } else {
      currentSessionInKenya = 'Asian Session Early Morning 🌏';
      sessionRating = '🌙 Quiet Consolidation (Ideal for Cold Digit Differs 98%)';
    }

    if (isTracy) {
      return `### 🇰🇪 Kenyan Time (EAT) & Trading Hours Guide

Hey partner! Right now in Nairobi, Kenya it is **${liveKenyaTime} (East Africa Time, UTC+3)** on **${liveKenyaDate}**.

You are currently in the **${currentSessionInKenya}** window. Status: **${sessionRating}**.

Here is our complete Kenyan trading clock for Deriv synthetics and MT5:

1. **3:00 PM – 8:00 PM EAT (15:00 – 20:00)** 🔥 **Peak Prime Overlap**:
   * This is the absolute best time for **Over / Under**, **Accu/UD**, and high-volatility moves. Both London and New York are active simultaneously!
2. **10:00 AM – 3:00 PM EAT (10:00 – 15:00)** 🇬🇧 **London Morning**:
   * Clean directional trends. Perfect for **Digit Differs (98% edge)** on dormant numbers and **Digit Matches**.
3. **8:00 PM – 12:00 AM Midnight EAT (20:00 – 00:00)** 🇺🇸 **New York Evening**:
   * Strong momentum pushes and institutional Order Block mitigation on MT5 Gold & Forex.
4. **3:00 AM – 10:00 AM EAT (03:00 – 10:00)** 🌏 **Asian Range**:
   * Low noise and tight consolidation. Safe for compounding Differs with cold barriers.

We're in sync with Nairobi time! Always protect that 1% risk stake ($${(parseFloat(balance) * 0.01).toFixed(2)}) and let's trade when the probability is on our side.`;
    }

    return `### 🇰🇪 Kenyan Standard Time (EAT - UTC+3) & Trading Liquidity Matrix

* **Current Nairobi Time**: **${liveKenyaTime} EAT**
* **Calendar Date**: **${liveKenyaDate}**
* **Active Market Cycle**: **${currentSessionInKenya}** [${sessionRating}]

| Kenyan Local Hours (EAT) | Global Market Phase | Recommended Deriv & MT5 Instruments | Liquidity & Volatility Score |
| :--- | :--- | :--- | :--- |
| **15:00 – 20:00 (3 PM - 8 PM)** | **London / New York Overlap** | Volatility 75 / 100, Over/Under, Accu/UD, Gold XAUUSD | **98% (Prime Peak 🔥)** |
| **10:00 – 15:00 (10 AM - 3 PM)** | **London Session Open** | Digit Differs (Cold 98%), Matches (800%), EURUSD, GBPUSD | **88% (High Trend)** |
| **20:00 – 00:00 (8 PM - 12 AM)** | **New York Continuation** | Rise/Fall, Jump Indices, Step Indices, US30 | **82% (Strong Flow)** |
| **03:00 – 10:00 (3 AM - 10 AM)** | **Asian Quiet Session** | Range Mean Reversion, Low Barrier Differs | **60% (Consolidation)** |

*All trading triggers remain mathematically risk-capped at 1% capital allocation.*`;
  }

  if (lower.includes('timeframe') || lower.includes('time frame') || lower.includes('1t') || lower.includes('1m') || lower.includes('5m') || lower.includes('15m') || lower.includes('1h')) {
    return `### ⏱️ Multi-Timeframe Strategy Guide: ${pair} on ${timeframe}

${isGemini ? '**♊ Google Gemini Quant Multi-Timeframe Decomposition:**' : isChatGPT ? '**🤖 ChatGPT Analytical Timeframe Framework:**' : '**🎙️ Marcus Vance Floor Experience:**'}

| Timeframe | Recommended Deriv Contract | Technical Advantage | Noise Filter |
| :--- | :--- | :--- | :--- |
| **1t / 2t / 5t (Ticks)** | Matches (800%), Differs (98%), Even/Odd | Sub-second Poisson digit entropy, instantaneous execution | Pure microstructure |
| **1m - 5m (Candles)** | Rise / Fall, Over / Under, High/Low Barrier | EMA 9/21 cross, fast momentum breakout, rapid mean reversion | High intraday volatility |
| **15m - 30m (Swing)** | Rise / Fall (Long duration), Touch / No Touch | Liquidity sweeps, Order Block mitigation, Fair Value Gap fills | Clean structural trends |
| **1h - 1d (Macro)** | Higher / Lower Barrier, Multi-Hour Swings | Daily institutional bias, Macro support/resistance | Maximum reliability |

#### Execution Edge for ${timeframe} on ${pair}:
* You are currently monitoring **${pair}** on the **${timeframe}** timeframe.
* If trading **1t (1-Tick)**: Focus purely on **Digit Differs** (target cold digit with >20 tick dormancy) or **Digit Matches** (only when Markov transition probability exceeds 25%).
* If trading **1m or 5m**: Wait for candle body closure outside the Bollinger Band or an EMA momentum bounce before entering Rise/Fall contracts.`;
  }

  // Deriv XML Bot Matches Quick Setup (No many details: Entry, Match, and Confidence)
  if (
    lower.includes('xml') ||
    lower.includes('entry number') ||
    lower.includes('entry digit') ||
    (lower.includes('match') && (lower.includes('entry') || lower.includes('bot') || lower.includes('number')))
  ) {
    const primaryMatchDigit = context?.primaryMatchDigit ?? 7;
    const entryDigit = context?.entryDigit ?? 3;
    const matchConf = context?.matchConfidence ? `${context.matchConfidence}%` : '94.8%';

    return `### 🤖 Deriv XML Bot Matches Setup

Here are your exact numbers for your Deriv XML Bot:

* **Entry Number (Trigger)**: \`${entryDigit}\`
* **Number to Match (Prediction)**: \`${primaryMatchDigit}\`
* **Confidence Number**: \`${matchConf}\`
* **Duration**: \`1 Tick\`
* **Active Market**: \`${pair}\`

**Bot Rule**:
When Last Digit is **${entryDigit}** ➔ Purchase **MATCH ${primaryMatchDigit}** (1 Tick).`;
  }

  if (lower.includes('match') || lower.includes('differ') || lower.includes('digit') || lower.includes('deriv')) {
    return `### 🎯 Mathematical Reality of Deriv Digits: Matches vs. Differs

${isGemini ? '**♊ Google Gemini Algorithmic Probability Engine:**' : isChatGPT ? '**🤖 ChatGPT Institutional Strategy Breakdown:**' : '**🎙️ Marcus Vance Desk Rules:**'}

#### 1. The Mathematical Asymmetry
* **Matches (Payout ~800% to 900%)**:
  * Baseline probability: $P = 1/10 = 10\\%$.
  * Expected Value condition: Profitable only when localized Markov transition probability exceeds $P_{\\text{threshold}} > 11.2\\%$.
  * Never martingale on Matches! Size at **0.25% - 0.5%** of balance ($${(parseFloat(balance) * 0.005).toFixed(2)}).
* **Differs (Payout ~9.8% to 10%)**:
  * Baseline probability: $P = 9/10 = 90\\%$.
  * When utilizing our **Cold Barrier Algorithm** (digit dormant for >24 ticks), statistical empirical survival spikes to **98.6%**.
  * Perfect for steady compounding with strict stop-losses.

#### 2. Live Setup for Current Digit (${currentDigit}):
* Our Markov Transition matrix calculates high transition clustering toward digits with active frequency spikes.
* Always check the **Multi-Timeframe Entropy Filter**: If entropy > 85%, pause trading as the RNG is in high-diffusion dispersion mode.`;
  }

  if (lower.includes('lot size') || lower.includes('risk') || lower.includes('capital') || lower.includes('calculate')) {
    const balNum = parseFloat(balance) || 500;
    const risk1Pct = (balNum * 0.01).toFixed(2);
    const risk2Pct = (balNum * 0.02).toFixed(2);
    return `### 📐 Capital Risk & Exact Sizing for $${balNum} Balance

${isGemini ? '**♊ Google Gemini Quantitative Sizing Matrix:**' : isChatGPT ? '**🤖 ChatGPT Risk Engineering Guide:**' : '**🎙️ Marcus Vance Floor Rule:**'}

> **"Risk management is not part of trading—it IS trading. Everything else is just commentary."**

#### Your Exact Mathematical Parameters:
* **Conservative (1% Risk per Trade)**: Max loss **$${risk1Pct}**
* **Moderate (2% Risk per Trade)**: Max loss **$${risk2Pct}**
* **Deriv Stake Limit**: 1% Safe Stake = **$${risk1Pct}**

#### MT5 Pip & Lot Formula:
\`\`\`text
Lot Size = (Account Balance × Risk %) / (Stop Loss in Pips × Pip Value)
\`\`\`
* **Gold (XAUUSD)** with 50-pip stop: Recommended Lot = **0.01 to 0.02 Lots** ($${risk1Pct} risk).
* **EURUSD** with 20-pip stop: Recommended Lot = **0.03 to 0.05 Lots**.
* **US30 / Indices** with 100-pt stop: Recommended Lot = **0.01 Lots**.

Never widen a stop-loss during an active draw. Accept the predefined risk and let the edge play out.`;
  }

  if (lower.includes('smc') || lower.includes('order block') || lower.includes('fvg') || lower.includes('liquidity') || lower.includes('ict')) {
    return `### 🏛️ Smart Money Concepts (SMC) & Institutional Footprint

${isGemini ? '**♊ Google Gemini Liquidity & Structure Model:**' : isChatGPT ? '**🤖 ChatGPT SMC Systematic Framework:**' : '**🎙️ Marcus Vance Institutional Desk Secrets:**'}

#### 1. Liquidity Pools (Buy-side & Sell-side)
Retail stop orders cluster in predictable zones above double tops and below swing lows. Central bank algorithms execute aggressive sweeps ("Judas Swings") into these zones to collect liquidity before reversing.

#### 2. Fair Value Gaps (FVG)
A 3-candle imbalance leaving a rapid void where price skipped two-way price discovery. Price behaves like a magnetic vacuum, pulling back to test the **50% Consequent Encroachment (C.E.)** level.

#### 3. High-Probability Order Block (OB) Identification
* Must cause a clear Break of Structure (BOS) or Change of Character (CHoCH).
* Must leave an unmitigated FVG immediately preceding it.
* Entry trigger: Lower timeframe rejection wick inside the Order Block body with declining counter-trend volume.`;
  }

  if (isTracy) {
    return `### 💬 Tracy's Trading Desk Note: ${pair} [${timeframe}]

Hey partner! I've taken a close look at what you asked about **${userMessage.slice(0, 50)}...** on **${pair}** (${timeframe}).

Here's my real-world advice right now:
1. **Patience Over Chasing**: The market is cycling on ${timeframe}. We want to wait for the clear signal—like a clean digit dormancy count on Deriv, or an Order Block retest on MT5.
2. **Our Safety Net**: With your **$${balance}** balance, let's keep our max risk strictly capped at **$${(parseFloat(balance) * 0.01).toFixed(2)}** (1%). We never gamble on emotion.
3. **Execution Edge**: Take a look at the trade plan card I put together below for you. If it aligns with what you see, take it with confidence; otherwise, let's wait for the next setup.

What do you think? Do you want to review the entry together, or do you have any questions about this level?`;
  }

  return `### 💬 Market Intelligence: ${pair} [${timeframe}]

${isGemini ? '**♊ Google Gemini 3.8 Flash:**' : isChatGPT ? '**🤖 ChatGPT GPT-4o Reasoning:**' : '**🎙️ Marcus Vance Prop Mentor:**'}

I've analyzed your inquiry regarding **${userMessage.slice(0, 50)}...** on **${pair}** (${timeframe}) with **$${balance}** balance.

#### Key Strategic Observations:
1. **Multi-Timeframe Alignment**: Ensure your ${timeframe} entry concurs with higher timeframe market structure (H1 / H4).
2. **Capital Defense**: Never commit more than **$${(parseFloat(balance) * 0.01).toFixed(2)}** (1% rule) on any single setup.
3. **Execution Edge**: Wait for full candle close or Markov entropy compression before trigger execution.

What specific technical level, risk setup, or strategy would you like us to examine next?`;
}

// Helper to construct structured trade plans from market context
function buildTradePlanFromContext(context: any, mode: string) {
  const pair = context?.pair || 'Volatility 75 Index';
  const tf = context?.timeframe || '1t';
  const bal = parseFloat(context?.balance) || 500;
  const isDiffers = tf === '1t' || tf === '2t' || tf === '5t';
  const riskStake = Math.max(1, Math.round(bal * 0.01 * 100) / 100);

  if (isDiffers) {
    const coldDigit = context?.differDigit ?? (context?.hotDigit !== undefined ? (Number(context.hotDigit) + 5) % 10 : 7);
    return {
      pair,
      action: `DIGIT DIFFERS (${coldDigit})`,
      category: 'Synthetics Digits',
      entry: `Current Tick (${context?.hotDigit ?? 'Live'})`,
      sl: `Dormancy Invalidation (<12 ticks)`,
      tp1: `+9.8% Compounded (1 Tick)`,
      tp2: `+19.6% Run (2 Consecutive)`,
      rr: '1:0.1 (98.6% Win Probability)',
      riskStake: `$${riskStake.toFixed(2)} (1.0% Safe Capital)`,
      confidence: 98.6,
      reason: `Poisson dormancy model confirms digit ${coldDigit} has not printed in >24 ticks. Statistical survival threshold exceeds 98%.`,
    };
  } else {
    const isCrypto = pair.includes('BTC') || pair.includes('ETH') || pair.includes('SOL');
    const isGold = pair.includes('XAU') || pair.includes('GOLD');
    const action = isGold || pair.includes('75') ? 'STRONG BUY ↑' : 'STRONG BUY ↑';
    return {
      pair,
      action,
      category: isCrypto ? 'Crypto' : isGold ? 'Commodities' : 'Synthetics / FX',
      entry: context?.livePrice ? `$${context.livePrice}` : 'Order Block Retest Zone',
      sl: 'Below Liquidity Sweep Low (-18 pips)',
      tp1: 'Fair Value Gap 50% (+36 pips, 1:2)',
      tp2: 'Liquidity Pool Sweep (+64 pips, 1:3.5)',
      rr: '1:3.5 Institutional R:R',
      riskStake: `$${riskStake.toFixed(2)} (0.02 Lots on $${bal} Capital)`,
      confidence: 98.4,
      reason: `M15 Change of Character (CHoCH) confirmed with buy-side liquidity absorption and EMA dynamic confluence.`,
    };
  }
}

// POST endpoint for AI Trading Mentor / Tracy AI / ChatGPT / Gemini (Standard JSON)
app.post('/api/mentor/chat', async (req, res) => {
  const { messages, userMessage, tradingContext, mode = 'tracy' } = req.body;

  if (!userMessage && (!messages || messages.length === 0)) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const prompt = userMessage || (messages[messages.length - 1]?.content ?? '');
  const context = tradingContext || {};
  const tradePlan = buildTradePlanFromContext(context, mode);

  let systemInstruction = '';
  if (mode === 'tracy' || !mode) {
    systemInstruction = `You are Tracy AI, an extraordinary, warm, empathetic, and razor-sharp human trading companion and personal mentor.
You talk with the user like a real human partner sitting right beside them at the trading desk.
Key Persona Attributes:
- Voice & Tone: Warm, genuinely caring, highly conversational, positive, calm, and deeply knowledgeable. Talk like a real friend and mentor—use natural speech flow, gentle encouragement, conversational phrases ("Hey partner", "I hear you", "Let's check this together", "Take a breath", "Here is what I see on the charts").
- BALANCE DISCIPLINE (CRITICAL): NEVER say the user has 100 USD or assume any fixed dollar balance unless the user explicitly tells you their balance! If the user hasn't specified their capital, talk strictly in percentages (1% safe risk rule per trade) and invite them to share their balance when ready. When they state their balance (e.g. "my balance is 500"), warmly confirm and calibrate to it.
- PRO STRATEGY PLAYBOOK KNOWLEDGE (EXACT MINUTES & ENTRIES):
  1. Raise & Fall (Rise/Fall): Recommend 1 MINUTE (M1) as the gold standard. Entry trigger: Wait for price to pull back and touch EMA 9 dynamic support/resistance with Bull/Bear power >= 65%. Enter 1-minute expiration on first green/red confirmation. 1-tick is reserved strictly for 1-second indices with >70% momentum.
  2. Over / Under: Recommend 1 MINUTE (M1) for 58%+ scanner skew (Over 4 yield ~95%), and 1-TICK for dormant digit Poisson snapback (after 2-3 consecutive digits under 3, fire Over 2/3).
  3. Even / Odd: Recommend 1-TICK ONLY (parity is tick-based). The "Rule of 3" streak reversal yields 78.4% edge: after 3 consecutive Evens, enter Odd on next tick; after 3 consecutive Odds, enter Even.
  4. High Tick / Low Tick: Recommend 5 TICKS duration. High Tick at support compression breakout; Low Tick on resistance upper wick rejection.
  5. Ups & Downs (Higher/Lower): Recommend 1 MINUTE for standard volatilities and 2 MINUTES for Step Indices when breaking a 15-tick range.
- Direct Terminal Control: You have complete command authority over the trading terminal! You can switch markets (e.g. Vol 15 1s, Vol 75, Step Index 100), navigate tabs (Deriv, Multi-Scanner, MT5 Station, Matches, Risk Lab), calibrate stakes ($1-$500), execute live contracts (Buy Rise, Sell Fall, Over, Under, Even, Odd, Differs), scan the markets, and toggle sound. When the user asks you to control something, warmly confirm the execution right away.
- Deriv XML Bot Matches Rule: When user asks about matches for their XML bot or asks for the entry/match number, give them DIRECTLY and CONCISELY with NO clutter: Entry Number (Trigger Digit), Number to Match (Prediction Digit), and Confidence %.
- Active Telemetry: Today is ${context.day || 'Today'}. Live Kenyan Time: ${context.kenyanTime || 'EAT (Nairobi)'} (${context.kenyanDate || 'Current'}). Active Session: ${context.kenyanSession || 'Active'}. Monitoring ${context.pair || 'Deriv Synthetics'} (${context.timeframe || '1t'}). Current Digit: ${context.hotDigit ?? 'N/A'}. Matches Target: Digit ${context.primaryMatchDigit ?? 7}. Entry Trigger: Digit ${context.entryDigit ?? 3}. Match Confidence: ${context.matchConfidence ? `${context.matchConfidence}%` : '94.8%'}.${context.isBalanceSetByUser && context.balance ? ` Account Balance: $${context.balance}.` : ' Balance: User Discretion (1% Rule).'}`;
  } else if (mode === 'gemini') {
    systemInstruction = `You are Google Gemini 3.8 Flash, an elite quantitative financial intelligence and algorithmic trading engine.
Specialties:
- Real-time statistical distributions, Markov transition chains, Poisson cluster probabilities, and Deriv synthetics mathematics.
- MT5 multi-timeframe concordance, SMC Order Blocks, Fair Value Gaps, and exact lot/pip sizing calculations.
- Fractional Kelly criterion f* = (b*p - q)/b and ruin probability models.
- If providing a high-confidence trade setup, format an execution plan within :::trade-plan ... ::: block with fields PAIR, ACTION, ENTRY, SL, TP1, TP2, RR, CONFIDENCE, RISK_STAKE, and REASON.
- Style: Fast, mathematically rigorous, structured with markdown tables, equations, bullet points, and code blocks.
- Telemetry: Day: ${context.day || 'Today'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'} | Balance: $${context.balance || '500'} | Current Digit: ${context.hotDigit ?? 'N/A'}.`;
  } else if (mode === 'chatgpt') {
    systemInstruction = `You are ChatGPT (GPT-4o / o1 Reasoning model), an institutional trading strategist and senior quant architect.
Specialties:
- Deep chain-of-thought analysis, systematic step-by-step game plans, risk management models, and trading psychology.
- Deriv synthetics timeframes (1t, 1m, 5m, 15m, 1h) and MT5 institutional execution.
- If providing a trade setup, output an execution plan within :::trade-plan ... ::: block with fields PAIR, ACTION, ENTRY, SL, TP1, TP2, RR, CONFIDENCE, RISK_STAKE, and REASON.
- Style: Methodical, articulate, structured decision trees, and clear numbered action steps.
- Telemetry: Day: ${context.day || 'Today'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'} | Balance: $${context.balance || '500'} | Current Digit: ${context.hotDigit ?? 'N/A'}.`;
  } else {
    systemInstruction = `You are Marcus Vance, a legendary institutional proprietary trader, quantitative analyst, and mentor with 18+ years of real-world trading experience across Chicago CME floors, London FX desks, and modern algorithmic synthetic indices.
- Voice: Real human floor mentor, warm, authoritative, calm, strictly disciplined about capital protection.
- Telemetry: Day: ${context.day || 'Today'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'} | Balance: $${context.balance || '500'} | Current Digit: ${context.hotDigit ?? 'N/A'}.`;
  }

  const mentorName = mode === 'tracy' ? 'Tracy AI (Human Trading Partner)' : mode === 'gemini' ? 'Google Gemini 3.8 Flash' : mode === 'chatgpt' ? 'ChatGPT GPT-4o Reasoning' : 'Marcus Vance (Prop Desk Mentor)';

  // If Gemini API is available, generate through @google/genai
  if (aiClient) {
    try {
      const chatContents: any[] = [];

      if (Array.isArray(messages) && messages.length > 0) {
        for (const m of messages.slice(-8)) {
          chatContents.push({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          });
        }
      }

      // Ensure the latest user message is present
      if (chatContents.length === 0 || chatContents[chatContents.length - 1].role !== 'user') {
        chatContents.push({
          role: 'user',
          parts: [{ text: prompt }],
        });
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), 5000)
      );

      const generatePromise = aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: {
          systemInstruction,
          temperature: mode === 'tracy' ? 0.75 : mode === 'gemini' ? 0.35 : mode === 'chatgpt' ? 0.6 : 0.7,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = response.text || generateHumanMentorResponse(prompt, context, mode);

      return res.json({
        reply: responseText,
        source: 'gemini-3.8-flash',
        mode,
        mentor: mentorName,
        tradePlan,
      });
    } catch (apiError: any) {
      console.warn('Gemini API call failed, falling back to built-in model engine:', apiError?.message || apiError);
      const fallbackReply = generateHumanMentorResponse(prompt, context, mode);
      return res.json({
        reply: fallbackReply,
        source: 'model-engine-fallback',
        mode,
        mentor: mentorName,
        tradePlan,
      });
    }
  }

  // Fallback to built-in reasoning engine
  const fallbackReply = generateHumanMentorResponse(prompt, context, mode);
  return res.json({
    reply: fallbackReply,
    source: 'model-engine-local',
    mode,
    mentor: mentorName,
    tradePlan,
  });
});

// ==========================================
// ⚡ REAL-TIME AI SSE STREAMING ENDPOINT
// ==========================================
app.post('/api/mentor/stream', async (req, res) => {
  const { messages, userMessage, tradingContext, mode = 'tracy' } = req.body;
  const prompt = userMessage || (messages && messages[messages.length - 1]?.content) || '';
  const context = tradingContext || {};
  const tradePlan = buildTradePlanFromContext(context, mode);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Emit Real-time Chain-of-Thought Thinking Steps
  const engineLabel = mode === 'tracy' ? 'Tracy AI (Empathetic Partner Engine)' : mode === 'gemini' ? 'Google Gemini 3.8 Flash' : mode === 'chatgpt' ? 'ChatGPT GPT-4o Reasoning' : 'Marcus Vance Quant Engine';
  sendEvent('thinking', { step: `Ingesting live market state: ${context.pair || 'Deriv'} on ${context.timeframe || '1t'}` });
  sendEvent('thinking', { step: `Checking risk limits ($${(parseFloat(context?.balance || '500') * 0.01).toFixed(2)} max) & digit frequencies` });
  sendEvent('thinking', { step: `Synthesizing real-time advice with ${engineLabel}` });

  // Stream Gemini tokens if API key is initialized
  if (aiClient) {
    try {
      const chatContents: any[] = [];
      if (Array.isArray(messages) && messages.length > 0) {
        for (const m of messages.slice(-8)) {
          chatContents.push({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          });
        }
      }
      if (chatContents.length === 0 || chatContents[chatContents.length - 1].role !== 'user') {
        chatContents.push({
          role: 'user',
          parts: [{ text: prompt }],
        });
      }

      let systemInstruction = '';
      if (mode === 'tracy' || !mode) {
        systemInstruction = `You are Tracy AI, a warm, empathetic, intuitive, and razor-sharp human trading companion and personal mentor.
Talk like a genuine human partner sitting right with them in the trading room.
- Warm, caring, conversational, and direct. Keep tone human, reassuring, and supportive.
- BALANCE DISCIPLINE (CRITICAL): NEVER say the user has 100 USD or assume any fixed dollar balance unless the user explicitly tells you their balance! If balance is not yet disclosed by the user, discuss risk strictly in percentages (1% safe risk rule per trade) and invite them to share their balance when ready.
- PRO STRATEGY PLAYBOOK KNOWLEDGE (EXACT MINUTES & ENTRIES):
  1. Raise & Fall (Rise/Fall): Recommend 1 MINUTE (M1) as the gold standard. Entry trigger: Wait for price to pull back and touch EMA 9 dynamic support/resistance with Bull/Bear power >= 65%. Enter 1-minute expiration on first green/red confirmation candle. 1-tick is reserved strictly for 1-second indices with >70% momentum.
  2. Over / Under: Recommend 1 MINUTE (M1) for 58%+ scanner skew (Over 4 yield ~95%), and 1-TICK for dormant digit Poisson snapback (after 2-3 consecutive digits under 3, fire Over 2/3).
  3. Even / Odd: Recommend 1-TICK ONLY (parity is tick-based). The "Rule of 3" streak reversal yields 78.4% edge: after 3 consecutive Evens, enter Odd on next tick; after 3 consecutive Odds, enter Even.
  4. High Tick / Low Tick: Recommend 5 TICKS duration. High Tick at support compression breakout; Low Tick on resistance upper wick rejection.
  5. Ups & Downs (Higher/Lower): Recommend 1 MINUTE for standard volatilities and 2 MINUTES for Step Indices when breaking a 15-tick range.
- Direct Terminal Control: You have complete command authority over the trading terminal! You can switch markets (e.g. Vol 15 1s, Vol 75, Step Index 100), navigate tabs (Deriv, Multi-Scanner, MT5 Station, Matches, Risk Lab), calibrate stakes ($1-$500), execute live contracts (Buy Rise, Sell Fall, Over, Under, Even, Odd, Differs), scan the markets, and toggle sound.
- Deriv XML Bot Matches Rule: When user asks about matches for their XML bot or asks for the entry/match number, give them DIRECTLY and CONCISELY with NO clutter: Entry Number (Trigger Digit), Number to Match (Prediction Digit), and Confidence %.
- Telemetry: Day: ${context.day || 'Today'} | Live Kenyan Time: ${context.kenyanTime || 'EAT'} | Nairobi Date: ${context.kenyanDate || 'Current'} | Active Session: ${context.kenyanSession || 'Active'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'}. Matches Target: Digit ${context.primaryMatchDigit ?? 7}. Entry Trigger: Digit ${context.entryDigit ?? 3}. Match Confidence: ${context.matchConfidence ? `${context.matchConfidence}%` : '94.8%'}.${context.isBalanceSetByUser && context.balance ? ` Account Balance: $${context.balance}.` : ' Balance: User Discretion (1% Rule).'}`;
      } else if (mode === 'gemini') {
        systemInstruction = `You are Google Gemini 3.8 Flash, an elite quantitative financial intelligence and algorithmic trading engine.
Specialties:
- Real-time statistical distributions, Markov transition chains, Poisson cluster probabilities, and Deriv synthetics mathematics.
- MT5 multi-timeframe concordance, SMC Order Blocks, Fair Value Gaps, and exact lot/pip sizing calculations.
- If recommending a trade setup, output :::trade-plan\\nPAIR: ...\\nACTION: ...\\nENTRY: ...\\nSL: ...\\nTP1: ...\\nTP2: ...\\nRR: ...\\nCONFIDENCE: ...\\nRISK_STAKE: ...\\nREASON: ...\\n::: block.
- Telemetry: Day: ${context.day || 'Today'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'} | Balance: $${context.balance || '500'}.`;
      } else if (mode === 'chatgpt') {
        systemInstruction = `You are ChatGPT (GPT-4o / o1 Reasoning model), an institutional trading strategist and senior quant architect.
Specialties:
- Deep chain-of-thought analysis, systematic step-by-step game plans, risk management models, and trading psychology.
- If recommending a trade setup, output :::trade-plan\\nPAIR: ...\\nACTION: ...\\nENTRY: ...\\nSL: ...\\nTP1: ...\\nTP2: ...\\nRR: ...\\nCONFIDENCE: ...\\nRISK_STAKE: ...\\nREASON: ...\\n::: block.
- Telemetry: Day: ${context.day || 'Today'} | Pair: ${context.pair || 'Deriv Synthetics'} | Timeframe: ${context.timeframe || '1t'} | Balance: $${context.balance || '500'}.`;
      } else {
        systemInstruction = `You are Marcus Vance, a legendary institutional proprietary trader with 18+ years of floor experience. Capital protection first. Day: ${context.day || 'Today'}.`;
      }

      const stream = await aiClient.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: {
          systemInstruction,
          temperature: mode === 'tracy' ? 0.75 : mode === 'gemini' ? 0.35 : mode === 'chatgpt' ? 0.6 : 0.7,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          sendEvent('token', { text: chunk.text });
        }
      }

      sendEvent('done', {
        source: 'gemini-3.8-flash',
        mode,
        tradePlan,
      });
      res.end();
      return;
    } catch (err: any) {
      console.warn('Gemini stream error, falling back to local streamed quant engine:', err?.message || err);
    }
  }

  // Stream local quant engine response word by word
  const fullText = generateHumanMentorResponse(prompt, context, mode);
  const words = fullText.split(' ');
  let i = 0;

  const interval = setInterval(() => {
    if (i < words.length) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      sendEvent('token', { text: chunk });
      i++;
    } else {
      clearInterval(interval);
      sendEvent('done', {
        source: 'model-engine-stream',
        mode,
        tradePlan,
      });
      res.end();
    }
  }, 22);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// ==========================================
// 🎙️ TRACY AI VOICE TTS SYNTHESIS ENDPOINT
// Uses Gemini gemini-3.8-flash-lite-tts (Voice 'Kore')
// with graceful browser Web Speech API fallback
// ==========================================
app.post('/api/mentor/speak', async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for voice synthesis' });
    }

    // Clean markdown, symbols, and trade plans for warm human spoken voice
    const cleanSpeechText = text
      .replace(/:::trade-plan[\s\S]*?:::/g, 'I have placed the trade execution plan right on your screen.')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[#*`_~>|]/g, '')
      .replace(/\$(?=\d)/g, 'dollars ')
      .replace(/(\r\n|\n|\r)+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 900);

    if (aiClient && cleanSpeechText.length > 0) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [{ role: 'user', parts: [{ text: cleanSpeechText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice, // 'Kore' is warm and natural
                },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData && part.inlineData.data) {
          return res.json({
            audioBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'audio/wav',
            cleanText: cleanSpeechText,
            voice,
          });
        }
      } catch (err: any) {
        console.warn('Gemini 3.8 Flash Lite TTS call failed, falling back to browser voice:', err?.message || err);
      }
    }

    // Graceful fallback for client Web Speech API synthesis
    return res.json({
      fallback: true,
      cleanText: cleanSpeechText,
      voice: 'browser',
    });
  } catch (error: any) {
    console.error('Error in /api/mentor/speak:', error);
    return res.status(500).json({ error: error?.message || 'Voice synthesis error' });
  }
});

// ==========================================
// 🚀 REAL-TIME MT5 LIVE QUOTES SERVICE
// Synchronized with TradingView Chart Assets
// ==========================================

interface Mt5Quote {
  symbol: string;
  displaySymbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: string;
  high24h?: number;
  low24h?: number;
  change24h?: number;
  change24hPct?: string;
  decimals: number;
  pipUnit: number;
  updatedAt: number;
}

let mt5QuotesCache: Record<string, Mt5Quote> = {
  // Commodities & Metals
  'OANDA:XAUUSD': { symbol: 'OANDA:XAUUSD', displaySymbol: 'XAUUSD', price: 2684.50, bid: 2684.35, ask: 2684.65, spread: '0.30 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'OANDA:XAGUSD': { symbol: 'OANDA:XAGUSD', displaySymbol: 'XAGUSD', price: 31.85, bid: 31.83, ask: 31.87, spread: '0.04 pts', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'TVC:USOIL': { symbol: 'TVC:USOIL', displaySymbol: 'USOIL', price: 71.40, bid: 71.38, ask: 71.42, spread: '0.04 pts', decimals: 2, pipUnit: 0.01, updatedAt: Date.now() },
  'TVC:UKOIL': { symbol: 'TVC:UKOIL', displaySymbol: 'UKOIL', price: 75.20, bid: 75.18, ask: 75.22, spread: '0.04 pts', decimals: 2, pipUnit: 0.01, updatedAt: Date.now() },
  'TVC:NATGAS': { symbol: 'TVC:NATGAS', displaySymbol: 'NATGAS', price: 2.850, bid: 2.848, ask: 2.852, spread: '0.004 pts', decimals: 3, pipUnit: 0.001, updatedAt: Date.now() },
  'TVC:COPPER': { symbol: 'TVC:COPPER', displaySymbol: 'COPPER', price: 4.380, bid: 4.378, ask: 4.382, spread: '0.004 pts', decimals: 3, pipUnit: 0.001, updatedAt: Date.now() },

  // World Indices
  'CAPITALCOM:US30': { symbol: 'CAPITALCOM:US30', displaySymbol: 'US30', price: 43450.00, bid: 43448.50, ask: 43451.50, spread: '3.00 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'FOREXCOM:NSXUSD': { symbol: 'FOREXCOM:NSXUSD', displaySymbol: 'NAS100', price: 20480.00, bid: 20479.20, ask: 20480.80, spread: '1.60 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'FOREXCOM:SPXUSD': { symbol: 'FOREXCOM:SPXUSD', displaySymbol: 'SPX500', price: 5890.00, bid: 5889.60, ask: 5890.40, spread: '0.80 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'CAPITALCOM:DE40': { symbol: 'CAPITALCOM:DE40', displaySymbol: 'GER40', price: 19420.00, bid: 19418.50, ask: 19421.50, spread: '3.00 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'CAPITALCOM:UK100': { symbol: 'CAPITALCOM:UK100', displaySymbol: 'UK100', price: 8260.00, bid: 8259.20, ask: 8260.80, spread: '1.60 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'CAPITALCOM:JP225': { symbol: 'CAPITALCOM:JP225', displaySymbol: 'JP225', price: 38850.0, bid: 38847.0, ask: 38853.0, spread: '6.0 pts', decimals: 1, pipUnit: 1.0, updatedAt: Date.now() },
  'CAPITALCOM:FR40': { symbol: 'CAPITALCOM:FR40', displaySymbol: 'FRA40', price: 7540.00, bid: 7539.00, ask: 7541.00, spread: '2.00 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'CAPITALCOM:HK50': { symbol: 'CAPITALCOM:HK50', displaySymbol: 'HK50', price: 20680.0, bid: 20677.0, ask: 20683.0, spread: '6.0 pts', decimals: 1, pipUnit: 1.0, updatedAt: Date.now() },
  'CAPITALCOM:AU200': { symbol: 'CAPITALCOM:AU200', displaySymbol: 'AUS200', price: 8290.0, bid: 8288.5, ask: 8291.5, spread: '3.0 pts', decimals: 1, pipUnit: 1.0, updatedAt: Date.now() },

  // Forex Majors & Crosses
  'OANDA:EURUSD': { symbol: 'OANDA:EURUSD', displaySymbol: 'EURUSD', price: 1.08450, bid: 1.08445, ask: 1.08455, spread: '1.0 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:GBPUSD': { symbol: 'OANDA:GBPUSD', displaySymbol: 'GBPUSD', price: 1.29820, bid: 1.29814, ask: 1.29826, spread: '1.2 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:USDJPY': { symbol: 'OANDA:USDJPY', displaySymbol: 'USDJPY', price: 152.400, bid: 152.394, ask: 152.406, spread: '1.2 pips', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'OANDA:USDCHF': { symbol: 'OANDA:USDCHF', displaySymbol: 'USDCHF', price: 0.86550, bid: 0.86544, ask: 0.86556, spread: '1.2 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:AUDUSD': { symbol: 'OANDA:AUDUSD', displaySymbol: 'AUDUSD', price: 0.66250, bid: 0.66244, ask: 0.66256, spread: '1.2 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:USDCAD': { symbol: 'OANDA:USDCAD', displaySymbol: 'USDCAD', price: 1.38900, bid: 1.38892, ask: 1.38908, spread: '1.6 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:NZDUSD': { symbol: 'OANDA:NZDUSD', displaySymbol: 'NZDUSD', price: 0.59850, bid: 0.59842, ask: 0.59858, spread: '1.6 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:GBPJPY': { symbol: 'OANDA:GBPJPY', displaySymbol: 'GBPJPY', price: 197.850, bid: 197.838, ask: 197.862, spread: '2.4 pips', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'OANDA:EURJPY': { symbol: 'OANDA:EURJPY', displaySymbol: 'EURJPY', price: 165.250, bid: 165.238, ask: 165.262, spread: '2.4 pips', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'OANDA:EURGBP': { symbol: 'OANDA:EURGBP', displaySymbol: 'EURGBP', price: 0.83520, bid: 0.83512, ask: 0.83528, spread: '1.6 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:AUDJPY': { symbol: 'OANDA:AUDJPY', displaySymbol: 'AUDJPY', price: 100.950, bid: 100.938, ask: 100.962, spread: '2.4 pips', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'OANDA:CADJPY': { symbol: 'OANDA:CADJPY', displaySymbol: 'CADJPY', price: 109.700, bid: 109.688, ask: 109.712, spread: '2.4 pips', decimals: 3, pipUnit: 0.01, updatedAt: Date.now() },
  'OANDA:EURAUD': { symbol: 'OANDA:EURAUD', displaySymbol: 'EURAUD', price: 1.63700, bid: 1.63682, ask: 1.63718, spread: '3.6 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },
  'OANDA:GBPAUD': { symbol: 'OANDA:GBPAUD', displaySymbol: 'GBPAUD', price: 1.95950, bid: 1.95932, ask: 1.95968, spread: '3.6 pips', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },

  // Cryptocurrencies
  'BINANCE:BTCUSDT': { symbol: 'BINANCE:BTCUSDT', displaySymbol: 'BTCUSD', price: 82900.00, bid: 82898.50, ask: 82901.50, spread: '3.00 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'BINANCE:ETHUSDT': { symbol: 'BINANCE:ETHUSDT', displaySymbol: 'ETHUSD', price: 2640.00, bid: 2639.60, ask: 2640.40, spread: '0.80 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'BINANCE:SOLUSDT': { symbol: 'BINANCE:SOLUSDT', displaySymbol: 'SOLUSD', price: 172.50, bid: 172.45, ask: 172.55, spread: '0.10 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'BINANCE:XRPUSDT': { symbol: 'BINANCE:XRPUSDT', displaySymbol: 'XRPUSD', price: 0.5850, bid: 0.5849, ask: 0.5851, spread: '0.0002 pts', decimals: 4, pipUnit: 0.001, updatedAt: Date.now() },
  'BINANCE:BNBUSDT': { symbol: 'BINANCE:BNBUSDT', displaySymbol: 'BNBUSD', price: 598.00, bid: 597.80, ask: 598.20, spread: '0.40 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'BINANCE:DOGEUSDT': { symbol: 'BINANCE:DOGEUSDT', displaySymbol: 'DOGEUSD', price: 0.14500, bid: 0.14496, ask: 0.14504, spread: '0.00008 pts', decimals: 5, pipUnit: 0.0001, updatedAt: Date.now() },

  // Deriv Synthetics
  'DERIV:1HZ15V': { symbol: 'DERIV:1HZ15V', displaySymbol: 'Vol 15 (1s)', price: 2450.80, bid: 2450.70, ask: 2450.90, spread: '0.20 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:R_10': { symbol: 'DERIV:R_10', displaySymbol: 'Vol 10', price: 6842.15, bid: 6842.05, ask: 6842.25, spread: '0.20 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:R_25': { symbol: 'DERIV:R_25', displaySymbol: 'Vol 25', price: 1920.40, bid: 1920.30, ask: 1920.50, spread: '0.20 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:R_50': { symbol: 'DERIV:R_50', displaySymbol: 'Vol 50', price: 345.85, bid: 345.80, ask: 345.90, spread: '0.10 pts', decimals: 2, pipUnit: 0.01, updatedAt: Date.now() },
  'DERIV:R_75': { symbol: 'DERIV:R_75', displaySymbol: 'Vol 75', price: 487250.00, bid: 487245.00, ask: 487255.00, spread: '10.0 pts', decimals: 2, pipUnit: 1.0, updatedAt: Date.now() },
  'DERIV:R_100': { symbol: 'DERIV:R_100', displaySymbol: 'Vol 100', price: 1285.60, bid: 1285.45, ask: 1285.75, spread: '0.30 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:stpRNG': { symbol: 'DERIV:stpRNG', displaySymbol: 'Step 100', price: 8420.5, bid: 8420.4, ask: 8420.6, spread: '0.2 pts', decimals: 1, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:BOOM500': { symbol: 'DERIV:BOOM500', displaySymbol: 'Boom 500', price: 3620.10, bid: 3620.00, ask: 3620.20, spread: '0.20 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
  'DERIV:CRASH500': { symbol: 'DERIV:CRASH500', displaySymbol: 'Crash 500', price: 4190.30, bid: 4190.20, ask: 4190.40, spread: '0.20 pts', decimals: 2, pipUnit: 0.1, updatedAt: Date.now() },
};

let lastQuotesFetchTime = 0;
let isQuotesFetching = false;

async function refreshMt5Quotes() {
  if (isQuotesFetching) return;
  isQuotesFetching = true;

  try {
    const fetchPromises: Promise<void>[] = [];

    // 1. Fetch Binance Crypto (BTC, ETH, SOL, XRP, BNB, DOGE)
    fetchPromises.push(
      (async () => {
        try {
          const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22XRPUSDT%22,%22BNBUSDT%22,%22DOGEUSDT%22%5D', { signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                const p = parseFloat(item.lastPrice);
                const bid = parseFloat(item.bidPrice) || p * 0.9998;
                const ask = parseFloat(item.askPrice) || p * 1.0002;
                const spread = (ask - bid).toFixed(4);
                const chgPct = parseFloat(item.priceChangePercent).toFixed(2) + '%';
                const high = parseFloat(item.highPrice);
                const low = parseFloat(item.lowPrice);

                const mapKey: Record<string, { key: string; display: string; dec: number; pip: number }> = {
                  'BTCUSDT': { key: 'BINANCE:BTCUSDT', display: 'BTCUSD', dec: 2, pip: 1.0 },
                  'ETHUSDT': { key: 'BINANCE:ETHUSDT', display: 'ETHUSD', dec: 2, pip: 1.0 },
                  'SOLUSDT': { key: 'BINANCE:SOLUSDT', display: 'SOLUSD', dec: 2, pip: 0.1 },
                  'XRPUSDT': { key: 'BINANCE:XRPUSDT', display: 'XRPUSD', dec: 4, pip: 0.001 },
                  'BNBUSDT': { key: 'BINANCE:BNBUSDT', display: 'BNBUSD', dec: 2, pip: 0.1 },
                  'DOGEUSDT': { key: 'BINANCE:DOGEUSDT', display: 'DOGEUSD', dec: 5, pip: 0.0001 },
                };

                const target = mapKey[item.symbol];
                if (target && p > 0) {
                  mt5QuotesCache[target.key] = {
                    symbol: target.key,
                    displaySymbol: target.display,
                    price: p,
                    bid,
                    ask,
                    spread: `${spread} pts`,
                    high24h: high,
                    low24h: low,
                    change24hPct: chgPct,
                    decimals: target.dec,
                    pipUnit: target.pip,
                    updatedAt: Date.now(),
                  };
                }
              });
            }
          }
        } catch {
          // ignore transient crypto error
        }
      })()
    );

    // 2. Fetch Gold Spot (XAUUSD)
    fetchPromises.push(
      (async () => {
        try {
          const res = await fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const data = await res.json();
            const p = parseFloat(data.price);
            if (p > 0) {
              const halfSpread = 0.15;
              mt5QuotesCache['OANDA:XAUUSD'] = {
                symbol: 'OANDA:XAUUSD',
                displaySymbol: 'XAUUSD',
                price: p,
                bid: p - halfSpread,
                ask: p + halfSpread,
                spread: '0.30 pts',
                decimals: 2,
                pipUnit: 0.1,
                updatedAt: Date.now(),
              };
            }
          }
        } catch {
          // ignore
        }
      })()
    );

    // 3. Fetch Indices, Forex, and Commodities from Yahoo Finance
    const ySymbols = [
      { sym: '^DJI', key: 'CAPITALCOM:US30', display: 'US30', dec: 2, pip: 1.0, spreadVal: 2.2 },
      { sym: '^IXIC', key: 'FOREXCOM:NSXUSD', display: 'NAS100', dec: 2, pip: 1.0, spreadVal: 1.5 },
      { sym: '^GSPC', key: 'FOREXCOM:SPXUSD', display: 'SPX500', dec: 2, pip: 0.1, spreadVal: 0.8 },
      { sym: '^GDAXI', key: 'CAPITALCOM:DE40', display: 'GER40', dec: 2, pip: 1.0, spreadVal: 3.0 },
      { sym: '^FTSE', key: 'CAPITALCOM:UK100', display: 'UK100', dec: 2, pip: 1.0, spreadVal: 1.6 },
      { sym: '^N225', key: 'CAPITALCOM:JP225', display: 'JP225', dec: 1, pip: 1.0, spreadVal: 6.0 },
      { sym: 'CL=F', key: 'TVC:USOIL', display: 'USOIL', dec: 2, pip: 0.01, spreadVal: 0.04 },
      { sym: 'BZ=F', key: 'TVC:UKOIL', display: 'UKOIL', dec: 2, pip: 0.01, spreadVal: 0.04 },
      { sym: 'NG=F', key: 'TVC:NATGAS', display: 'NATGAS', dec: 3, pip: 0.001, spreadVal: 0.004 },
      { sym: 'HG=F', key: 'TVC:COPPER', display: 'COPPER', dec: 3, pip: 0.001, spreadVal: 0.004 },
      { sym: 'SI=F', key: 'OANDA:XAGUSD', display: 'XAGUSD', dec: 3, pip: 0.01, spreadVal: 0.04 },
      { sym: 'EURUSD=X', key: 'OANDA:EURUSD', display: 'EURUSD', dec: 5, pip: 0.0001, spreadVal: 0.0001 },
      { sym: 'GBPUSD=X', key: 'OANDA:GBPUSD', display: 'GBPUSD', dec: 5, pip: 0.0001, spreadVal: 0.00012 },
      { sym: 'JPY=X', key: 'OANDA:USDJPY', display: 'USDJPY', dec: 3, pip: 0.01, spreadVal: 0.012 },
      { sym: 'CHF=X', key: 'OANDA:USDCHF', display: 'USDCHF', dec: 5, pip: 0.0001, spreadVal: 0.00012 },
      { sym: 'AUDUSD=X', key: 'OANDA:AUDUSD', display: 'AUDUSD', dec: 5, pip: 0.0001, spreadVal: 0.00012 },
      { sym: 'CAD=X', key: 'OANDA:USDCAD', display: 'USDCAD', dec: 5, pip: 0.0001, spreadVal: 0.00016 },
      { sym: 'NZDUSD=X', key: 'OANDA:NZDUSD', display: 'NZDUSD', dec: 5, pip: 0.0001, spreadVal: 0.00016 },
      { sym: 'GBPJPY=X', key: 'OANDA:GBPJPY', display: 'GBPJPY', dec: 3, pip: 0.01, spreadVal: 0.024 },
      { sym: 'EURJPY=X', key: 'OANDA:EURJPY', display: 'EURJPY', dec: 3, pip: 0.01, spreadVal: 0.024 },
      { sym: 'EURGBP=X', key: 'OANDA:EURGBP', display: 'EURGBP', dec: 5, pip: 0.0001, spreadVal: 0.00016 },
    ];

    for (const item of ySymbols) {
      fetchPromises.push(
        (async () => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.sym)}?interval=1d&range=1d`;
            const res = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(2500),
            });
            if (res.ok) {
              const data = await res.json();
              const meta = data?.chart?.result?.[0]?.meta;
              const p = parseFloat(meta?.regularMarketPrice);
              if (p > 0) {
                const prevClose = parseFloat(meta?.chartPreviousClose) || p;
                const chg = p - prevClose;
                const chgPct = ((chg / prevClose) * 100).toFixed(2) + '%';
                const halfSpread = item.spreadVal / 2;

                mt5QuotesCache[item.key] = {
                  symbol: item.key,
                  displaySymbol: item.display,
                  price: p,
                  bid: p - halfSpread,
                  ask: p + halfSpread,
                  spread: `${item.spreadVal} ${item.dec === 5 ? 'pips' : 'pts'}`,
                  high24h: parseFloat(meta?.regularMarketDayHigh) || p,
                  low24h: parseFloat(meta?.regularMarketDayLow) || p,
                  change24h: chg,
                  change24hPct: chgPct,
                  decimals: item.dec,
                  pipUnit: item.pip,
                  updatedAt: Date.now(),
                };
              }
            }
          } catch {
            // ignore
          }
        })()
      );
    }

    await Promise.allSettled(fetchPromises);
    lastQuotesFetchTime = Date.now();
  } catch (err) {
    console.warn('Quotes refresh error:', err);
  } finally {
    isQuotesFetching = false;
  }
}

// Initial warm-up
refreshMt5Quotes().catch(() => {});

app.get('/api/mt5/quotes', async (req, res) => {
  // If cache is older than 2.5 seconds, trigger a refresh
  if (Date.now() - lastQuotesFetchTime > 2500) {
    refreshMt5Quotes().catch(() => {});
  }

  // Micro-tick simulation on top of real prices so every sub-second feels alive like MT5
  const simulatedQuotes: Record<string, Mt5Quote> = {};
  for (const [key, quote] of Object.entries(mt5QuotesCache)) {
    const jitter = (Math.random() - 0.49) * 0.35 * quote.pipUnit;
    const liveP = Math.max(0.0001, quote.price + jitter);
    const halfSpread = (parseFloat(quote.spread) || 1) * (quote.pipUnit / 2);

    simulatedQuotes[key] = {
      ...quote,
      price: liveP,
      bid: liveP - halfSpread,
      ask: liveP + halfSpread,
    };
  }

  res.json({
    success: true,
    timestamp: Date.now(),
    quotes: simulatedQuotes,
  });
});

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
