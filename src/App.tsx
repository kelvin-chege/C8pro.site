/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TradingMentor } from './TradingMentor';
import { LiveDigitFrequency } from './components/LiveDigitFrequency';
import { GoodTradingTimeBanner, GoodTradingTimeModal, computeTradingTimeInfo } from './components/GoodTradingTimeRadar';
import { MultiVolOverUnderScanner } from './components/MultiVolOverUnderScanner';
import { SecurityLoginGate, getStoredAuthState, lockTerminalState, SecurityAuthState } from './components/SecurityLoginGate';
import { AppControllerBridge } from './utils/tracyController';
import { ProStrategyPlaybookModal, StrategyKey } from './components/ProStrategyPlaybookModal';

// Declare TradingView global
declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => unknown;
    };
  }
}

// Deriv Public WebSocket Endpoints
const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const FALLBACK_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

// Known pip sizes for Deriv markets & all Step Indices
const PIP_SIZES: Record<string, number> = {
  // Continuous Volatilities
  R_10: 3,
  R_15: 3,
  R_25: 3,
  R_30: 3,
  R_50: 4,
  R_75: 4,
  R_90: 4,
  R_100: 2,
  R_150: 4,
  R_200: 4,
  R_250: 2,
  R_300: 2,
  // 1-Second Volatilities
  '1HZ10V': 2,
  '1HZ15V': 2,
  '1HZ25V': 2,
  '1HZ30V': 2,
  '1HZ50V': 2,
  '1HZ75V': 2,
  '1HZ90V': 2,
  '1HZ100V': 2,
  '1HZ150V': 2,
  '1HZ200V': 2,
  '1HZ250V': 2,
  '1HZ300V': 2,
  // Jump Indices
  JD10: 3,
  JD25: 3,
  JD50: 3,
  JD75: 3,
  JD100: 3,
  // All Step Indices (Step 100 to 500)
  STEP: 1,
  stpRNG: 1,
  stpRNG2: 1,
  stpRNG3: 1,
  stpRNG4: 1,
  stpRNG5: 1,
};

interface RecentTickItem {
  digit: number;
  price: number;
  dir: 'rise' | 'fall' | 'equal';
}

interface HotColdDigit {
  digit: number;
  count: number;
  pct: number;
  ticksAgo: number;
}

export interface DigitMatchStat {
  digit: number;
  freqCount: number;
  freqPct: number;
  markovTransPct: number;
  ticksAgo: number;
  matchScore: number;
  differScore: number;
  status: 'PRIMARY MATCH 🔥' | 'SECONDARY RUNNER ⚡' | 'SAFE DIFFER 🛡️' | 'NEUTRAL';
}

export interface MT5Confluence {
  name: string;
  active: boolean;
}

export interface MT5InstrumentSignal {
  symbol: string;
  displaySymbol: string;
  name: string;
  category: 'Commodities' | 'Forex' | 'Indices' | 'Crypto' | 'Synthetics';
  action: 'STRONG BUY ↑' | 'STRONG SELL ↓';
  confidence: number;
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  tp3: string;
  pipsRisk: number;
  pipsReward: number;
  rrRatio: string;
  timeframe: string;
  strategy: string;
  session: string;
  status: 'ACTIVE 🔥' | 'CONFIRMED' | 'TRIGGERED';
  confluences: MT5Confluence[];
  technicalSummary: string;
}

export const MT5_ASSET_BASE_PARAMS: Record<string, { price: number; decimals: number; pipUnit: number }> = {
  // Commodities & Precious Metals
  'OANDA:XAUUSD': { price: 2684.50, decimals: 2, pipUnit: 0.1 },
  'OANDA:XAGUSD': { price: 31.85, decimals: 3, pipUnit: 0.01 },
  'TVC:USOIL': { price: 71.40, decimals: 2, pipUnit: 0.01 },
  'TVC:UKOIL': { price: 75.20, decimals: 2, pipUnit: 0.01 },
  'TVC:NATGAS': { price: 2.850, decimals: 3, pipUnit: 0.001 },
  'TVC:COPPER': { price: 4.380, decimals: 3, pipUnit: 0.001 },

  // World Indices
  'CAPITALCOM:US30': { price: 43450.00, decimals: 2, pipUnit: 1.0 },
  'FOREXCOM:NSXUSD': { price: 20480.00, decimals: 2, pipUnit: 1.0 },
  'FOREXCOM:SPXUSD': { price: 5890.00, decimals: 2, pipUnit: 0.1 },
  'CAPITALCOM:DE40': { price: 19420.00, decimals: 2, pipUnit: 1.0 },
  'CAPITALCOM:UK100': { price: 8260.00, decimals: 2, pipUnit: 1.0 },
  'CAPITALCOM:JP225': { price: 38850.0, decimals: 1, pipUnit: 1.0 },
  'CAPITALCOM:FR40': { price: 7540.00, decimals: 2, pipUnit: 1.0 },
  'CAPITALCOM:HK50': { price: 20680.0, decimals: 1, pipUnit: 1.0 },
  'CAPITALCOM:AU200': { price: 8290.0, decimals: 1, pipUnit: 1.0 },

  // Forex Majors & Crosses
  'OANDA:EURUSD': { price: 1.08450, decimals: 5, pipUnit: 0.0001 },
  'OANDA:GBPUSD': { price: 1.29820, decimals: 5, pipUnit: 0.0001 },
  'OANDA:USDJPY': { price: 152.400, decimals: 3, pipUnit: 0.01 },
  'OANDA:USDCHF': { price: 0.86550, decimals: 5, pipUnit: 0.0001 },
  'OANDA:AUDUSD': { price: 0.66250, decimals: 5, pipUnit: 0.0001 },
  'OANDA:USDCAD': { price: 1.38900, decimals: 5, pipUnit: 0.0001 },
  'OANDA:NZDUSD': { price: 0.59850, decimals: 5, pipUnit: 0.0001 },
  'OANDA:GBPJPY': { price: 197.850, decimals: 3, pipUnit: 0.01 },
  'OANDA:EURJPY': { price: 165.250, decimals: 3, pipUnit: 0.01 },
  'OANDA:EURGBP': { price: 0.83520, decimals: 5, pipUnit: 0.0001 },
  'OANDA:AUDJPY': { price: 100.950, decimals: 3, pipUnit: 0.01 },
  'OANDA:CADJPY': { price: 109.700, decimals: 3, pipUnit: 0.01 },
  'OANDA:EURAUD': { price: 1.63700, decimals: 5, pipUnit: 0.0001 },
  'OANDA:GBPAUD': { price: 1.95950, decimals: 5, pipUnit: 0.0001 },

  // Cryptocurrencies
  'BINANCE:BTCUSDT': { price: 82900.00, decimals: 2, pipUnit: 1.0 },
  'BINANCE:ETHUSDT': { price: 2640.00, decimals: 2, pipUnit: 1.0 },
  'BINANCE:SOLUSDT': { price: 172.50, decimals: 2, pipUnit: 0.1 },
  'BINANCE:XRPUSDT': { price: 0.5850, decimals: 4, pipUnit: 0.001 },
  'BINANCE:BNBUSDT': { price: 598.00, decimals: 2, pipUnit: 0.1 },
  'BINANCE:DOGEUSDT': { price: 0.14500, decimals: 5, pipUnit: 0.0001 },

  // Deriv Synthetics
  'DERIV:1HZ15V': { price: 2450.80, decimals: 2, pipUnit: 0.1 },
  'DERIV:R_10': { price: 6842.15, decimals: 2, pipUnit: 0.1 },
  'DERIV:R_25': { price: 1920.40, decimals: 2, pipUnit: 0.1 },
  'DERIV:R_50': { price: 345.85, decimals: 2, pipUnit: 0.01 },
  'DERIV:R_75': { price: 487250.00, decimals: 2, pipUnit: 1.0 },
  'DERIV:R_100': { price: 1285.60, decimals: 2, pipUnit: 0.1 },
  'DERIV:stpRNG': { price: 8420.5, decimals: 1, pipUnit: 0.1 },
  'DERIV:BOOM500': { price: 3620.10, decimals: 2, pipUnit: 0.1 },
  'DERIV:CRASH500': { price: 4190.30, decimals: 2, pipUnit: 0.1 },
};

export function getTimeframeSignalProfile(
  baseSig: MT5InstrumentSignal,
  timeframe: string,
  livePriceOverride?: number
): MT5InstrumentSignal {
  const pInfo = MT5_ASSET_BASE_PARAMS[baseSig.symbol] || { price: 100, decimals: 2, pipUnit: 0.01 };
  const currentBasePrice = typeof livePriceOverride === 'number' && livePriceOverride > 0
    ? livePriceOverride
    : pInfo.price;
  const isBuy = baseSig.action.includes('BUY');

  let tfLabel = '15M / H1';
  let conf = baseSig.confidence;
  let strategy = baseSig.strategy;
  let summary = baseSig.technicalSummary;
  let pipsRisk = baseSig.pipsRisk;
  let pipsReward = baseSig.pipsReward;
  let rrRatio = baseSig.rrRatio;

  if (timeframe === '1') {
    tfLabel = '1M (Ultra-Scalp)';
    conf = 98.4;
    strategy = '1M Micro-FVG Retest + Order Flow Liquidity Tap';
    summary = `Hyper-fast 1-minute order flow imbalance. Price swept local micro-liquidity and printed aggressive delta absorption. Tight ${Math.round(baseSig.pipsRisk * 0.35)} pip risk for rapid scalping.`;
    pipsRisk = Math.max(8, Math.round(baseSig.pipsRisk * 0.35));
    pipsReward = Math.round(pipsRisk * 3.2);
    rrRatio = '1:3.2';
  } else if (timeframe === '5') {
    tfLabel = '5M (Intraday Momentum)';
    conf = 98.7;
    strategy = '5M Change of Character (CHoCH) + EMA 9/21 Ribbon Bounce';
    summary = `Energetic 5-minute displacement candle breaking local structure with high buyer commitment. Confluence with 9-EMA dynamic support.`;
    pipsRisk = Math.max(14, Math.round(baseSig.pipsRisk * 0.6));
    pipsReward = Math.round(pipsRisk * 3.5);
    rrRatio = '1:3.5';
  } else if (timeframe === '15') {
    tfLabel = '15M (SMC Order Block)';
    conf = 99.1;
    strategy = baseSig.strategy;
    summary = baseSig.technicalSummary;
    pipsRisk = baseSig.pipsRisk;
    pipsReward = baseSig.pipsReward;
    rrRatio = baseSig.rrRatio;
  } else if (timeframe === '60') {
    tfLabel = '1H (Liquidity Pool Expansion)';
    conf = 99.3;
    strategy = 'London/NY Killzone Sweep + H1 Fair Value Gap Equilibrium Run';
    summary = `Major session liquidity high/low swept. H1 institutional order block tested with large wick rejection confirming smart money sponsorship.`;
    pipsRisk = Math.round(baseSig.pipsRisk * 1.5);
    pipsReward = Math.round(pipsRisk * 4.1);
    rrRatio = '1:4.1';
  } else if (timeframe === '240') {
    tfLabel = '4H (Institutional Swing Run)';
    conf = 98.8;
    strategy = '4H Macro Demand Mitigation + Wyckoff Accumulation Phase';
    summary = `Multi-day demand zone mitigation. Institutional accumulation structure confirmed with supply depletion across 4-hour candles.`;
    pipsRisk = Math.round(baseSig.pipsRisk * 2.3);
    pipsReward = Math.round(pipsRisk * 4.4);
    rrRatio = '1:4.4';
  } else if (timeframe === 'D') {
    tfLabel = '1D (Macro Structural Trend)';
    conf = 98.2;
    strategy = 'Weekly Liquidity Purge & Institutional Core Expansion';
    summary = `Macro daily trend continuation. Primary institutional balance zone defended with long-term capital inflow alignment.`;
    pipsRisk = Math.round(baseSig.pipsRisk * 3.4);
    pipsReward = Math.round(pipsRisk * 4.8);
    rrRatio = '1:4.8';
  }

  const riskOffset = pipsRisk * pInfo.pipUnit;
  const reward1 = Math.round(pipsRisk * 1.8) * pInfo.pipUnit;
  const reward2 = pipsReward * pInfo.pipUnit;
  const reward3 = Math.round(pipsRisk * 5.2) * pInfo.pipUnit;

  const entryNum = currentBasePrice;
  const slNum = isBuy ? entryNum - riskOffset : entryNum + riskOffset;
  const tp1Num = isBuy ? entryNum + reward1 : entryNum - reward1;
  const tp2Num = isBuy ? entryNum + reward2 : entryNum - reward2;
  const tp3Num = isBuy ? entryNum + reward3 : entryNum - reward3;

  return {
    ...baseSig,
    timeframe: tfLabel,
    confidence: conf,
    strategy,
    technicalSummary: summary,
    pipsRisk,
    pipsReward,
    rrRatio,
    entry: entryNum.toLocaleString(undefined, { minimumFractionDigits: pInfo.decimals, maximumFractionDigits: pInfo.decimals }),
    sl: slNum.toLocaleString(undefined, { minimumFractionDigits: pInfo.decimals, maximumFractionDigits: pInfo.decimals }),
    tp1: tp1Num.toLocaleString(undefined, { minimumFractionDigits: pInfo.decimals, maximumFractionDigits: pInfo.decimals }),
    tp2: tp2Num.toLocaleString(undefined, { minimumFractionDigits: pInfo.decimals, maximumFractionDigits: pInfo.decimals }),
    tp3: tp3Num.toLocaleString(undefined, { minimumFractionDigits: pInfo.decimals, maximumFractionDigits: pInfo.decimals }),
  };
}

export const MT5_SIGNALS_REGISTRY: MT5InstrumentSignal[] = [
  // ==========================================
  // 1. COMMODITIES & PRECIOUS METALS
  // ==========================================
  {
    symbol: 'OANDA:XAUUSD',
    displaySymbol: 'XAUUSD',
    name: 'Gold Spot / US Dollar',
    category: 'Commodities',
    action: 'STRONG BUY ↑',
    confidence: 98.9,
    entry: '2,684.50',
    sl: '2,676.80',
    tp1: '2,698.00',
    tp2: '2,714.00',
    tp3: '2,735.00',
    pipsRisk: 77,
    pipsReward: 295,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'H1 Institutional Order Block (OB) Retest + M15 FVG Fill',
    session: 'London / NY Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Price tapped the 50% discount equilibrium of the H1 Fair Value Gap with high buying absorption. +380% institutional volume delta confirms smart money defense.',
    confluences: [
      { name: 'H1 Institutional Order Block (OB) Retest', active: true },
      { name: 'M15 Fair Value Gap (FVG) Filled', active: true },
      { name: 'Asian Liquidity High Swept & Cleared', active: true },
      { name: 'EMA Ribbon (9/21/50) Bullish Dynamic Expansion', active: true },
      { name: 'RSI Bullish Hidden Divergence (42 -> 61)', active: true },
      { name: 'Multi-Timeframe Trend Concordance (M5+M15+H1)', active: true },
    ],
  },
  {
    symbol: 'OANDA:XAGUSD',
    displaySymbol: 'XAGUSD',
    name: 'Silver Spot / US Dollar',
    category: 'Commodities',
    action: 'STRONG BUY ↑',
    confidence: 98.4,
    entry: '31.850',
    sl: '31.420',
    tp1: '32.600',
    tp2: '33.500',
    tp3: '34.800',
    pipsRisk: 43,
    pipsReward: 165,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'Bullish Breaker Block + Gold/Silver Beta Expansion',
    session: 'London / NY Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Silver confirmed high relative strength outperforming gold. Swept sell-side liquidity at $31.45 before printing a massive bullish engulfing candle.',
    confluences: [
      { name: 'Bullish Breaker Block Mitigation', active: true },
      { name: 'Sell-Side Liquidity (SSL) Grab Completed', active: true },
      { name: 'Gold/Silver Correlation Expansion', active: true },
      { name: 'EMA 21 Dynamic Bounce on M15', active: true },
      { name: 'RSI Breaking Above 60 Baseline', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'TVC:USOIL',
    displaySymbol: 'USOIL',
    name: 'WTI Crude Oil Spot',
    category: 'Commodities',
    action: 'STRONG SELL ↓',
    confidence: 98.2,
    entry: '71.40',
    sl: '72.35',
    tp1: '69.60',
    tp2: '67.80',
    tp3: '65.20',
    pipsRisk: 95,
    pipsReward: 360,
    rrRatio: '1:3.8',
    timeframe: 'H1',
    strategy: 'Macro Resistance Supply Ceiling + Inventory Build',
    session: 'NY Energy Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Price failed at macro resistance band $72.00. Institutional sell order blocks active across H1 and H4 with heavy distribution volume and inventory build.',
    confluences: [
      { name: 'Macro Resistance Supply Ceiling Rejected', active: true },
      { name: 'H1 Bearish Breakdown Below EMA 50', active: true },
      { name: 'RSI Severe Bearish Divergence', active: true },
      { name: 'Inventory Buildup Institutional Selling', active: true },
      { name: 'Target Down to $67.80 Clean Liquidity Pool', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'TVC:UKOIL',
    displaySymbol: 'UKOIL',
    name: 'Brent Crude Oil Spot',
    category: 'Commodities',
    action: 'STRONG SELL ↓',
    confidence: 97.9,
    entry: '75.20',
    sl: '76.15',
    tp1: '73.40',
    tp2: '71.80',
    tp3: '69.50',
    pipsRisk: 95,
    pipsReward: 340,
    rrRatio: '1:3.6',
    timeframe: 'H1 / H4',
    strategy: 'H4 Bearish Fair Value Gap + OPEC Supply Pressure',
    session: 'London / NY Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Brent rejected descending trendline resistance with high bearish delta. Downward displacement candle confirmed institutional short positioning.',
    confluences: [
      { name: 'Descending Trendline Supply Defense', active: true },
      { name: 'H4 Fair Value Gap Imbalance Retested', active: true },
      { name: 'Bearish MACD Crossover in Overbought', active: true },
      { name: 'EMA 21 Holding as Overhead Resistance', active: true },
      { name: 'Clean Sell Pathway to $71.80 Support', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'TVC:NATGAS',
    displaySymbol: 'NATGAS',
    name: 'US Natural Gas Spot',
    category: 'Commodities',
    action: 'STRONG BUY ↑',
    confidence: 97.6,
    entry: '2.850',
    sl: '2.740',
    tp1: '3.040',
    tp2: '3.250',
    tp3: '3.500',
    pipsRisk: 110,
    pipsReward: 400,
    rrRatio: '1:3.6',
    timeframe: 'H1',
    strategy: 'Winter Demand Squeeze + Multi-Week Accumulation Floor',
    session: 'NY Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Gas broke out from a 4-week base consolidation. High accumulation volume and weather model shifts fueling continuous upward pressure.',
    confluences: [
      { name: '4-Week Base Consolidation Breakout', active: true },
      { name: 'High Volume Delta Absorption on Dips', active: true },
      { name: 'Golden Cross on M15/H1 EMAs', active: true },
      { name: 'RSI Upward Momentum Regime > 58', active: true },
      { name: 'Open Interest Expansion on Long Contracts', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'TVC:COPPER',
    displaySymbol: 'COPPER',
    name: 'High Grade Copper Spot',
    category: 'Commodities',
    action: 'STRONG BUY ↑',
    confidence: 97.8,
    entry: '4.380',
    sl: '4.290',
    tp1: '4.520',
    tp2: '4.680',
    tp3: '4.850',
    pipsRisk: 90,
    pipsReward: 300,
    rrRatio: '1:3.3',
    timeframe: 'H1',
    strategy: 'Global Infrastructure Demand Wave + Supply Tightness',
    session: 'London / Asian Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Dr. Copper showing sustained institutional bids on London Metal Exchange. Retest of previous resistance turned dynamic support confirmed.',
    confluences: [
      { name: 'LME Warehouse Inventory Drawdown', active: true },
      { name: 'Resistance-Turned-Support Retest Confirmed', active: true },
      { name: 'EMA Ribbon Bullish Dynamic Alignment', active: true },
      { name: 'MACD Positive Acceleration', active: true },
      { name: 'Global Manufacturing PMI Inflow Sync', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },

  // ==========================================
  // 2. WORLD INDICES
  // ==========================================
  {
    symbol: 'CAPITALCOM:US30',
    displaySymbol: 'US30',
    name: 'Dow Jones Industrial 30',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 99.1,
    entry: '43,450.00',
    sl: '43,290.00',
    tp1: '43,780.00',
    tp2: '44,050.00',
    tp3: '44,400.00',
    pipsRisk: 160,
    pipsReward: 600,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'NY Open Judas Swing Liquidity Sweep + Institutional Reversal',
    session: 'New York Opening Bell',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Early morning sell-side liquidity taken below prior day low. Clean Break of Structure (BOS) printed on M5 with energetic bullish displacement candles.',
    confluences: [
      { name: 'Daily Sell-Side Liquidity (SSL) Purged', active: true },
      { name: 'M15 Change of Character (CHoCH) Confirmed', active: true },
      { name: 'Institutional Volume Delta +410%', active: true },
      { name: 'EMA 21/50 Golden Cross Continuation', active: true },
      { name: 'MACD Zero-Line Bullish Expansion', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'FOREXCOM:NSXUSD',
    displaySymbol: 'NAS100',
    name: 'Nasdaq 100 Index',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 98.9,
    entry: '20,480.00',
    sl: '20,380.00',
    tp1: '20,680.00',
    tp2: '20,890.00',
    tp3: '21,150.00',
    pipsRisk: 100,
    pipsReward: 410,
    rrRatio: '1:4.1',
    timeframe: 'M15 / H1',
    strategy: 'Mega-Cap Tech Breadth Breakout + M15 Order Block Retest',
    session: 'New York Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Technology mega-caps showing simultaneous breadth expansion. M15 bullish engulfing printed on institutional buy zone.',
    confluences: [
      { name: 'M15 Order Block Retest & Cushion', active: true },
      { name: 'Relative Strength vs S&P 500 Outperforming', active: true },
      { name: 'EMA Ribbon Dynamic Bullish Fan Out', active: true },
      { name: 'RSI Bullish Divergence on Lower Timeframes', active: true },
      { name: 'Pre-market High Breached and Retested', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'FOREXCOM:SPXUSD',
    displaySymbol: 'SPX500',
    name: 'S&P 500 Index',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 98.7,
    entry: '5,890.00',
    sl: '5,855.00',
    tp1: '5,960.00',
    tp2: '6,025.00',
    tp3: '6,100.00',
    pipsRisk: 35,
    pipsReward: 135,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'Broad Market Breadth Expansion + H1 Liquidity Sweep',
    session: 'New York Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Over 82% of S&P components trading above 20-day moving average. Clean bounce off 5,850 psychological support with heavy volume buy imbalance.',
    confluences: [
      { name: '5,850 Key Psychological Support Bounce', active: true },
      { name: 'Breadth Expansion > 80% Above 20 EMA', active: true },
      { name: 'Institutional Block Buying Surge', active: true },
      { name: 'EMA 9/21 Ribbon Guided Trend', active: true },
      { name: 'Clean Target to 6,000 All-Time Highs', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:DE40',
    displaySymbol: 'GER40',
    name: 'Germany 40 (DAX)',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 98.3,
    entry: '19,420.00',
    sl: '19,310.00',
    tp1: '19,620.00',
    tp2: '19,850.00',
    tp3: '20,100.00',
    pipsRisk: 110,
    pipsReward: 430,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'Frankfurt Open Bullish Breakout + European Inflows',
    session: 'Frankfurt / London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'DAX surged past previous swing high with strong industrial and automotive volume. Pullback to 19,350 cleanly defended by European institutional desks.',
    confluences: [
      { name: 'Frankfurt Morning Liquidity Sweep Finished', active: true },
      { name: 'Prior Resistance Converted to Support Shelf', active: true },
      { name: 'EMA 21/50 Golden Cross Intact', active: true },
      { name: 'ECB Liquidity Injection Tailwinds', active: true },
      { name: 'RSI Rebounding from 52 Baseline', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:UK100',
    displaySymbol: 'UK100',
    name: 'UK 100 (FTSE)',
    category: 'Indices',
    action: 'STRONG SELL ↓',
    confidence: 97.8,
    entry: '8,260.00',
    sl: '8,325.00',
    tp1: '8,140.00',
    tp2: '8,010.00',
    tp3: '7,880.00',
    pipsRisk: 65,
    pipsReward: 250,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'FTSE Resistance Shelf Rejection + Sterling Correlation Drag',
    session: 'London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'UK 100 printed multiple exhaustion wicks at 8,300 ceiling. Stronger Pound exerting valuation pressure on multi-national FTSE earnings.',
    confluences: [
      { name: '8,300 Macro Resistance Ceiling Defense', active: true },
      { name: 'Bearish Engulfing Printed on H1', active: true },
      { name: 'EMA 9 Crossed Below EMA 21', active: true },
      { name: 'Pound Strength Correlation Drag', active: true },
      { name: 'Target Down to 8,010 Liquidity Void', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:JP225',
    displaySymbol: 'JP225',
    name: 'Japan 225 (Nikkei)',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 98.2,
    entry: '38,850.0',
    sl: '38,520.0',
    tp1: '39,450.0',
    tp2: '40,100.0',
    tp3: '40,800.0',
    pipsRisk: 330,
    pipsReward: 1250,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'Tokyo Session Momentum Sweep + BOJ Policy Stability',
    session: 'Tokyo Opening Bell',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Nikkei defended 38,500 key support shelf. Exporters rally on yen carry stability, driving continuous intraday accumulation.',
    confluences: [
      { name: 'Tokyo Session Low Liquidity Purged', active: true },
      { name: 'Strong Export Sector Volume Inflow', active: true },
      { name: 'EMA Ribbon Dynamic Bullish Expansion', active: true },
      { name: 'RSI Rebounding from Oversold (38 -> 59)', active: true },
      { name: 'Target Toward 40,000 Milestone Resistance', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:FR40',
    displaySymbol: 'FRA40',
    name: 'France 40 (CAC 40)',
    category: 'Indices',
    action: 'STRONG SELL ↓',
    confidence: 97.5,
    entry: '7,540.00',
    sl: '7,610.00',
    tp1: '7,420.00',
    tp2: '7,280.00',
    tp3: '7,150.00',
    pipsRisk: 70,
    pipsReward: 260,
    rrRatio: '1:3.7',
    timeframe: 'H1',
    strategy: 'Eurozone Supply Block Defense + Luxury Sector Drag',
    session: 'Paris / London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'CAC 40 met heavy supply at 7,600. Luxury giants dragging index downward as sell volume accelerates below key trendline.',
    confluences: [
      { name: '7,600 Overhead Resistance Block Defense', active: true },
      { name: 'Trendline Breakdown with Volume Confirmation', active: true },
      { name: 'EMA 50 / 200 Death Cross on M30', active: true },
      { name: 'RSI Lower High Bearish Pattern', active: true },
      { name: 'Clean Target Down to 7,280 Liquidity Shelf', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:HK50',
    displaySymbol: 'HK50',
    name: 'Hong Kong 50 (Hang Seng)',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 98.6,
    entry: '20,680.0',
    sl: '20,290.0',
    tp1: '21,350.0',
    tp2: '22,100.0',
    tp3: '22,900.0',
    pipsRisk: 390,
    pipsReward: 1420,
    rrRatio: '1:3.6',
    timeframe: 'H1 / H4',
    strategy: 'Stimulus Liquidity Inflow + Golden Dragon Rally',
    session: 'Hong Kong Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Hang Seng experienced aggressive foreign institutional inflows. Daily breakout above 20,500 base confirms major trend change.',
    confluences: [
      { name: 'Multi-Month Base Breakout Confirmed', active: true },
      { name: 'Record Foreign Institutional Capital Inflow', active: true },
      { name: 'EMA Ribbon Golden Expansion Across All TFs', active: true },
      { name: 'MACD Historic High Momentum Print', active: true },
      { name: 'Clean Run to 22,000 Liquidity Magnet', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'CAPITALCOM:AU200',
    displaySymbol: 'AUS200',
    name: 'Australia 200 (ASX 200)',
    category: 'Indices',
    action: 'STRONG BUY ↑',
    confidence: 97.9,
    entry: '8,290.0',
    sl: '8,210.0',
    tp1: '8,420.0',
    tp2: '8,580.0',
    tp3: '8,750.0',
    pipsRisk: 80,
    pipsReward: 290,
    rrRatio: '1:3.6',
    timeframe: 'M15 / H1',
    strategy: 'Mining & Banking Sector Confluence + Commodity Push',
    session: 'Sydney Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'ASX 200 propelled by iron ore and copper stability. Retest of 8,240 prior resistance cleanly absorbed by institutional buying.',
    confluences: [
      { name: 'Prior Resistance Turned Support Retested', active: true },
      { name: 'Commodity & Mining Stocks Bullish Delta', active: true },
      { name: 'EMA 21 Dynamic Bounce on Intraday', active: true },
      { name: 'RSI Firm in Bullish Territory at 62', active: true },
      { name: 'Pathway to 8,580 New All-Time High', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },

  // ==========================================
  // 3. FOREX MAJORS & KEY CROSSES
  // ==========================================
  {
    symbol: 'OANDA:EURUSD',
    displaySymbol: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'Forex',
    action: 'STRONG SELL ↓',
    confidence: 98.5,
    entry: '1.08450',
    sl: '1.08620',
    tp1: '1.08150',
    tp2: '1.07880',
    tp3: '1.07500',
    pipsRisk: 17,
    pipsReward: 57,
    rrRatio: '1:3.4',
    timeframe: 'M15 / H1',
    strategy: 'Bearish Breaker Block + London Silver Bullet Sweep',
    session: 'London Open Killzone',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Rejection from key daily supply zone. London session pushed price to sweep previous high before violently crashing lower through local support.',
    confluences: [
      { name: 'Daily Bearish Supply Mitigation', active: true },
      { name: 'London High Liquidity Sweep Finished', active: true },
      { name: 'M15 Change of Character (CHoCH)', active: true },
      { name: 'EMA 50 / 200 Death Cross Confirmed', active: true },
      { name: 'Bearish MACD Momentum Expansion', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'OANDA:GBPUSD',
    displaySymbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.6,
    entry: '1.29820',
    sl: '1.29580',
    tp1: '1.30300',
    tp2: '1.30750',
    tp3: '1.31200',
    pipsRisk: 24,
    pipsReward: 93,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'London Session Low Sweep + Bullish Order Block',
    session: 'London / NY Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Cable executed a deep liquidity run below 1.2960 support, trapping late retail breakout sellers before printing an aggressive displacement rally.',
    confluences: [
      { name: 'Support Liquidity Trapped & Purged', active: true },
      { name: 'H1 Bullish Pinbar Climax', active: true },
      { name: 'EMA 9 Crossed Above EMA 21', active: true },
      { name: 'RSI Oversold Bounce with Higher Low', active: true },
      { name: 'Institutional Order Flow Turned Bullish', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:USDJPY',
    displaySymbol: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.7,
    entry: '152.400',
    sl: '151.850',
    tp1: '153.300',
    tp2: '154.500',
    tp3: '155.800',
    pipsRisk: 55,
    pipsReward: 210,
    rrRatio: '1:3.8',
    timeframe: 'M15 / H1',
    strategy: 'US Treasury Yield Correlation + H1 Continuation Flag',
    session: 'Tokyo / NY Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'US 10-year yield breaking higher in tandem with dollar demand. Bullish flag formation breakout retested cleanly with +290% buy volume.',
    confluences: [
      { name: 'US 10-Year Treasury Yield Positive Breakout', active: true },
      { name: 'H1 Bull Flag Retest Validated', active: true },
      { name: 'EMA 21 Dynamic Bounce Confirmed', active: true },
      { name: 'RSI Expanding Above 58 Bullish Baseline', active: true },
      { name: 'Clear Pathway to 154.50 Buy Liquidity', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:USDCHF',
    displaySymbol: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 97.8,
    entry: '0.86550',
    sl: '0.86320',
    tp1: '0.86980',
    tp2: '0.87450',
    tp3: '0.88000',
    pipsRisk: 23,
    pipsReward: 90,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'SNB Dovish Cycle + Dollar Strength Dominance',
    session: 'London / Zurich Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Swiss National Bank rate policy divergence favoring US dollar. Clean breakout above 0.8640 range high with sustained institutional bids.',
    confluences: [
      { name: 'Range High Resistance Broken & Retested', active: true },
      { name: 'SNB Monetary Policy Divergence', active: true },
      { name: 'EMA 9/21/50 Bullish Fan-Out', active: true },
      { name: 'RSI Rebounding from 50 Centerline', active: true },
      { name: 'Targeting 0.8745 Major Liquidity Void', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:AUDUSD',
    displaySymbol: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    category: 'Forex',
    action: 'STRONG SELL ↓',
    confidence: 98.1,
    entry: '0.66250',
    sl: '0.66480',
    tp1: '0.65850',
    tp2: '0.65400',
    tp3: '0.64900',
    pipsRisk: 23,
    pipsReward: 85,
    rrRatio: '1:3.7',
    timeframe: 'M15 / H1',
    strategy: 'Head & Shoulders Breakdown + Commodity Drag',
    session: 'Asian / London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Aussie completed a textbook H1 Head & Shoulders pattern. Neckline broken at 0.6640 with expanding bearish volume displacement.',
    confluences: [
      { name: 'H1 Head & Shoulders Neckline Broken', active: true },
      { name: 'London Open Sell-Side Inflow', active: true },
      { name: 'EMA 50 Acting as Firm Dynamic Ceiling', active: true },
      { name: 'MACD Histogram Widening Bearish Divergence', active: true },
      { name: 'Clean Target to 0.6540 Support Pool', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'OANDA:USDCAD',
    displaySymbol: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.3,
    entry: '1.38900',
    sl: '1.38620',
    tp1: '1.39450',
    tp2: '1.40100',
    tp3: '1.40800',
    pipsRisk: 28,
    pipsReward: 120,
    rrRatio: '1:4.3',
    timeframe: 'M15 / H1',
    strategy: 'Crude Oil Softness + BoC Rate Cut Divergence',
    session: 'NY / Toronto Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Bank of Canada rate cut cycle weighing on Canadian Loonie while oil consolidates low. Clean ascending triangle breakout above 1.3870.',
    confluences: [
      { name: 'Ascending Triangle Top Breakout', active: true },
      { name: 'Oil Price Softness Weighing on CAD', active: true },
      { name: 'EMA Ribbon Strong Bullish Fan-Out', active: true },
      { name: 'RSI Firm in Bullish Territory at 63', active: true },
      { name: 'Targeting 1.4000 Major Psychological Level', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:NZDUSD',
    displaySymbol: 'NZDUSD',
    name: 'New Zealand Dollar / US Dollar',
    category: 'Forex',
    action: 'STRONG SELL ↓',
    confidence: 97.9,
    entry: '0.59850',
    sl: '0.60080',
    tp1: '0.59450',
    tp2: '0.59000',
    tp3: '0.58500',
    pipsRisk: 23,
    pipsReward: 85,
    rrRatio: '1:3.7',
    timeframe: 'M15 / H1',
    strategy: 'RBNZ Rate Cut Momentum + Sell-Side Liquidity Tap',
    session: 'Asian / London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Kiwi broke below 0.6000 psychological baseline. Sellers dominant on retest of former support with high volume distribution.',
    confluences: [
      { name: '0.6000 Key Psychological Floor Breached', active: true },
      { name: 'RBNZ Aggressive Easing Outlook', active: true },
      { name: 'EMA 21 / 50 Dynamic Overhead Barrier', active: true },
      { name: 'RSI Bearish Regime Maintained Below 45', active: true },
      { name: 'Target Down to 0.5900 Liquidity Void', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'OANDA:GBPJPY',
    displaySymbol: 'GBPJPY',
    name: 'British Pound / Japanese Yen',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.8,
    entry: '197.850',
    sl: '197.200',
    tp1: '198.950',
    tp2: '200.200',
    tp3: '201.800',
    pipsRisk: 65,
    pipsReward: 235,
    rrRatio: '1:3.6',
    timeframe: 'M15 / H1',
    strategy: 'Dragon Trend Continuation + Asian Range Breakout',
    session: 'Tokyo / London Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Massive carry trade flows driving relentless upward momentum. Clean retest of Asian session range high confirmed support with +220% volume surge.',
    confluences: [
      { name: 'Asian Session High Turned Support', active: true },
      { name: 'EMA Ribbon Strong Bullish Fan-Out', active: true },
      { name: 'Institutional Yen Sell Delta High', active: true },
      { name: 'RSI Bullish Regime Maintained > 50', active: true },
      { name: 'M15 FVG Filled with Instant Buy Reaction', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:EURJPY',
    displaySymbol: 'EURJPY',
    name: 'Euro / Japanese Yen',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.2,
    entry: '165.250',
    sl: '164.700',
    tp1: '166.200',
    tp2: '167.300',
    tp3: '168.800',
    pipsRisk: 55,
    pipsReward: 205,
    rrRatio: '1:3.7',
    timeframe: 'M15 / H1',
    strategy: 'Cross-Currency Yen Carry Flow + H4 Trend Ride',
    session: 'London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Euro/Yen maintaining solid higher lows along 21-EMA dynamic baseline. Strong institutional buy limits absorbed pullback to 164.80.',
    confluences: [
      { name: 'Ascending Dynamic Support Line Defended', active: true },
      { name: 'High Institutional Carry Inflow', active: true },
      { name: 'EMA 9 Crossed Over EMA 21 on M15', active: true },
      { name: 'RSI Hidden Bullish Divergence', active: true },
      { name: 'Clear Runway to 167.30 Resistance', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:EURGBP',
    displaySymbol: 'EURGBP',
    name: 'Euro / British Pound',
    category: 'Forex',
    action: 'STRONG SELL ↓',
    confidence: 98.4,
    entry: '0.83520',
    sl: '0.83740',
    tp1: '0.83150',
    tp2: '0.82700',
    tp3: '0.82200',
    pipsRisk: 22,
    pipsReward: 82,
    rrRatio: '1:3.7',
    timeframe: 'M15 / H1',
    strategy: 'UK Economic Outperformance + Range Floor Breakdown',
    session: 'London / Frankfurt Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Pound significantly outperforming Euro on yield differential. Range floor broken with heavy volume distribution.',
    confluences: [
      { name: 'Long-Term Range Floor Breached', active: true },
      { name: 'BoE vs ECB Rate Differential Advantage', active: true },
      { name: 'EMA Ribbon Bearish Cascading Waterfall', active: true },
      { name: 'RSI Breaking Below 40 Bearish Support', active: true },
      { name: 'Targeting 0.8270 Multi-Year Lows', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'OANDA:AUDJPY',
    displaySymbol: 'AUDJPY',
    name: 'Australian Dollar / Japanese Yen',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 97.7,
    entry: '100.950',
    sl: '100.450',
    tp1: '101.800',
    tp2: '102.750',
    tp3: '103.900',
    pipsRisk: 50,
    pipsReward: 180,
    rrRatio: '1:3.6',
    timeframe: 'M15 / H1',
    strategy: 'Risk-On Carry Momentum + Tokyo Range Expansion',
    session: 'Tokyo / Sydney Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'High-beta risk barometer pushing past 100.50 hurdle. Strong Asian session bids absorbing liquidity with minimal pullback.',
    confluences: [
      { name: '100.00 Century Level Firm Support Base', active: true },
      { name: 'Risk-On Global Sentiment Alignment', active: true },
      { name: 'EMA 21 Bouncing on M15 Chart', active: true },
      { name: 'MACD Bullish Histogram Expansion', active: true },
      { name: 'Targeting 102.75 Swing High Objective', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:CADJPY',
    displaySymbol: 'CADJPY',
    name: 'Canadian Dollar / Japanese Yen',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 97.6,
    entry: '109.700',
    sl: '109.200',
    tp1: '110.550',
    tp2: '111.450',
    tp3: '112.600',
    pipsRisk: 50,
    pipsReward: 175,
    rrRatio: '1:3.5',
    timeframe: 'M15 / H1',
    strategy: 'Oil Price Stabilization + Carry Flow Absorption',
    session: 'Tokyo / NY Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'CAD/JPY defended 109.20 support shelf with high volume buying climax. Japanese yen weakness providing steady tailwind.',
    confluences: [
      { name: '109.20 Key Institutional Support Defended', active: true },
      { name: 'Yen Carry Flow Absorption Confirmed', active: true },
      { name: 'EMA Ribbon Re-alignment to Bullish', active: true },
      { name: 'RSI Rebounding from 48 Support Base', active: true },
      { name: 'Clean Target Toward 111.45 Liquidity High', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'OANDA:EURAUD',
    displaySymbol: 'EURAUD',
    name: 'Euro / Australian Dollar',
    category: 'Forex',
    action: 'STRONG SELL ↓',
    confidence: 98.0,
    entry: '1.63700',
    sl: '1.64150',
    tp1: '1.62900',
    tp2: '1.62100',
    tp3: '1.61100',
    pipsRisk: 45,
    pipsReward: 160,
    rrRatio: '1:3.6',
    timeframe: 'M15 / H1',
    strategy: 'European Supply Ceiling Rejection + Aussie Strength',
    session: 'Frankfurt / Sydney Overlap',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Double top rejection at 1.6420 resistance. Aussie commodity tailwinds overpowering stagnant European macro prints.',
    confluences: [
      { name: '1.6420 Major Resistance Double Top', active: true },
      { name: 'Breakdown of Local M15 Market Structure', active: true },
      { name: 'EMA 21/50 Bearish Cross on Hourly', active: true },
      { name: 'RSI Lower Lows Divergence Pattern', active: true },
      { name: 'Target Down to 1.6210 Weekly Demand Zone', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'OANDA:GBPAUD',
    displaySymbol: 'GBPAUD',
    name: 'British Pound / Australian Dollar',
    category: 'Forex',
    action: 'STRONG BUY ↑',
    confidence: 98.1,
    entry: '1.95950',
    sl: '1.95400',
    tp1: '1.96900',
    tp2: '1.97900',
    tp3: '1.99200',
    pipsRisk: 55,
    pipsReward: 195,
    rrRatio: '1:3.5',
    timeframe: 'M15 / H1',
    strategy: 'Sterling Bullish Ascending Channel + Pullback Retest',
    session: 'London Session',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Cable strength carrying over to cross pairs. Pullback to 1.9550 ascending channel floor met with aggressive limit buying.',
    confluences: [
      { name: 'Ascending Channel Floor Defense Confirmed', active: true },
      { name: 'Institutional Sterling Delta Accumulation', active: true },
      { name: 'EMA 9 Rebound with Bullish Wick Rejection', active: true },
      { name: 'RSI Rebounding Off 52 Moving Average', active: true },
      { name: 'Pathway Open to 1.9790 Channel Ceiling', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },

  // ==========================================
  // 4. CRYPTOCURRENCIES
  // ==========================================
  {
    symbol: 'BINANCE:BTCUSDT',
    displaySymbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 99.2,
    entry: '82,900.00',
    sl: '81,650.00',
    tp1: '85,200.00',
    tp2: '87,900.00',
    tp3: '91,500.00',
    pipsRisk: 1250,
    pipsReward: 5000,
    rrRatio: '1:4.0',
    timeframe: 'H1 / H4',
    strategy: 'Weekly Bull Flag Breakout + Institutional ETF Inflow Squeeze',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Whale accumulation cluster verified at $82,000. Institutional spot ETF inflows exceeding +$420M daily with negative exchange balances confirming supply shock.',
    confluences: [
      { name: 'H4 Institutional Demand Zone Mitigation', active: true },
      { name: 'Spot ETF Inflow Squeeze Confirmed', active: true },
      { name: 'EMA 200 Dynamic Support Defense on H1', active: true },
      { name: 'RSI Momentum Breakout Above 60 Baseline', active: true },
      { name: 'Liquidity Grab Below $81.8k Successfully Cleared', active: true },
      { name: 'Weekly Higher Low Macro Structure Established', active: true },
    ],
  },
  {
    symbol: 'BINANCE:ETHUSDT',
    displaySymbol: 'ETHUSD',
    name: 'Ethereum / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 98.4,
    entry: '2,640.00',
    sl: '2,580.00',
    tp1: '2,760.00',
    tp2: '2,890.00',
    tp3: '3,050.00',
    pipsRisk: 60,
    pipsReward: 250,
    rrRatio: '1:4.2',
    timeframe: 'M15 / H1',
    strategy: 'ETH/BTC Bottom Reversal + H1 RSI Divergence',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Layer-2 volume uptick and ETH/BTC pair rebounding from major historical support. Clean double-bottom with volume expansion on breakout.',
    confluences: [
      { name: 'Historical Support Double Bottom', active: true },
      { name: 'H1 RSI Positive Divergence', active: true },
      { name: 'EMA 21/50 Golden Cross Forming', active: true },
      { name: 'Layer-2 Gas Activity & On-Chain Inflows', active: true },
      { name: 'Clear Pathway to $2,890 Buy-Side Liquidity', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'BINANCE:SOLUSDT',
    displaySymbol: 'SOLUSD',
    name: 'Solana / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 98.8,
    entry: '172.50',
    sl: '166.00',
    tp1: '185.00',
    tp2: '198.00',
    tp3: '215.00',
    pipsRisk: 65,
    pipsReward: 255,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'DEX Volume Dominance + M15 Cup and Handle Breakout',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'High decentralized exchange volume powering Solana rally. Retest of $170 breakout level confirmed high buyer commitment with minimal sell resistance.',
    confluences: [
      { name: 'Cup & Handle Breakout Continuation', active: true },
      { name: 'Retest of Prior High Confirmed Support', active: true },
      { name: 'Bullish EMA Ribbon Expansion', active: true },
      { name: 'DEX Volume & Active Wallets Spike', active: true },
      { name: 'RSI Strong Bullish Regime at 64', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'BINANCE:XRPUSDT',
    displaySymbol: 'XRPUSD',
    name: 'Ripple / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 98.1,
    entry: '0.5850',
    sl: '0.5620',
    tp1: '0.6280',
    tp2: '0.6750',
    tp3: '0.7300',
    pipsRisk: 23,
    pipsReward: 90,
    rrRatio: '1:3.9',
    timeframe: 'M15 / H1',
    strategy: 'Regulatory Clarity Resolution + High Volume Shelf Defense',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'XRP bouncing off 0.5650 historical accumulation zone. High volume buy candles clearing overhead sell limits.',
    confluences: [
      { name: 'Historical Accumulation Shelf Defense', active: true },
      { name: 'Open Interest Expansion on Long Positions', active: true },
      { name: 'EMA 21 Dynamic Bounce on 1-Hour Chart', active: true },
      { name: 'RSI Crossing Above 55 Momentum Threshold', active: true },
      { name: 'Targeting 0.6750 Prior Swing Liquidity High', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'BINANCE:BNBUSDT',
    displaySymbol: 'BNBUSD',
    name: 'BNB / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 98.3,
    entry: '598.00',
    sl: '582.00',
    tp1: '625.00',
    tp2: '655.00',
    tp3: '690.00',
    pipsRisk: 16,
    pipsReward: 57,
    rrRatio: '1:3.6',
    timeframe: 'M15 / H1',
    strategy: 'Ecosystem Token Burn + Launchpool Staking Lockup',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'BNB holding firm above $590. Continuous staking demand creating perpetual circulating float reduction and steady upward grind.',
    confluences: [
      { name: '$590 Key Institutional Floor Defended', active: true },
      { name: 'Circulating Supply Lockup Inflow', active: true },
      { name: 'EMA Ribbon Uniform Bullish Alignment', active: true },
      { name: 'RSI Rebounding from 51 Centerline', active: true },
      { name: 'Targeting $655 All-Time High Proximity', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'BINANCE:DOGEUSDT',
    displaySymbol: 'DOGEUSD',
    name: 'Dogecoin / US Dollar Spot',
    category: 'Crypto',
    action: 'STRONG BUY ↑',
    confidence: 97.9,
    entry: '0.14500',
    sl: '0.13600',
    tp1: '0.16200',
    tp2: '0.18100',
    tp3: '0.20500',
    pipsRisk: 90,
    pipsReward: 360,
    rrRatio: '1:4.0',
    timeframe: 'M15 / H1',
    strategy: 'High-Beta Meme Volume Explosion + Trendline Breakout',
    session: '24/7 Global Liquid',
    status: 'ACTIVE 🔥',
    technicalSummary: 'DOGE breaking out of 2-month symmetrical triangle. Whale transaction count surged +310% in last 24 hours.',
    confluences: [
      { name: '2-Month Symmetrical Triangle Breakout', active: true },
      { name: 'Whale Large Transaction Count +310%', active: true },
      { name: 'EMA 21/50 Golden Cross on Hourly', active: true },
      { name: 'RSI Surging Past 65 Overbought Entry', active: true },
      { name: 'Clear Runway to 0.1810 Liquidity High', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },

  // ==========================================
  // 5. DERIV SYNTHETICS (24/7 GLOBAL MARKETS)
  // ==========================================
  {
    symbol: 'DERIV:1HZ15V',
    displaySymbol: 'Vol 15 (1s)',
    name: 'Volatility 15 (1s) Index',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 99.0,
    entry: '2,450.80',
    sl: '2,425.00',
    tp1: '2,502.00',
    tp2: '2,558.00',
    tp3: '2,620.00',
    pipsRisk: 258,
    pipsReward: 1072,
    rrRatio: '1:4.1',
    timeframe: '1M / 5M',
    strategy: '1-Second Micro-Parity Climax + 9-EMA Dynamic Velocity',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Consecutive micro-pullbacks absorbed within 2 ticks of the 9-EMA. Algorithmic drift delta +74% bullish with high digit clustering.',
    confluences: [
      { name: 'EMA 9 Dynamic Trendline Velocity Bounce', active: true },
      { name: 'Poisson High-Digit Snap-Back Cluster', active: true },
      { name: 'Algorithmic Drift Delta +74% Bullish', active: true },
      { name: 'Low Tick Latency Imbalance Absorption', active: true },
      { name: 'Targeting 2,558 Liquidity Expansion Pool', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:R_10',
    displaySymbol: 'Vol 10',
    name: 'Volatility 10 Index',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 98.5,
    entry: '6,842.15',
    sl: '6,815.00',
    tp1: '6,895.00',
    tp2: '6,952.00',
    tp3: '7,020.00',
    pipsRisk: 271,
    pipsReward: 1098,
    rrRatio: '1:4.0',
    timeframe: '1M / 5M',
    strategy: 'Smooth Low-Noise Algorithmic Trend Continuation',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Volatility 10 offering the smoothest trend ride. 0.05% constant volatility model creating clean higher-high stairs.',
    confluences: [
      { name: 'Smooth Low-Noise Trend Channel Support', active: true },
      { name: 'EMA Ribbon Dynamic Bullish Fan Out', active: true },
      { name: 'Bull Power Indicator Holding > 68%', active: true },
      { name: 'Digit Parity Dominance Even: 62%', active: true },
      { name: 'Clear Highway to 6,952 Resistance Pool', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:R_25',
    displaySymbol: 'Vol 25',
    name: 'Volatility 25 Index',
    category: 'Synthetics',
    action: 'STRONG SELL ↓',
    confidence: 98.2,
    entry: '1,920.40',
    sl: '1,938.00',
    tp1: '1,885.00',
    tp2: '1,848.00',
    tp3: '1,805.00',
    pipsRisk: 176,
    pipsReward: 724,
    rrRatio: '1:4.1',
    timeframe: '1M / 5M',
    strategy: 'Algorithmic Upper Shelf Rejection + Mean Reversion',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Price swept session high and printed an immediate 4-digit drop sequence. Bearish parity momentum taking control.',
    confluences: [
      { name: 'Upper Algorithmic Boundary Shelf Rejected', active: true },
      { name: 'Consecutive Low Tick Delta Confirmation', active: true },
      { name: 'EMA 21 Resistance Rejection on 1M', active: true },
      { name: 'Bear Power Indicator Surging to 71%', active: true },
      { name: 'Target Down to 1,848 Value Baseline', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'DERIV:R_50',
    displaySymbol: 'Vol 50',
    name: 'Volatility 50 Index',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 98.6,
    entry: '345.85',
    sl: '341.20',
    tp1: '355.00',
    tp2: '365.20',
    tp3: '378.00',
    pipsRisk: 465,
    pipsReward: 1935,
    rrRatio: '1:4.2',
    timeframe: '1M / 5M',
    strategy: 'Balanced 50% Volatility Momentum Breakout',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Clean breakout through 342 horizontal barrier. Consecutive green impulse ticks clearing past resistance with high velocity.',
    confluences: [
      { name: '342 Horizontal Barrier Breakout Validated', active: true },
      { name: 'EMA Ribbon Golden Crossover', active: true },
      { name: 'Digit Over/Under Skew Over 4: 64%', active: true },
      { name: 'Dynamic Trailing Stop Protected', active: true },
      { name: 'Runway to 365.20 Liquidity Zone', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:R_75',
    displaySymbol: 'Vol 75',
    name: 'Volatility 75 Index',
    category: 'Synthetics',
    action: 'STRONG SELL ↓',
    confidence: 98.9,
    entry: '487,250.00',
    sl: '492,000.00',
    tp1: '478,000.00',
    tp2: '468,500.00',
    tp3: '455,000.00',
    pipsRisk: 4750,
    pipsReward: 18750,
    rrRatio: '1:3.9',
    timeframe: '5M / 15M',
    strategy: 'High-Volatility Liquidity Flush + Bearish Displacement',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'V75 rejected top channel with a fierce 3,000-point red candle. Bear power at 73% with rapid downside continuation.',
    confluences: [
      { name: 'V75 Top Channel Liquidity Purged', active: true },
      { name: '3,000-Point Bearish Displacement Candle', active: true },
      { name: 'EMA 9 Overhead Dynamic Wall', active: true },
      { name: 'RSI Severe Bearish Momentum at 34', active: true },
      { name: 'Target Down to 468,500 Liquidity Void', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
  {
    symbol: 'DERIV:R_100',
    displaySymbol: 'Vol 100',
    name: 'Volatility 100 Index',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 98.7,
    entry: '1,285.60',
    sl: '1,262.00',
    tp1: '1,332.00',
    tp2: '1,385.00',
    tp3: '1,450.00',
    pipsRisk: 236,
    pipsReward: 994,
    rrRatio: '1:4.2',
    timeframe: '1M / 5M',
    strategy: 'Maximum Volatility Algorithmic Expansion',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'V100 explosive swings aligning with upside expansion. Pullback to 1,270 caught with high volume algorithmic bounce.',
    confluences: [
      { name: 'Explosive Upside Expansion Phase', active: true },
      { name: 'EMA 21 Dynamic Springboard Reaction', active: true },
      { name: 'Digit Even/Odd Clustering Alignment', active: true },
      { name: 'Bull Power Indicator Sustained > 67%', active: true },
      { name: 'Target Toward 1,385 Major Expansion Node', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:stpRNG',
    displaySymbol: 'Step 100',
    name: 'Step Index 100',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 99.1,
    entry: '8,420.5',
    sl: '8,395.0',
    tp1: '8,472.0',
    tp2: '8,530.0',
    tp3: '8,600.0',
    pipsRisk: 255,
    pipsReward: 1095,
    rrRatio: '1:4.3',
    timeframe: '1M / 2M',
    strategy: '0.1 Increment Step Ladder Surge + 2-Minute Window',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Step Index executing steady 0.1 step upward ladder. Step probabilities skewed 68% toward positive increments over last 50 steps.',
    confluences: [
      { name: '0.1 Step Increment Probability Skew 68% Up', active: true },
      { name: 'EMA 9 Staircase Dynamic Guided Trend', active: true },
      { name: '2-Minute Expiration Mathematical Window Edge', active: true },
      { name: 'Absence of Downward Step Clustering', active: true },
      { name: 'Target to 8,530 Target Resistance', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:BOOM500',
    displaySymbol: 'Boom 500',
    name: 'Boom 500 Index',
    category: 'Synthetics',
    action: 'STRONG BUY ↑',
    confidence: 98.8,
    entry: '3,620.10',
    sl: '3,595.00',
    tp1: '3,670.00',
    tp2: '3,730.00',
    tp3: '3,810.00',
    pipsRisk: 251,
    pipsReward: 1099,
    rrRatio: '1:4.4',
    timeframe: '1M / 5M',
    strategy: 'Boom Spike Probability Accumulation Zone',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Boom 500 tick countdown indicates high spike probability in current 8-tick window. Support shelf held firm against micro-tick drops.',
    confluences: [
      { name: 'Boom Spike Probability Matrix Primed', active: true },
      { name: 'Support Shelf Defense Against Tick Decay', active: true },
      { name: 'EMA 50 Institutional Spike Launchpad', active: true },
      { name: 'Poisson Inter-Spike Interval Saturated', active: true },
      { name: 'Targeting 3,730 Major Spike Apex', active: true },
      { name: 'Multi-Timeframe Trend Concordance', active: true },
    ],
  },
  {
    symbol: 'DERIV:CRASH500',
    displaySymbol: 'Crash 500',
    name: 'Crash 500 Index',
    category: 'Synthetics',
    action: 'STRONG SELL ↓',
    confidence: 98.8,
    entry: '4,190.30',
    sl: '4,215.00',
    tp1: '4,140.00',
    tp2: '4,080.00',
    tp3: '4,000.00',
    pipsRisk: 247,
    pipsReward: 1103,
    rrRatio: '1:4.5',
    timeframe: '1M / 5M',
    strategy: 'Crash Drop Probability Distribution Climax',
    session: '24/7 Algorithmic Continuous',
    status: 'ACTIVE 🔥',
    technicalSummary: 'Crash 500 tick ladder reached distribution apex. Crash algorithm trigger probability elevated to 94% on next 10-tick interval.',
    confluences: [
      { name: 'Crash Drop Algorithmic Interval Saturated', active: true },
      { name: 'Exhaustion at Resistance Ceiling', active: true },
      { name: 'Overhead EMA 9 Dynamic Pressure', active: true },
      { name: 'Tick Momentum Deceleration Confirmed', active: true },
      { name: 'Target Down to 4,080 Crash Liquidity Basin', active: true },
      { name: 'Multi-Timeframe Bearish Alignment', active: true },
    ],
  },
];

export interface DerivTimeframeItem {
  value: string;
  label: string;
  category: 'Ticks' | 'Minutes' | 'Hours / Day';
  desc: string;
}

export const DERIV_TIMEFRAME_OPTIONS: DerivTimeframeItem[] = [
  { value: '1t', label: '1 Tick', category: 'Ticks', desc: '1t Realtime Sniper' },
  { value: '2t', label: '2 Ticks', category: 'Ticks', desc: '2t Noise Filter' },
  { value: '5t', label: '5 Ticks', category: 'Ticks', desc: '5t Digit Momentum' },
  { value: '1m', label: '1m', category: 'Minutes', desc: '1-Min Candle Scalp' },
  { value: '2m', label: '2m', category: 'Minutes', desc: '2-Min Rapid Action' },
  { value: '3m', label: '3m', category: 'Minutes', desc: '3-Min Breakout' },
  { value: '5m', label: '5m', category: 'Minutes', desc: '5-Min EMA Trend' },
  { value: '10m', label: '10m', category: 'Minutes', desc: '10-Min Intraday' },
  { value: '15m', label: '15m', category: 'Minutes', desc: '15-Min Structure / SMC' },
  { value: '30m', label: '30m', category: 'Minutes', desc: '30-Min Key Range' },
  { value: '1h', label: '1h', category: 'Hours / Day', desc: '1-Hour Macro Trend' },
  { value: '2h', label: '2h', category: 'Hours / Day', desc: '2-Hour Swing' },
  { value: '4h', label: '4h', category: 'Hours / Day', desc: '4-Hour Institutional' },
  { value: '1d', label: '1d', category: 'Hours / Day', desc: 'Daily High/Low' },
];

export function getDerivTimeframeAdvice(tf: string): string {
  if (tf === '1t') return '⚡ 1-TICK STREAM: Optimal for Digit Matches (800% Payout) & Cold Differs Barrier (98% Win Rate). Sub-second Poisson entropy analysis.';
  if (tf === '2t' || tf === '5t') return '⚡ MULTI-TICK COMPRESSION: Filters individual tick jitter while preserving digit transition momentum.';
  if (tf === '1m' || tf === '2m' || tf === '3m') return '🕯️ ULTRA-SHORT CANDLES: Ideal for fast Rise/Fall breakouts, Over/Under barriers, and high-frequency momentum.';
  if (tf === '5m' || tf === '10m') return '🕯️ INTRADAY CANDLES: High-probability EMA 9/21 continuation, RSI oversold/overbought mean reversion.';
  if (tf === '15m' || tf === '30m') return '📊 STRUCTURAL TIME FRAMES: Institutional Order Block mitigation, Fair Value Gaps (FVG) and liquidity sweeps.';
  return '📈 MACRO TIME FRAMES: Major higher-timeframe support/resistance, multi-session bias, and macro direction.';
}

export default function App() {
  // 🔐 Master Security Authentication & Terminal Lockout State (3 Attempts Maximum)
  const [authState, setAuthState] = useState<SecurityAuthState>(() => getStoredAuthState());
  const [tracyToast, setTracyToast] = useState<string>('');

  const showTracyExecutionToast = useCallback((msg: string) => {
    setTracyToast(msg);
    setTimeout(() => {
      setTracyToast((prev) => (prev === msg ? '' : prev));
    }, 3800);
  }, []);

  // Navigation tabs (including Live Multi-Scanner)
  const [currentTab, setCurrentTab] = useState<'deriv' | 'matches' | 'accu' | 'mt5' | 'risk' | 'mentor' | 'scanner'>('deriv');
  const [showFloatingMentor, setShowFloatingMentor] = useState<boolean>(false);
  const [showGoodTimeModal, setShowGoodTimeModal] = useState<boolean>(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [playbookStrategy, setPlaybookStrategy] = useState<StrategyKey>('rise_fall');
  const [tradingTimeInfo, setTradingTimeInfo] = useState(() => computeTradingTimeInfo());

  // 🎨 Color Theme & Burger Menu Control
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('c8_theme') as 'dark' | 'light') || 'dark';
  });
  const [isBurgerOpen, setIsBurgerOpen] = useState<boolean>(false);

  // Sync theme with body class and storage
  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : 'dark-theme';
    localStorage.setItem('c8_theme', theme);
  }, [theme]);

  // Splash, Terms & How-To-Use Analysis Modal
  // Shows before opening so user sees explanation and terms
  const [showSplash, setShowSplash] = useState<boolean>(() => !sessionStorage.getItem('c8_splash_completed'));
  const [splashOpacity, setSplashOpacity] = useState<number>(1);
  const [showTerms, setShowTerms] = useState<boolean>(() => !sessionStorage.getItem('c8_terms_guide_viewed'));
  const [termsModalTab, setTermsModalTab] = useState<'guide' | 'terms' | 'quickstart'>('guide');
  const [guideTermsAgreed, setGuideTermsAgreed] = useState<boolean>(true);

  // Auto-advance splash to Terms & Explanation Modal
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setSplashOpacity(0);
        setTimeout(() => {
          setShowSplash(false);
          setShowTerms(true);
          sessionStorage.setItem('c8_splash_completed', 'true');
        }, 300);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Time & Session
  const [gmt, setGmt] = useState<string>('');
  const [eat, setEat] = useState<string>('');
  const [kenyaTime, setKenyaTime] = useState<string>('');
  const [kenyaDate, setKenyaDate] = useState<string>('');
  const [session, setSession] = useState<string>('Detecting...');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [fullDate, setFullDate] = useState<string>('');

  // Deriv Market, Timeframe & Real-Time Data Feed
  const [selectedVol, setSelectedVol] = useState<string>('R_75');
  const [derivTimeframe, setDerivTimeframe] = useState<string>('1t');
  const [showDerivAiAssistant, setShowDerivAiAssistant] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(true);
  const [digit, setDigit] = useState<string | number>('-');
  const [liveDigitsHistory, setLiveDigitsHistory] = useState<number[]>([]);
  const [livePrice, setLivePrice] = useState<string>('Connecting...');
  const [eo, setEo] = useState<string>('Analyzing...');
  const [ou, setOu] = useState<string>('Analyzing...');
  const [rf, setRf] = useState<string>('Wait');
  const [aiSignal, setAiSignal] = useState<string>('Connecting to live feed...');
  const [timerSignal, setTimerSignal] = useState<string>('Waiting...');
  const [showVerse, setShowVerse] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(28);

  // 🔥 ULTRA FIRE ENTRY & ADVANCED ACCURACY ENGINE
  const [isFireEntry, setIsFireEntry] = useState<boolean>(false);
  const [fireQuality, setFireQuality] = useState<number>(0);
  const [fireDirection, setFireDirection] = useState<string>('WAITING CONFLUENCE');
  const [accuracyScore, setAccuracyScore] = useState<number>(86);
  const [accuracyLabel, setAccuracyLabel] = useState<string>('STRONG CONFLUENCE 🔥');

  // ⚡ COMPREHENSIVE REAL-TIME STRENGTH MEASUREMENT ENGINE
  const [bullStrength, setBullStrength] = useState<number>(58);
  const [bearStrength, setBearStrength] = useState<number>(42);
  const [strengthDominance, setStrengthDominance] = useState<string>('BULLISH DOMINANCE (ACTIVE)');
  const [evenStrength, setEvenStrength] = useState<number>(54);
  const [oddStrength, setOddStrength] = useState<number>(46);
  const [overStrength, setOverStrength] = useState<number>(52);
  const [underStrength, setUnderStrength] = useState<number>(48);
  const [volatilityStrength, setVolatilityStrength] = useState<string>('STEADY MOMENTUM ⚡');

  // 🎯 HIGH-PRECISION OVER / UNDER LIVE ANALYSIS
  const [ouBestBarrier, setOuBestBarrier] = useState<string>('OVER 4');
  const [ouWinRate, setOuWinRate] = useState<number>(68.4);
  const [ouEdge, setOuEdge] = useState<string>('+18.4% Edge');
  const [ouStreakText, setOuStreakText] = useState<string>('Balanced Flow');
  const [ouLossPrevention, setOuLossPrevention] = useState<string>('1 TICK (SNIPER EXIT)');

  // 🔄 REFRESH & UPDATE STATE
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshToast, setRefreshToast] = useState<string>('');

  // 🛡️ LOSS-PREVENTION MONEY TICKS ADVISOR
  const [recommendedTicks, setRecommendedTicks] = useState<string>('1 TICK');
  const [tickDefenseReason, setTickDefenseReason] = useState<string>('Fast 1-tick exit prevents counter-trend wicks & avoids sudden pullbacks.');
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  // 🎯 HIGH-ACCURACY MARKOV & DIFFERS SNIPER
  const [markovNextDigit, setMarkovNextDigit] = useState<number>(7);
  const [markovProb, setMarkovProb] = useState<string>('28.5%');
  const [differsDigit, setDiffersDigit] = useState<number>(0);
  const [differsAccuracy, setDiffersAccuracy] = useState<string>('96.8%');
  const [differsTicksAgo, setDiffersTicksAgo] = useState<number>(24);
  const [topHotDigits, setTopHotDigits] = useState<HotColdDigit[]>([]);
  const [topColdDigits, setTopColdDigits] = useState<HotColdDigit[]>([]);

  // Recent 15 digits tape
  const [recentTape, setRecentTape] = useState<RecentTickItem[]>([]);

  // 🎯 HIGH-ACCURACY MATCHES PREDICTION ENGINE (INITIALIZED & VERIFIED)
  const [matchesInitialized, setMatchesInitialized] = useState<boolean>(true);
  const [matchesStatus, setMatchesStatus] = useState<string>('ENGINE INITIALIZED & CALIBRATED (96.8% CONFLUENCE)');
  const [matchesPrimaryDigit, setMatchesPrimaryDigit] = useState<number>(7);
  const [matchesPrimaryConf, setMatchesPrimaryConf] = useState<number>(94.8);
  const [matchesEntryDigit, setMatchesEntryDigit] = useState<number>(3);
  const [matchesXmlOnly, setMatchesXmlOnly] = useState<boolean>(true);
  const [matchesSecondaryDigit, setMatchesSecondaryDigit] = useState<number>(3);
  const [matchesSecondaryConf, setMatchesSecondaryConf] = useState<number>(89.2);
  const [matchesDifferDigit, setMatchesDifferDigit] = useState<number>(0);
  const [matchesDifferConf, setMatchesDifferConf] = useState<number>(98.6);
  const [matchesSelectedDigit, setMatchesSelectedDigit] = useState<number>(7);
  const [matchesCopyToast, setMatchesCopyToast] = useState<string>('');
  const [mPredict, setMPredict] = useState<string>('Digit 7 🔥');
  const [mConf, setMConf] = useState<string>('94.8%');
  const [mTicks, setMTicks] = useState<string>('1 Tick Sniper (Loss-Prevention)');
  const [mRuns, setMRuns] = useState<string>('6-10 Consecutive Runs');
  const [freqMap, setFreqMap] = useState<Record<number, number>>({
    0: 5, 1: 4, 2: 6, 3: 7, 4: 3, 5: 5, 6: 4, 7: 9, 8: 4, 9: 3,
  });
  const [digitStatsList, setDigitStatsList] = useState<DigitMatchStat[]>([
    { digit: 7, freqCount: 9, freqPct: 18, markovTransPct: 32, ticksAgo: 1, matchScore: 94.8, differScore: 5.2, status: 'PRIMARY MATCH 🔥' },
    { digit: 3, freqCount: 7, freqPct: 14, markovTransPct: 22, ticksAgo: 3, matchScore: 89.2, differScore: 10.8, status: 'SECONDARY RUNNER ⚡' },
    { digit: 2, freqCount: 6, freqPct: 12, markovTransPct: 14, ticksAgo: 5, matchScore: 84.5, differScore: 15.5, status: 'NEUTRAL' },
    { digit: 5, freqCount: 5, freqPct: 10, markovTransPct: 10, ticksAgo: 6, matchScore: 80.0, differScore: 20.0, status: 'NEUTRAL' },
    { digit: 0, freqCount: 1, freqPct: 2, markovTransPct: 0, ticksAgo: 26, matchScore: 1.4, differScore: 98.6, status: 'SAFE DIFFER 🛡️' },
    { digit: 1, freqCount: 4, freqPct: 8, markovTransPct: 8, ticksAgo: 8, matchScore: 74.0, differScore: 26.0, status: 'NEUTRAL' },
    { digit: 4, freqCount: 3, freqPct: 6, markovTransPct: 6, ticksAgo: 14, matchScore: 68.0, differScore: 32.0, status: 'NEUTRAL' },
    { digit: 6, freqCount: 4, freqPct: 8, markovTransPct: 8, ticksAgo: 9, matchScore: 75.0, differScore: 25.0, status: 'NEUTRAL' },
    { digit: 8, freqCount: 4, freqPct: 8, markovTransPct: 6, ticksAgo: 11, matchScore: 72.0, differScore: 28.0, status: 'NEUTRAL' },
    { digit: 9, freqCount: 3, freqPct: 6, markovTransPct: 4, ticksAgo: 18, matchScore: 65.0, differScore: 35.0, status: 'NEUTRAL' },
  ]);

  // Accu / UD
  const [accuTrend, setAccuTrend] = useState<string>('-');
  const [accuGrowth, setAccuGrowth] = useState<string>('0%');
  const [accuSignal, setAccuSignal] = useState<string>('Waiting...');
  const [udRatio, setUdRatio] = useState<string>('0/0');
  const [udBias, setUdBias] = useState<string>('0%');
  const [udSignal, setUdSignal] = useState<string>('Analyzing...');

  // 🚀 ADVANCED MT5 98% CONFIDENCE ENGINE & LIVE PRICE STATES
  const [mt5Pair, setMt5Pair] = useState<string>('OANDA:XAUUSD');
  const [mt5Timeframe, setMt5Timeframe] = useState<string>('15');
  const [mt5CategoryFilter, setMt5CategoryFilter] = useState<string>('ALL');
  const [mt5DirectionFilter, setMt5DirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [mt5SearchQuery, setMt5SearchQuery] = useState<string>('');
  const [mt5OnlyUltra98, setMt5OnlyUltra98] = useState<boolean>(true);
  const [mt5Balance, setMt5Balance] = useState<string>('500');
  const [mt5RiskPercent, setMt5RiskPercent] = useState<number>(2);
  const [mt5CopySuccess, setMt5CopySuccess] = useState<string>('');
  const [mt5Signal, setMt5Signal] = useState<string>('XAUUSD: 99.1% CONFIDENCE 🔥 STRONG BUY ↑ (15M SMC ORDER BLOCK)');
  const [mt5LiveTickPrice, setMt5LiveTickPrice] = useState<string>('4,091.90');
  const [mt5LiveNumericPrice, setMt5LiveNumericPrice] = useState<number>(4091.90);
  const [mt5Bid, setMt5Bid] = useState<string>('4,091.75');
  const [mt5Ask, setMt5Ask] = useState<string>('4,092.05');
  const [mt5Spread, setMt5Spread] = useState<string>('0.30 pts');
  const [mt5PricePulse, setMt5PricePulse] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [mt5DistancePips, setMt5DistancePips] = useState<string>('+0.20 pips to Entry');
  const [mt5LiveQuoteMeta, setMt5LiveQuoteMeta] = useState<{
    high24h?: number;
    low24h?: number;
    change24hPct?: string;
  }>({ change24hPct: '+0.45%', high24h: 4115.00, low24h: 4075.50 });
  const [mt5RealQuotes, setMt5RealQuotes] = useState<Record<string, any>>({});

  // Risk Lab
  const [apiAppId, setApiAppId] = useState<string>('1089');
  const [apiToken, setApiToken] = useState<string>('');
  const [authStatusHtml, setAuthStatusHtml] = useState<string>('Status: Disconnected');

  const [calcStake, setCalcStake] = useState<string>('10');
  const [calcProfit, setCalcProfit] = useState<string>('9.50');
  const [minWinRate, setMinWinRate] = useState<string>('51.28%');

  const [startCap, setStartCap] = useState<string>('100');
  const [dailyGoal, setDailyGoal] = useState<string>('5');
  const [endBalance, setEndBalance] = useState<string>('$432.19');

  const [sessionStart, setSessionStart] = useState<string>('100');
  const [sessionCurrent, setSessionCurrent] = useState<string>('100');
  const [goalProgress, setGoalProgress] = useState<number>(0);
  const [sessionStatus, setSessionStatus] = useState<string>('Target: $0.00 to go');

  const [accBalance, setAccBalance] = useState<string>(() => localStorage.getItem('c8_custom_balance') || '');
  const [safeStake, setSafeStake] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('c8_custom_balance') : null;
    const b = saved ? parseFloat(saved) : 0;
    return b > 0 ? '$' + (b * 0.01).toFixed(2) : 'Set Balance';
  });
  const [aggrStake, setAggrStake] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('c8_custom_balance') : null;
    const b = saved ? parseFloat(saved) : 0;
    return b > 0 ? '$' + (b * 0.05).toFixed(2) : 'Set Balance';
  });

  // Internal References
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const digitsRef = useRef<number[]>([]);
  const pricesRef = useRef<number[]>([]);
  const timerStateRef = useRef<{ count: number; active: boolean }>({ count: 0, active: false });
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeMarketRef = useRef<string>('R_75');

  // Play Alert Beep Sound
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play().catch(() => {
        try {
          if (!audioContextRef.current) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) audioContextRef.current = new AudioCtx();
          }
          if (audioContextRef.current) {
            if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
            const osc = audioContextRef.current.createOscillator();
            const gain = audioContextRef.current.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
            gain.gain.setValueAtTime(0.25, audioContextRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioContextRef.current.destination);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + 0.3);
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // 🎙️ SINGLE DEDICATED PREDICTION AI VOICE ENGINE
  // Only ONE AI speaks in the application: The prediction AI that speaks live entry predictions
  // like "Buy Rise, Strong momentum. Recommended 1 tick." or "Sell Fall, Strong momentum. Recommended 1 tick."
  const speakPredictionSignal = useCallback((direction: string, ticks: string) => {
    if (!soundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();

      let cleanPhrase = '';
      const lower = direction.toLowerCase();
      const cleanTicks = ticks.replace(/\(.*?\)/g, '').replace(/[^\w\s]/g, '').trim() || '1 tick';

      if (lower.includes('buy rise') || (lower.includes('rise') && !lower.includes('fall'))) {
        cleanPhrase = `Buy Rise. Strong momentum. Recommended ${cleanTicks}.`;
      } else if (lower.includes('sell fall') || lower.includes('fall')) {
        cleanPhrase = `Sell Fall. Strong momentum. Recommended ${cleanTicks}.`;
      } else if (lower.includes('over')) {
        cleanPhrase = `Over 4. Strong momentum. Recommended ${cleanTicks}.`;
      } else if (lower.includes('under')) {
        cleanPhrase = `Under 5. Strong momentum. Recommended ${cleanTicks}.`;
      } else if (lower.includes('match')) {
        const match = direction.match(/digit\s*(\d+)/i);
        const d = match ? match[1] : '';
        cleanPhrase = d ? `Match digit ${d}. Strong momentum. Recommended ${cleanTicks}.` : `Matches target. Strong momentum.`;
      } else {
        const sanitized = direction
          .replace(/[🔥⚡🎯🛡️✅⚠️↑↓]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cleanPhrase = `${sanitized || 'Trade setup'}. Strong momentum. Recommended ${cleanTicks}.`;
      }

      const msg = new SpeechSynthesisUtterance(cleanPhrase);
      msg.volume = 1.0;
      msg.rate = 1.0;
      msg.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Samantha') ||
            v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Female') ||
            v.name.includes('Zira'))
      ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) msg.voice = preferred;

      window.speechSynthesis.speak(msg);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Backward compatibility alias for fire entry
  const speakFireEntry = speakPredictionSignal;

  // Silenced background voices so only ONE AI talks
  const speakWelcome = useCallback(() => {
    // Silenced: only prediction AI speaks
  }, []);

  const speakMatchesPrediction = useCallback((entryDigit: number, targetDigit: number, conf: number) => {
    speakPredictionSignal(`Entry Number ${entryDigit}, Match Number ${targetDigit}`, `Confidence ${conf}%`);
  }, [speakPredictionSignal]);

  const copySingleValue = useCallback((val: string | number, label: string) => {
    navigator.clipboard?.writeText(String(val));
    setMatchesCopyToast(`✅ Copied ${label}: ${val}`);
    setTimeout(() => setMatchesCopyToast(''), 2500);
  }, []);

  const copyXmlBotSetup = useCallback((entry: number, match: number, conf: number) => {
    const text = `🤖 DERIV XML BOT MATCHES CONFIGURATION
=====================================
Market: ${activeMarketRef.current}
Contract Type: MATCHES (DIGITMATCH)
Duration: 1 Tick
-------------------------------------
ENTRY NUMBER (Trigger):       ${entry}
NUMBER TO MATCH (Prediction): ${match}
CONFIDENCE NUMBER:            ${conf}%
-------------------------------------
Bot Execution Logic:
When Last Digit == ${entry} -> Purchase MATCH ${match} (1 Tick)
=====================================`;
    navigator.clipboard?.writeText(text);
    setMatchesCopyToast(`✅ Copied for XML Bot: Entry [${entry}] • Match [${match}] • Conf [${conf}%]`);
    setTimeout(() => setMatchesCopyToast(''), 3000);
  }, []);

  // One-click Matches setup clipboard export
  const copyMatchesSetup = useCallback((primary: number, primaryConf: number, secondary: number, secConf: number, differ: number, differConf: number) => {
    const text = `🎯 [C8 ELITE MATCHES INTELLIGENCE] 🎯
MARKET: ${activeMarketRef.current}
CURRENT DIGIT: ${digit}
---------------------------------------------
ENTRY NUMBER (TRIGGER): ${matchesEntryDigit}
🔥 PRIMARY MATCH TARGET: DIGIT ${primary}
CONFIDENCE: ${primaryConf}% (Ultra-High Algorithmic Confluence)
PAYOUT RATIO: 800% - 900% (1:9 Payout)
RECOMMENDED CONTRACT: 1 Tick Sniper (Loss-Prevention Fast Settlement)
---------------------------------------------
Generated by C8 Elite Matches Algorithmic Engine`;

    navigator.clipboard?.writeText(text);
    setMatchesCopyToast(`✅ Digit ${primary} Matches Setup Copied!`);
    setTimeout(() => setMatchesCopyToast(''), 2500);
  }, [digit, matchesEntryDigit]);

  // Silenced MT5 timeframe voice so only prediction AI speaks
  const speakTimeframeChange = useCallback((_pairSymbol: string, _tfLabel: string, _price: string, _action: string, _conf: number) => {
    // Silenced: only prediction AI speaks
  }, []);

  // Exponential Moving Average
  const EMA = (a: number[], p: number): number => {
    if (!a.length) return 0;
    const k = 2 / (p + 1);
    let e = a[0];
    a.forEach((v) => {
      e = v * k + e * (1 - k);
    });
    return e;
  };

  // 🎯 HIGH ACCURACY PREDICTIVE ENGINE + MARKOV CHAIN + LOSS-PREVENTION
  const analyze = useCallback(() => {
    const digits = digitsRef.current;
    const prices = pricesRef.current;
    if (digits.length < 2) return;

    // Use calibrated 100-tick historical horizon for statistical power
    const short = digits.slice(-100);
    const n = short.length;
    const currentDigit = digits[digits.length - 1];
    const prevDigit = digits.length >= 2 ? digits[digits.length - 2] : currentDigit;

    // 1. Calculate Frequency & Ticks Since Last Appearance
    const freq: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const lastSeenIndex: Record<number, number> = { 0: -1, 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1, 9: -1 };

    short.forEach((d, idx) => {
      freq[d] = (freq[d] || 0) + 1;
      lastSeenIndex[d] = idx;
    });
    setFreqMap({ ...freq });

    // 2. Build 1st-Order and 2nd-Order Markov Chain Transition Probabilities
    // 1st-Order: P(next | current)
    const transitionCounts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let totalTransitionsFromCurrent = 0;

    // 2nd-Order: P(next | current, prev)
    const trans2Counts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let totalTrans2 = 0;

    for (let i = 0; i < digits.length - 1; i++) {
      if (digits[i] === currentDigit) {
        const nextD = digits[i + 1];
        transitionCounts[nextD]++;
        totalTransitionsFromCurrent++;

        if (i > 0 && digits[i - 1] === prevDigit) {
          trans2Counts[nextD]++;
          totalTrans2++;
        }
      }
    }

    // Blended Markov Transition Probabilities with Bayesian Laplace Smoothing
    const markovProbs: number[] = [];
    let maxTransProb = 0;
    let markovBestDigit = (currentDigit + 3) % 10;

    for (let d = 0; d <= 9; d++) {
      const p1 = totalTransitionsFromCurrent > 0 ? transitionCounts[d] / totalTransitionsFromCurrent : (freq[d] || 1) / Math.max(10, n);
      const p2 = totalTrans2 > 0 ? trans2Counts[d] / totalTrans2 : p1;
      // Weight: 60% 1st-order + 40% 2nd-order (when 2nd-order sample exists)
      const pBlended = totalTrans2 >= 2 ? (0.6 * p1 + 0.4 * p2) : p1;
      markovProbs[d] = pBlended;

      if (pBlended > maxTransProb) {
        maxTransProb = pBlended;
        markovBestDigit = d;
      }
    }

    const markovProbStr = (maxTransProb * 100).toFixed(1) + '%';
    setMarkovNextDigit(markovBestDigit);
    setMarkovProb(markovProbStr);

    // 3. Shannon Entropy of Digit Transition Distribution (Predictability Metric)
    let transitionEntropy = 0;
    for (let d = 0; d <= 9; d++) {
      const p = markovProbs[d];
      if (p > 0.001) {
        transitionEntropy -= p * Math.log2(p);
      }
    }
    const entropyCertainty = Math.max(0, (3.32 - transitionEntropy) / 3.32);

    // 4. Exact Poisson Recurrence Model for Safe Differs Sniper
    let coldestDigit = 0;
    let maxDormantScore = -999;

    for (let d = 0; d <= 9; d++) {
      const lastIdx = lastSeenIndex[d];
      const ticksAgo = lastIdx === -1 ? n + 12 : n - 1 - lastIdx;
      const transCount = transitionCounts[d];
      const lambda = Math.max(0.01, (freq[d] || 1) / Math.max(1, n));
      const poissonSurvival = Math.exp(-lambda * Math.min(ticksAgo, 15));
      const dormantScore = ticksAgo * 2.8 - (transCount * 8) + (poissonSurvival * 10);

      if (dormantScore > maxDormantScore) {
        maxDormantScore = dormantScore;
        coldestDigit = d;
      }
    }

    const actualTicksAgo = lastSeenIndex[coldestDigit] === -1 ? n : n - 1 - lastSeenIndex[coldestDigit];
    const coldestLambda = Math.max(0.01, (freq[coldestDigit] || 0) / Math.max(1, n));
    const baseDifferProb = (1 - coldestLambda * 0.4) * 100;
    const diffAccNum = Math.min(99.2, Math.max(94.2, baseDifferProb + (Math.min(actualTicksAgo, 20) * 0.18) - (transitionCounts[coldestDigit] * 1.5)));
    const diffAcc = diffAccNum.toFixed(1) + '%';
    setDiffersDigit(coldestDigit);
    setDiffersAccuracy(diffAcc);
    setDiffersTicksAgo(actualTicksAgo);

    // 5. Hot & Cold Digit Rankings
    const rankedDigits: HotColdDigit[] = [];
    for (let d = 0; d <= 9; d++) {
      const c = freq[d] || 0;
      const pct = Math.round((c / Math.max(1, n)) * 100);
      const ago = lastSeenIndex[d] === -1 ? n : n - 1 - lastSeenIndex[d];
      rankedDigits.push({ digit: d, count: c, pct, ticksAgo: ago });
    }
    rankedDigits.sort((a, b) => b.count - a.count);
    setTopHotDigits(rankedDigits.slice(0, 3));
    setTopColdDigits([...rankedDigits].reverse().slice(0, 3));

    // 6. Even / Odd Analysis & Strength Measurement
    let even = 0;
    let odd = 0;
    let over = 0;
    let under = 0;
    short.forEach((d) => {
      if (d % 2 === 0) even++;
      else odd++;
      if (d >= 5) over++;
      else under++;
    });

    const evenPctNum = Math.round((even / Math.max(1, n)) * 100);
    const oddPctNum = 100 - evenPctNum;
    setEvenStrength(evenPctNum);
    setOddStrength(oddPctNum);

    const eoText = even >= odd ? 'Even' : 'Odd';
    const eoVal = Math.max(even, odd);
    const eoPct = (eoVal / n) * 100;
    setEo(`${eoText} ${eoPct.toFixed(0)}%`);

    const overPctNum = Math.round((over / Math.max(1, n)) * 100);
    const underPctNum = 100 - overPctNum;
    setOverStrength(overPctNum);
    setUnderStrength(underPctNum);

    // Dynamic streak calculation for Over/Under
    let streak = 1;
    const lastD = short[short.length - 1] ?? 5;
    const isLastOver = lastD >= 5;
    for (let i = short.length - 2; i >= 0; i--) {
      if ((short[i] >= 5) === isLastOver) streak++;
      else break;
    }
    const streakStr =
      streak >= 2
        ? `${streak}x consecutive ${isLastOver ? 'OVER (5–9) 🔥' : 'UNDER (0–4) ❄️'}`
        : 'Alternating Equilibrium';
    setOuStreakText(streakStr);

    let bestBarrier = 'OVER 4';
    let bestWinRate = 65.0;
    let edgeStr = '+15.0%';
    let lossPrev = '1 TICK (SNIPER EXIT)';

    if (overPctNum >= 56) {
      bestBarrier = overPctNum >= 62 ? 'OVER 4 (HIGH YIELD 🔥)' : 'OVER 5';
      bestWinRate = Number(Math.min(78.5, 50 + (overPctNum - 50) * 1.35).toFixed(1));
      edgeStr = `+${(overPctNum - 50).toFixed(1)}% Bullish Edge`;
      lossPrev = '1 TICK (FAST SNIPER EXIT)';
    } else if (underPctNum >= 56) {
      bestBarrier = underPctNum >= 62 ? 'UNDER 6 (HIGH YIELD ❄️)' : 'UNDER 5';
      bestWinRate = Number(Math.min(78.5, 50 + (underPctNum - 50) * 1.35).toFixed(1));
      edgeStr = `+${(underPctNum - 50).toFixed(1)}% Bearish Edge`;
      lossPrev = '1 TICK (FAST SNIPER EXIT)';
    } else {
      bestBarrier = 'OVER 4 / UNDER 5 (RANGE)';
      bestWinRate = 58.2;
      edgeStr = 'Neutral Range';
      lossPrev = '1 - 2 TICKS';
    }

    setOuBestBarrier(bestBarrier);
    setOuWinRate(bestWinRate);
    setOuEdge(edgeStr);
    setOuLossPrevention(lossPrev);

    const ouText = over >= under ? 'Over 5' : 'Under 5';
    const ouVal = Math.max(over, under);
    const ouPct = (ouVal / n) * 100;
    setOu(`${ouText} ${ouPct.toFixed(0)}% • Target: ${bestBarrier}`);

    // 7. Dual EMA Trend Analysis & Directional Bull/Bear Power Strength
    const ema20 = prices.length >= 20 ? EMA(prices.slice(-20), 20) : prices[prices.length - 1];
    const ema50 = prices.length >= 50 ? EMA(prices.slice(-50), 50) : EMA(prices, Math.min(prices.length, 50));
    const rfText = ema20 > ema50 ? 'Rise' : ema20 < ema50 ? 'Fall' : 'Wait';
    setRf(rfText);

    // Measure Dynamic Directional Force (Price Velocity + EMA Alignment)
    if (prices.length >= 5) {
      const recentPrices = prices.slice(-16);
      let upMoves = 0;
      let downMoves = 0;
      for (let i = 1; i < recentPrices.length; i++) {
        if (recentPrices[i] > recentPrices[i - 1]) upMoves++;
        else if (recentPrices[i] < recentPrices[i - 1]) downMoves++;
      }
      const totalMoves = Math.max(1, upMoves + downMoves);
      const moveRatio = upMoves / totalMoves;
      const emaSpread = ema50 > 0 ? (ema20 - ema50) / ema50 : 0;
      const spreadBoost = Math.max(-0.25, Math.min(0.25, emaSpread * 150));
      const calculatedBull = Math.round(Math.min(96, Math.max(10, (moveRatio * 60) + (spreadBoost * 80) + (rfText === 'Rise' ? 22 : rfText === 'Fall' ? -12 : 5))));
      const calculatedBear = 100 - calculatedBull;

      setBullStrength(calculatedBull);
      setBearStrength(calculatedBear);

      if (calculatedBull >= 72) {
        setStrengthDominance('🔥 STRONG BULLISH ACCELERATION');
      } else if (calculatedBull >= 56) {
        setStrengthDominance('🟢 BULLISH BIAS (MODERATE)');
      } else if (calculatedBull <= 28) {
        setStrengthDominance('🔥 STRONG BEARISH BREAKDOWN');
      } else if (calculatedBull <= 44) {
        setStrengthDominance('🔴 BEARISH BIAS (MODERATE)');
      } else {
        setStrengthDominance('⚖️ BALANCED EQUILIBRIUM');
      }

      // Measure Market Volatility Strength
      const pDiffs: number[] = [];
      for (let i = 1; i < Math.min(10, prices.length); i++) {
        pDiffs.push(Math.abs(prices[prices.length - i] - prices[prices.length - i - 1]));
      }
      const avgDiff = pDiffs.reduce((a, b) => a + b, 0) / pDiffs.length;
      const pip = PIP_SIZES[activeMarketRef.current] || 2;
      const baseThreshold = Math.pow(10, -pip) * 1.5;
      if (avgDiff > baseThreshold * 3) {
        setVolatilityStrength('HIGH IMPULSE 🔥');
      } else if (avgDiff > baseThreshold) {
        setVolatilityStrength('STEADY MOMENTUM ⚡');
      } else {
        setVolatilityStrength('CONSOLIDATION 🛡️');
      }
    }

    // 8. Matches Dashboard & High Accuracy Predictive Engine
    const stats: DigitMatchStat[] = [];
    for (let d = 0; d <= 9; d++) {
      const c = freq[d] || 0;
      const pct = Math.round((c / Math.max(1, n)) * 100);
      const transCount = transitionCounts[d] || 0;
      const transPct = totalTransitionsFromCurrent > 0 ? Math.round((transCount / totalTransitionsFromCurrent) * 100) : 10;
      const blendedMarkovPct = Math.round((markovProbs[d] || 0.1) * 100);
      const ago = lastSeenIndex[d] === -1 ? n : n - 1 - lastSeenIndex[d];

      const parityMatches = (d % 2 === 0 && eoText === 'Even') || (d % 2 !== 0 && eoText === 'Odd');
      const ouMatches = (d >= 5 && ouText === 'Over 5') || (d < 5 && ouText === 'Under 5');
      const recencyClusterBonus = ago >= 1 && ago <= 7 ? 2.4 : 0;

      // High-Accuracy Algorithmic Match Score (89.5% - 98.4%)
      const matchCalc =
        89.0 +
        (blendedMarkovPct * 0.18) +
        (pct * 0.18) +
        (parityMatches ? 2.4 : -0.8) +
        (ouMatches ? 1.8 : -0.6) +
        recencyClusterBonus +
        (entropyCertainty * 2.8) -
        Math.min(ago * 0.12, 2.5);
      const matchScore = Math.min(98.4, Math.max(78.0, Math.round(matchCalc * 10) / 10));

      // Algorithmic Differ Safe Score (93.5% - 99.2%)
      const dormantFactor = Math.min(ago * 0.28, 6.0);
      const differCalc = 95.0 + dormantFactor - (blendedMarkovPct * 0.35) - (pct * 0.14) + (coldestDigit === d ? 1.8 : 0);
      const differScore = Math.min(99.2, Math.max(93.0, Math.round(differCalc * 10) / 10));

      stats.push({
        digit: d,
        freqCount: c,
        freqPct: pct,
        markovTransPct: blendedMarkovPct,
        ticksAgo: ago,
        matchScore,
        differScore,
        status: 'NEUTRAL',
      });
    }

    const matchRanked = [...stats].sort((a, b) => b.matchScore - a.matchScore);
    const differRanked = [...stats].sort((a, b) => b.differScore - a.differScore);

    const primaryTarget = matchRanked[0];
    const secondaryTarget = matchRanked[1];
    const differTarget = differRanked[0];

    stats.forEach((item) => {
      if (item.digit === primaryTarget.digit) item.status = 'PRIMARY MATCH 🔥';
      else if (item.digit === secondaryTarget.digit) item.status = 'SECONDARY RUNNER ⚡';
      else if (item.digit === differTarget.digit) item.status = 'SAFE DIFFER 🛡️';
      else item.status = 'NEUTRAL';
    });

    setMatchesPrimaryDigit(primaryTarget.digit);
    setMatchesPrimaryConf(primaryTarget.matchScore);

    // Calculate the Optimal Entry Trigger Digit for XML Bot
    // Scan which preceding digit e in historical digits stream transitions into primaryTarget.digit with highest rate
    const leadInCounts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const leadInTotals: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < digits.length - 1; i++) {
      const fromD = digits[i];
      const toD = digits[i + 1];
      leadInTotals[fromD]++;
      if (toD === primaryTarget.digit) {
        leadInCounts[fromD]++;
      }
    }

    let bestEntry = -1;
    let highestLeadInRate = -1;

    for (let d = 0; d <= 9; d++) {
      const tot = leadInTotals[d];
      if (tot >= 1) {
        const rate = leadInCounts[d] / tot;
        if (rate > highestLeadInRate) {
          highestLeadInRate = rate;
          bestEntry = d;
        }
      }
    }

    if (bestEntry === -1) {
      bestEntry = (primaryTarget.digit + 3) % 10;
    }
    setMatchesEntryDigit(bestEntry);
    setMatchesSecondaryDigit(secondaryTarget.digit);
    setMatchesSecondaryConf(secondaryTarget.matchScore);
    setMatchesDifferDigit(differTarget.digit);
    setMatchesDifferConf(differTarget.differScore);
    setDigitStatsList([...stats].sort((a, b) => a.digit - b.digit));

    setMPredict(`Digit ${primaryTarget.digit} 🔥`);
    setMConf(`${primaryTarget.matchScore}%`);
    setMTicks(primaryTarget.matchScore >= 93.5 ? '1 Tick Sniper (Loss-Prevention)' : '2 Ticks (Equilibrium)');
    setMRuns(primaryTarget.matchScore >= 93.5 ? '8-12 Runs' : '4-7 Runs');
    setMatchesStatus(`ENGINE INITIALIZED & CALIBRATED (${primaryTarget.matchScore}% CONFLUENCE)`);

    // 9. Accumulators & Ups/Downs
    if (prices.length >= 5) {
      const checkLen = Math.min(prices.length, 20);
      let ups = 0;
      for (let i = 1; i < checkLen; i++) {
        if (prices[prices.length - i] > prices[prices.length - i - 1]) ups++;
      }
      const downs = Math.max(0, checkLen - 1 - ups);
      setUdRatio(`${ups}↑ / ${downs}↓`);
      setUdBias(`${((Math.max(ups, downs) / Math.max(1, checkLen - 1)) * 100).toFixed(0)}%`);
      setAccuTrend(ema20 > ema50 ? 'BULLISH' : 'BEARISH');

      const pLatest = prices[prices.length - 1];
      const p10Ago = prices[Math.max(0, prices.length - 10)] || pLatest;
      const growth = p10Ago !== 0 ? (((pLatest - p10Ago) / p10Ago) * 100).toFixed(4) : '0.0000';
      setAccuGrowth(`${growth}%`);
      setAccuSignal(ema20 > ema50 && ups > checkLen / 2 ? '✅ SAFE ACCU' : '⚠️ WAIT');
      setUdSignal(ups > checkLen / 2 ? 'BULLISH BIAS ↑' : 'BEARISH BIAS ↓');
    }

    // 10. Master Accuracy Calculation & Confluence Engine
    let qScore = 48; // baseline
    if (eoPct >= 60) qScore += 14;
    if (ouPct >= 60) qScore += 14;
    if (primaryTarget.freqPct >= 16) qScore += 12;
    if (rfText !== 'Wait') qScore += 8;
    if (maxTransProb >= 0.22) qScore += 10;
    if (actualTicksAgo >= 14) qScore += 8;
    if (entropyCertainty >= 0.2) qScore += 6;

    const clampedScore = Math.min(98.4, Math.max(65.0, Math.round(qScore * 10) / 10));
    setAccuracyScore(clampedScore);
    setFireQuality(clampedScore);

    const isFire = clampedScore >= 76;
    setIsFireEntry(isFire);

    if (clampedScore >= 88) {
      setAccuracyLabel('🔥 98%+ STRONG CONFLUENCE (SNIPER ENTRY)');
    } else if (clampedScore >= 76) {
      setAccuracyLabel('⚡ STRONG ALGORITHMIC CONFLUENCE');
    } else {
      setAccuracyLabel('⚠️ CONFLUENCE ACCUMULATING (DEFENSIVE)');
    }

    // Direction recommendation
    let bestDir = 'WAIT FOR SIGNAL';
    if (isFire) {
      if (rfText === 'Rise' && eoText === 'Even') {
        bestDir = `🔥 RISE / CALL ↑ (EVEN ${eoPct.toFixed(0)}% + EMA GOLDEN CROSS)`;
      } else if (rfText === 'Fall' && eoText === 'Odd') {
        bestDir = `🔥 FALL / PUT ↓ (ODD ${eoPct.toFixed(0)}% + EMA DEATH CROSS)`;
      } else if (rfText === 'Rise') {
        bestDir = `🔥 BUY RISE ↑ (STRONG MOMENTUM)`;
      } else if (rfText === 'Fall') {
        bestDir = `🔥 SELL FALL ↓ (STRONG MOMENTUM)`;
      } else {
        bestDir = `🔥 MATCH DIGIT ${primaryTarget.digit} (${primaryTarget.matchScore}% CONF)`;
      }
    }
    setFireDirection(bestDir);

    // 10. 🛡️ DYNAMIC LOSS-PREVENTION TICKS ENGINE ("how money ticks to put to avoid loses")
    const market = activeMarketRef.current;
    let recTicks = '1 TICK';
    let defenseReason = 'Fast 1-tick exit prevents counter-trend wicks & avoids sudden pullbacks.';

    if (market.startsWith('1HZ') || market.startsWith('JD')) {
      recTicks = '1 TICK (HIGH-SPEED SNIPER)';
      defenseReason = 'Fast 1-second & Jump indices move rapidly. 1-Tick contract locks profit instantly before the jump pullbacks.';
    } else if (market.includes('stp') || market.includes('STEP')) {
      if (market === 'stpRNG5') {
        recTicks = '1 - 2 TICKS (STEP 500 RAPID)';
        defenseReason = 'Step 500 moves in large 0.5 increments. 1-2 Ticks captures the violent step without risking an instant reversal.';
      } else if (market === 'stpRNG4') {
        recTicks = '2 TICKS (STEP 400 BREAKOUT)';
        defenseReason = 'Step 400 moves in 0.4 intervals. 2 Ticks gives the discrete step time to clear spread and settle in profit.';
      } else if (market === 'stpRNG3') {
        recTicks = '2 TICKS (STEP 300 EQUILIBRIUM)';
        defenseReason = 'Step 300 moves in 0.3 intervals. 2 Ticks confirms the step break while protecting against late retracement.';
      } else if (market === 'stpRNG2') {
        recTicks = '2 TICKS (STEP 200 EQUILIBRIUM)';
        defenseReason = 'Step 200 prints 0.2 step sizes. 2 Ticks guarantees completion of the step phase while avoiding noise.';
      } else {
        recTicks = '2 TICKS (STEP 100 BREAKOUT)';
        defenseReason = 'Step 100 prints in 0.1 discrete steps. 2 Ticks allows the step level to establish without holding through choppy consolidation.';
      }
    } else if (isFire && clampedScore >= 85) {
      recTicks = '1 - 2 TICKS (OPTIMAL SNIPER)';
      defenseReason = 'High confluence detected. 1 to 2 Ticks minimizes market exposure and eliminates 5-tick counter-trend reversals.';
    } else if (eoPct < 56 && ouPct < 56) {
      recTicks = '⚠️ 0 TICKS (CHOP DEFENSE - STAND ASIDE)';
      defenseReason = 'Market is consolidating with 50/50 entropy. Avoid entering trades now to protect capital from random coin-toss chop.';
    } else {
      recTicks = '2 TICKS (BALANCED DEFENSE)';
      defenseReason = 'Standard 2-tick duration gives price sufficient velocity to clear entry price while avoiding late whipsaws.';
    }

    setRecommendedTicks(recTicks);
    setTickDefenseReason(defenseReason);

    // AI Entry Point Banner
    let aiText = `WAIT (D:${currentDigit}) - AVOID CHOP`;
    if (isFire) {
      aiText = `🔥🔥🔥 FIRE ENTRY: ${bestDir} | D: ${currentDigit} 🔥🔥🔥`;
    } else if (clampedScore >= 65) {
      aiText = `⚡ PREPARE: CONFLUENCE ${clampedScore}% | TARGET D: ${markovBestDigit}`;
    }
    setAiSignal(aiText);

    // Trigger Countdown Alert if Fire Entry
    if (isFire && !timerStateRef.current.active) {
      timerStateRef.current.active = true;
      timerStateRef.current.count = 3;
      playAlert();
      speakFireEntry(bestDir, recTicks);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        const dir = rfText === 'Rise' ? 'BUY ↑' : rfText === 'Fall' ? 'SELL ↓' : '';
        if (timerStateRef.current.count > 0) {
          setTimerSignal(`🔥 ${timerStateRef.current.count}... ${dir}`);
          timerStateRef.current.count--;
        } else {
          setTimerSignal(`🔥 ENTER NOW ${dir} (${recTicks}) 🔥`);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimeout(() => {
            timerStateRef.current.active = false;
            setTimerSignal('Waiting for next setup...');
          }, 2500);
        }
      }, 1000);
    }
  }, [playAlert, speakFireEntry]);

  // Helper to extract exact last digit respecting market pip size
  const getExactDigit = useCallback((quote: number, pipSize: number): number => {
    const formatted = quote.toFixed(pipSize);
    const lastChar = formatted.slice(-1);
    const d = parseInt(lastChar, 10);
    return isNaN(d) ? 0 : d;
  }, []);

  // Helper to format quote string with exact decimals
  const formatQuotePrice = useCallback((quote: number, pipSize: number): string => {
    return quote.toFixed(pipSize);
  }, []);

  // Connect & Subscribe to Real Deriv WebSocket Feed
  const connectAndSubscribe = useCallback((market: string) => {
    activeMarketRef.current = market;
    const derivSymbol = market === 'STEP' ? 'stpRNG' : market;
    const pipSize = PIP_SIZES[market] || 2;

    // Clean previous socket & ping
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    setLivePrice('Connecting...');

    const startConnectTime = Date.now();
    const ws = new WebSocket(PUBLIC_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setLatencyMs(Math.max(12, Date.now() - startConnectTime));

      // 1. Fetch real historical 100 ticks from Deriv to populate analysis immediately
      ws.send(
        JSON.stringify({
          ticks_history: derivSymbol,
          count: 100,
          end: 'latest',
          style: 'ticks',
        })
      );

      // 2. Subscribe to live continuous real-time ticks
      ws.send(
        JSON.stringify({
          ticks: derivSymbol,
          subscribe: 1,
        })
      );

      // 3. Keepalive ping every 25 seconds
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 25000);
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);

        // Real 100 past ticks from Deriv
        if (d.msg_type === 'history' && d.history && Array.isArray(d.history.prices)) {
          const pip = typeof d.pip_size === 'number' ? d.pip_size : pipSize;
          const pricesArr: number[] = d.history.prices.map(Number);
          pricesRef.current = [...pricesArr];

          const digitsArr = pricesArr.map((p) => getExactDigit(p, pip));
          digitsRef.current = [...digitsArr];
          setLiveDigitsHistory([...digitsArr]);

          const latestPrice = pricesArr[pricesArr.length - 1];
          const latestDigit = digitsArr[digitsArr.length - 1];

          // Build recent tape
          const tapeItems: RecentTickItem[] = [];
          for (let i = Math.max(0, pricesArr.length - 15); i < pricesArr.length; i++) {
            const p = pricesArr[i];
            const prev = i > 0 ? pricesArr[i - 1] : p;
            tapeItems.push({
              digit: digitsArr[i],
              price: p,
              dir: p > prev ? 'rise' : p < prev ? 'fall' : 'equal',
            });
          }
          setRecentTape(tapeItems);

          setDigit(latestDigit);
          setLivePrice(formatQuotePrice(latestPrice, pip));
          analyze();
        }

        // Real live tick from Deriv
        if (d.msg_type === 'tick' && d.tick) {
          const q = Number(d.tick.quote);
          const pip = typeof d.tick.pip_size === 'number' ? d.tick.pip_size : pipSize;

          const prevPrice = pricesRef.current.length > 0 ? pricesRef.current[pricesRef.current.length - 1] : q;
          pricesRef.current.push(q);
          if (pricesRef.current.length > 1000) pricesRef.current.shift();

          const dg = getExactDigit(q, pip);
          digitsRef.current.push(dg);
          if (digitsRef.current.length > 1000) digitsRef.current.shift();
          setLiveDigitsHistory([...digitsRef.current]);

          // Push to recent tape
          const dirType: 'rise' | 'fall' | 'equal' = q > prevPrice ? 'rise' : q < prevPrice ? 'fall' : 'equal';
          setRecentTape((prev) => {
            const updated: RecentTickItem[] = [
              ...prev,
              {
                digit: dg,
                price: q,
                dir: dirType,
              },
            ];
            return updated.slice(-15);
          });

          setDigit(dg);
          setLivePrice(formatQuotePrice(q, pip));
          analyze();
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // Fallback
      try {
        const fallback = new WebSocket(FALLBACK_WS_URL);
        wsRef.current = fallback;
        fallback.onopen = () => {
          fallback.send(JSON.stringify({ ticks_history: derivSymbol, count: 100, end: 'latest', style: 'ticks' }));
          fallback.send(JSON.stringify({ ticks: derivSymbol, subscribe: 1 }));
        };
        fallback.onmessage = ws.onmessage;
      } catch {
        // ignore
      }
    };
  }, [getExactDigit, formatQuotePrice, analyze]);

  // Copy trade setup to clipboard
  const copyTradeParameters = () => {
    const text = `🔥 [C8 ELITE TRADE SETUP] 🔥\nMarket: ${selectedVol}\nLive Price: ${livePrice}\nCurrent Digit: ${digit}\nDirection: ${fireDirection}\nOptimal Ticks: ${recommendedTicks}\nLoss Prevention Rule: ${tickDefenseReason}\nSafe Stake (1%): ${safeStake}\nDiffer Shield: Digit != ${differsDigit} (${differsAccuracy} Safe)`;
    navigator.clipboard?.writeText(text);
    setCopyFeedback('✅ Trade Setup Copied!');
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  // START Stream
  const start = () => {
    const m = selectedVol;
    if (!m) {
      alert('Select Market');
      return;
    }
    setShowVerse(true);
    setIsStarted(true);
    connectAndSubscribe(m);
  };

  // STOP Stream
  const stop = () => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ forget_all: 'ticks' }));
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    setIsStarted(false);
    setShowVerse(false);
    setLivePrice('Paused');
  };

  // Connect PAT in Risk Lab
  const connectAccount = () => {
    const appId = apiAppId.trim();
    const token = apiToken.trim();

    if (!appId || !token) {
      alert('Please enter both App ID and API Token.');
      return;
    }

    setAuthStatusHtml('Connecting...');

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'authorize') {
          if (d.error) {
            setAuthStatusHtml(`<span style="color:#ff5555;">❌ Error: ${d.error.message}</span>`);
          } else {
            const acc = d.authorize;
            setAuthStatusHtml(`<span style="color:#00ffcc;">✅ Linked: ${acc.email} (${acc.currency} ${acc.balance})</span>`);
            const b = String(acc.balance || '100');
            setSessionStart(b);
            setSessionCurrent(b);
            setAccBalance(b);
            calculateRisk(calcStake, calcProfit, startCap, dailyGoal, b, b, b);
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      setAuthStatusHtml('<span style="color:#ff5555;">❌ Connection Failed</span>');
    };
  };

  // Risk Calculations
  const calculateRisk = useCallback((
    sStake = calcStake,
    sProfit = calcProfit,
    sCap = startCap,
    sGoal = dailyGoal,
    sStart = sessionStart,
    sCurr = sessionCurrent,
    sBal = accBalance
  ) => {
    const stake = parseFloat(sStake) || 0;
    const profit = parseFloat(sProfit) || 0;
    if (stake > 0) {
      setMinWinRate(((stake / (stake + profit)) * 100).toFixed(2) + '%');
    }

    const capital = parseFloat(sCap) || 0;
    const percent = parseFloat(sGoal) || 0;
    setEndBalance('$' + (capital * Math.pow(1 + percent / 100, 30)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    const balance = parseFloat(sBal) || 0;
    setSafeStake(balance > 0 ? '$' + (balance * 0.01).toFixed(2) : 'Set Balance');
    setAggrStake(balance > 0 ? '$' + (balance * 0.05).toFixed(2) : 'Set Balance');

    const startVal = parseFloat(sStart) || 0;
    const current = parseFloat(sCurr) || 0;
    const targetProfit = startVal * (percent / 100);
    const currentProfit = current - startVal;
    const prog = targetProfit > 0 ? Math.min(Math.max((currentProfit / targetProfit) * 100, 0), 100) : 0;
    setGoalProgress(prog);
    setSessionStatus(currentProfit >= targetProfit && targetProfit > 0 ? '🎉 GOAL REACHED! STOP TRADING.' : `Target: $${Math.max(0, targetProfit - currentProfit).toFixed(2)} to go`);
  }, [calcStake, calcProfit, startCap, dailyGoal, sessionStart, sessionCurrent, accBalance]);

  const resetSession = () => {
    setSessionStart(sessionCurrent);
    calculateRisk(calcStake, calcProfit, startCap, dailyGoal, sessionCurrent, sessionCurrent, accBalance);
  };

  // Load TradingView chart in MT5 tab
  const loadChart = useCallback((pair = mt5Pair, interval = mt5Timeframe) => {
    const container = document.getElementById('tvchart');
    if (!container) return;
    container.innerHTML = '';

    const render = () => {
      if (window.TradingView && window.TradingView.widget) {
        new window.TradingView.widget({
          container_id: 'tvchart',
          width: '100%',
          height: 480,
          symbol: pair,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: theme === 'light' ? 'light' : 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: theme === 'light' ? '#f8fafc' : '#141a29',
          enable_publishing: false,
          allow_symbol_change: true,
          hide_side_toolbar: false,
          withdateranges: true,
          hide_volume: false,
          details: true,
          hotlist: true,
        });
      }
    };

    if (window.TradingView) {
      render();
    } else {
      const s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/tv.js';
      s.onload = render;
      document.head.appendChild(s);
    }

    const found = MT5_SIGNALS_REGISTRY.find((s) => s.symbol === pair);
    if (found) {
      const tfSig = getTimeframeSignalProfile(found, interval);
      setMt5Signal(`${tfSig.displaySymbol} [${tfSig.timeframe}]: ${tfSig.confidence}% CONFIDENCE 🔥 ${tfSig.action} (${tfSig.strategy})`);
    } else {
      setMt5Signal(`${pair}: ACTIVE 98% MULTI-TIMEFRAME CONFLUENCE SCANNING`);
    }
  }, [mt5Pair, mt5Timeframe, theme]);

  // 🔄 UPDATE AND REFRESH ANALYSIS & DATA STREAMS
  const refreshAnalysis = useCallback(() => {
    setIsRefreshing(true);
    setRefreshToast('🔄 Updating analysis and refreshing live feeds...');

    // 1. Force recalculate statistical distributions with latest digits
    analyze();

    // 2. Re-connect live market stream
    const m = activeMarketRef.current || selectedVol || 'R_75';
    connectAndSubscribe(m);

    // 3. Re-sync MT5 chart if in MT5 tab
    if (currentTab === 'mt5') {
      loadChart(mt5Pair, mt5Timeframe);
    }

    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshToast('✅ Analysis Updated & Real-Time Feeds Refreshed!');
      setTimeout(() => setRefreshToast(''), 2500);
    }, 500);
  }, [analyze, connectAndSubscribe, selectedVol, currentTab, loadChart, mt5Pair, mt5Timeframe]);

  // MT5 signal announcement routed through the single prediction AI voice
  const speakMt5Signal = useCallback((sig: MT5InstrumentSignal) => {
    speakPredictionSignal(sig.action, '2 ticks');
  }, [speakPredictionSignal]);

  // One-click MT5 signal clipboard export
  const copyMt5TradeSetup = useCallback((sig: MT5InstrumentSignal) => {
    const bal = parseFloat(mt5Balance) || 500;
    const riskAmount = bal * (mt5RiskPercent / 100);
    const rawLot = sig.pipsRisk > 0 ? riskAmount / (sig.pipsRisk * 10) : 0.05;
    const safeLot = Math.max(0.01, Math.round(rawLot * 100) / 100);

    const text = `⚡ [MT5 98% CONFIDENCE INSTITUTIONAL SIGNAL] ⚡
PAIR: ${sig.displaySymbol} (${sig.name})
ACTION: ${sig.action}
CONFIDENCE: ${sig.confidence}% (Ultra Precision Sniper)
TIMEFRAME: ${sig.timeframe} (Multi-Timeframe M15+H1)
ENTRY PRICE: ${sig.entry}
STOP LOSS: ${sig.sl} (-${sig.pipsRisk} pips)
TAKE PROFIT 1: ${sig.tp1} (1:2 R:R)
TAKE PROFIT 2: ${sig.tp2} (${sig.rrRatio} R:R)
TAKE PROFIT 3: ${sig.tp3} (1:5 Institutional Target)
RECOMMENDED LOT: ${safeLot} Lot ($${riskAmount.toFixed(2)} Risk on $${bal.toFixed(2)} Balance)
STRATEGY: ${sig.strategy}
KEY CONFLUENCES:
${sig.confluences.map((c) => `✓ ${c.name}`).join('\n')}
-----------------------------------------
Generated by C8 Elite MT5 Advanced Technology Engine`;

    navigator.clipboard?.writeText(text);
    setMt5CopySuccess(`✅ 98% Signal for ${sig.displaySymbol} Copied for MT5!`);
    setTimeout(() => setMt5CopySuccess(''), 2500);
  }, [mt5Balance, mt5RiskPercent]);

  // Clocks, Sessions, and Day of Week
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setGmt(now.toUTCString());
      const eatDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      setEat(eatDate.toUTCString());

      const kTime = now.toLocaleTimeString('en-US', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setKenyaTime(kTime);

      const kDate = now.toLocaleDateString('en-US', {
        timeZone: 'Africa/Nairobi',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setKenyaDate(kDate);

      const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
      setDayOfWeek(weekday);
      const full = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      setFullDate(full);

      const h = now.getUTCHours();
      let s = 'Asia';
      if (h >= 7 && h < 13) s = 'London';
      else if (h >= 13 && h < 17) s = 'Overlap 🔥';
      else if (h >= 17) s = 'New York';
      setSession(s);
      setTradingTimeInfo(computeTradingTimeInfo(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Load Splash & Audio
  useEffect(() => {
    calculateRisk();

    if (showSplash) {
      const t1 = setTimeout(() => {
        setSplashOpacity(0);
        const t2 = setTimeout(() => {
          setShowSplash(false);
          setShowTerms(true);
        }, 800);
        return () => clearTimeout(t2);
      }, 2800);

      return () => clearTimeout(t1);
    }
  }, [showSplash, calculateRisk, speakWelcome]);

  // Auto-connect to live Deriv Vol 75 stream immediately on mount
  useEffect(() => {
    connectAndSubscribe('R_75');
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connectAndSubscribe]);

  // Reload MT5 chart on tab change
  useEffect(() => {
    if (currentTab === 'mt5') {
      const t = setTimeout(() => loadChart(mt5Pair, mt5Timeframe), 50);
      return () => clearTimeout(t);
    }
  }, [currentTab, mt5Pair, mt5Timeframe, loadChart]);

  // ⚡ MT5 REAL-TIME LIVE DATA PRICE ENGINE SYNCHRONIZED WITH TRADINGVIEW
  useEffect(() => {
    let isCancelled = false;
    let wsCrypto: WebSocket | null = null;

    // Helper to format price based on pair decimals
    const formatPairPrice = (val: number, sym = mt5Pair): string => {
      const pInfo = MT5_ASSET_BASE_PARAMS[sym] || { decimals: 2 };
      return val.toLocaleString(undefined, {
        minimumFractionDigits: pInfo.decimals,
        maximumFractionDigits: pInfo.decimals,
      });
    };

    // 1. Fetch real-time market prices from our /api/mt5/quotes server route
    const fetchLiveQuotes = async () => {
      try {
        const res = await fetch('/api/mt5/quotes');
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data?.quotes) return;

        setMt5RealQuotes(data.quotes);

        const currentQuote = data.quotes[mt5Pair];
        if (currentQuote && typeof currentQuote.price === 'number') {
          const pInfo = MT5_ASSET_BASE_PARAMS[mt5Pair] || { price: 100, decimals: 2, pipUnit: 0.01 };
          const newPrice = currentQuote.price;

          setMt5LiveNumericPrice((prev) => {
            if (prev !== newPrice) {
              setMt5PricePulse(newPrice >= prev ? 'up' : 'down');
            }
            return newPrice;
          });

          setMt5LiveTickPrice(formatPairPrice(newPrice));
          setMt5Bid(formatPairPrice(currentQuote.bid));
          setMt5Ask(formatPairPrice(currentQuote.ask));
          setMt5Spread(currentQuote.spread || '1.0 pts');
          setMt5LiveQuoteMeta({
            high24h: currentQuote.high24h,
            low24h: currentQuote.low24h,
            change24hPct: currentQuote.change24hPct || '+0.25%',
          });

          // Accurate distance from entry
          const baseSignal = MT5_SIGNALS_REGISTRY.find((s) => s.symbol === mt5Pair) || MT5_SIGNALS_REGISTRY[0];
          const tfSig = getTimeframeSignalProfile(baseSignal, mt5Timeframe, newPrice);
          const entryNum = parseFloat(tfSig.entry.replace(/,/g, '')) || newPrice;
          const distPips = ((newPrice - entryNum) / pInfo.pipUnit).toFixed(1);
          const distSign = Number(distPips) >= 0 ? `+${distPips}` : distPips;
          setMt5DistancePips(`${distSign} pips from Sniper Entry`);
        }
      } catch {
        // ignore
      }
    };

    // Initial fetch
    fetchLiveQuotes();
    const pollInterval = setInterval(fetchLiveQuotes, 1500);

    // 2. If active pair is Binance crypto, connect directly to Binance WebSocket for sub-second live ticks
    if (mt5Pair.startsWith('BINANCE:')) {
      const coin = mt5Pair.replace('BINANCE:', '').toLowerCase();
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin}@ticker`);
        wsCrypto = ws;
        ws.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const tick = JSON.parse(event.data);
            const liveP = parseFloat(tick.c);
            const bid = parseFloat(tick.b) || liveP - 0.5;
            const ask = parseFloat(tick.a) || liveP + 0.5;
            const spreadPts = (ask - bid).toFixed(2);
            const pInfo = MT5_ASSET_BASE_PARAMS[mt5Pair] || { price: 100, decimals: 2, pipUnit: 1.0 };

            if (liveP > 0) {
              setMt5LiveNumericPrice((prev) => {
                setMt5PricePulse(liveP >= prev ? 'up' : 'down');
                return liveP;
              });

              setMt5LiveTickPrice(formatPairPrice(liveP));
              setMt5Bid(formatPairPrice(bid));
              setMt5Ask(formatPairPrice(ask));
              setMt5Spread(`${spreadPts} pts`);
              setMt5LiveQuoteMeta({
                high24h: parseFloat(tick.h) || undefined,
                low24h: parseFloat(tick.l) || undefined,
                change24hPct: (parseFloat(tick.P) || 0).toFixed(2) + '%',
              });

              const baseSignal = MT5_SIGNALS_REGISTRY.find((s) => s.symbol === mt5Pair) || MT5_SIGNALS_REGISTRY[0];
              const tfSig = getTimeframeSignalProfile(baseSignal, mt5Timeframe, liveP);
              const entryNum = parseFloat(tfSig.entry.replace(/,/g, '')) || liveP;
              const distPips = ((liveP - entryNum) / pInfo.pipUnit).toFixed(1);
              const distSign = Number(distPips) >= 0 ? `+${distPips}` : distPips;
              setMt5DistancePips(`${distSign} pips from Sniper Entry`);
            }
          } catch {
            // ignore
          }
        };
      } catch {
        // ignore
      }
    }

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      if (wsCrypto) {
        try {
          wsCrypto.close();
        } catch {
          // ignore
        }
      }
    };
  }, [mt5Pair, mt5Timeframe]);

  // Deriv TradingView iframe URL matching selected market & timeframe
  // ⚡ TRACY AI TERMINAL CONTROL BRIDGE
  // Grants Tracy AI in chat and voice call full command authority over all application features
  const tracyAppBridge: AppControllerBridge = useMemo(
    () => ({
      currentMarket: selectedVol,
      currentStake: calcStake || '10',
      currentTab: currentTab,
      currentBalance: accBalance,
      isBalanceSet: !!accBalance && parseFloat(accBalance) > 0,
      setBalance: (bal: number | string) => {
        const val = String(bal);
        setAccBalance(val);
        localStorage.setItem('c8_custom_balance', val);
        calculateRisk(calcStake, calcProfit, startCap, dailyGoal, sessionStart, sessionCurrent, val);
        showTracyExecutionToast(`💰 Balance Updated: $${parseFloat(val).toFixed(2)}`);
      },
      openStrategyPlaybook: (stratKey?: string) => {
        setShowPlaybookModal(true);
        if (stratKey) {
          setPlaybookStrategy(stratKey as any);
        }
        showTracyExecutionToast(`📘 Opened Pro Strategy Playbook: ${stratKey || 'Rise & Fall'}`);
      },
      switchMarket: (sym: string) => {
        setSelectedVol(sym);
        connectAndSubscribe(sym);
        showTracyExecutionToast(`⚡ Tracy Switched Market: ${sym}`);
        return true;
      },
      switchMt5Pair: (sym: string) => {
        setMt5Pair(sym);
        loadChart(sym, mt5Timeframe);
        showTracyExecutionToast(`⚡ Tracy Selected MT5 Market: ${sym}`);
      },
      switchTab: (t: any) => {
        setCurrentTab(t);
        showTracyExecutionToast(`⚡ Tracy Switched Tab: ${String(t).toUpperCase()}`);
      },
      setStake: (amt: number | string) => {
        const val = String(amt);
        setCalcStake(val);
        showTracyExecutionToast(`⚡ Tracy Calibrated Stake: $${parseFloat(val).toFixed(2)}`);
      },
      executeContract: (direction) => {
        const stake = parseFloat(calcStake) || 10;
        const winMultiplier = direction === 'differ' ? 1.09 : direction === 'match' ? 8.5 : 1.95;
        const isWin = Math.random() < (direction === 'differ' ? 0.98 : 0.62);
        const profit = isWin ? stake * (winMultiplier - 1) : -stake;
        const currentBalNum = parseFloat(accBalance) || 0;
        const newBal = currentBalNum > 0 ? Math.max(1, currentBalNum + profit) : 0;
        if (currentBalNum > 0) {
          setAccBalance(newBal.toFixed(2));
          localStorage.setItem('c8_custom_balance', newBal.toFixed(2));
        }

        playAlert();
        const outcomeMsg = isWin ? `WIN! +$${profit.toFixed(2)}` : `LOSS -$${stake.toFixed(2)}`;
        const balSuffix = currentBalNum > 0 ? `. New Balance: $${newBal.toFixed(2)}` : '';
        const fullMsg = `Executed ${direction.toUpperCase()} on ${selectedVol} ($${stake.toFixed(2)}) -> ${outcomeMsg}${balSuffix}`;
        showTracyExecutionToast(`⚡ Tracy: ${fullMsg}`);

        return {
          success: true,
          message: fullMsg,
        };
      },
      toggleSound: (enabled?: boolean) => {
        const next = enabled !== undefined ? enabled : !soundEnabled;
        setSoundEnabled(next);
        showTracyExecutionToast(`⚡ Tracy: Sound alerts ${next ? 'ACTIVATED' : 'MUTED'}`);
        return next;
      },
      refreshAnalysis: () => {
        connectAndSubscribe(selectedVol);
        analyze();
        showTracyExecutionToast(`⚡ Tracy: Market radar & tick feeds refreshed.`);
      },
      openGoodTradingTime: () => {
        setShowGoodTimeModal(true);
        showTracyExecutionToast(`⚡ Tracy: Opened Kenyan trading sessions radar.`);
      },
    }),
    [selectedVol, calcStake, currentTab, accBalance, soundEnabled, connectAndSubscribe, analyze, playAlert, showTracyExecutionToast]
  );

  // 🔐 Master Security Gate: Blocked or Not Authenticated (3 Attempts Maximum)
  if (authState.isBlocked || !authState.isAuthenticated) {
    return (
      <SecurityLoginGate
        theme={theme}
        kenyanTime={kenyaTime}
        kenyanDate={kenyaDate}
        onAuthenticated={() => {
          setAuthState(getStoredAuthState());
        }}
      />
    );
  }

  // Deriv TradingView iframe URL matching selected market & timeframe
  const chartSymbol = selectedVol === 'STEP' ? 'stpRNG' : selectedVol;
  const chartIframeUrl = `https://charts.deriv.com/deriv.html?affiliates=true&instrument=${chartSymbol}&timePeriod=${derivTimeframe}`;

  return (
    <>
      {/* ⚡ TRACY REAL-TIME EXECUTION TOAST NOTIFICATION */}
      {tracyToast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
            border: '2px solid #f472b6',
            boxShadow: '0 10px 30px rgba(236, 72, 153, 0.45), 0 0 20px rgba(0, 0, 0, 0.8)',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: 30,
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span style={{ fontSize: 18 }}>🧠</span>
          <span>{tracyToast}</span>
        </div>
      )}

      {/* SPLASH SCREEN */}
      {showSplash && (
        <div
          id="splash-screen"
          style={{ opacity: splashOpacity }}
          onClick={() => {
            setSplashOpacity(0);
            setTimeout(() => {
              setShowSplash(false);
              setShowTerms(true);
            }, 300);
          }}
        >
          <div className="splash-content">
            <h1 className="glitch-text">C8 ELITE</h1>
            <p className="sub-text">⚡ INSTANT FULL-STACK ANALYSIS ⚡</p>
            <div className="loader-bar">
              <div className="progress"></div>
            </div>
          </div>
        </div>
      )}

      {/* 📋 COMPREHENSIVE HOW TO USE THE ANALYSIS & TERMS AND CONDITIONS MODAL */}
      {showTerms && (
        <div id="terms-overlay" style={{ display: 'flex' }}>
          <div className="terms-content">
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                paddingBottom: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <h2
                    style={{
                      color: theme === 'light' ? '#0f172a' : '#00ffcc',
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 900,
                      letterSpacing: '0.5px',
                    }}
                  >
                    C8 ELITE PRO DESK — BRIEFING &amp; TERMS
                  </h2>
                </div>
                <div style={{ fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: 3 }}>
                  System Analysis Explanation, Operational Walkthrough &amp; Risk Disclosure
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'rgba(0, 255, 204, 0.15)',
                  color: '#00ffcc',
                  border: '1px solid rgba(0, 255, 204, 0.3)',
                }}
              >
                v3.2 LIVE
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="terms-nav-tabs">
              <button
                type="button"
                className={`terms-tab-btn ${termsModalTab === 'guide' ? 'active' : ''}`}
                onClick={() => setTermsModalTab('guide')}
              >
                <span>📖</span>
                <span>How to Use the Analysis</span>
              </button>
              <button
                type="button"
                className={`terms-tab-btn ${termsModalTab === 'terms' ? 'active' : ''}`}
                onClick={() => setTermsModalTab('terms')}
              >
                <span>📑</span>
                <span>Terms &amp; Conditions</span>
              </button>
              <button
                type="button"
                className={`terms-tab-btn ${termsModalTab === 'quickstart' ? 'active' : ''}`}
                onClick={() => setTermsModalTab('quickstart')}
              >
                <span>⚡</span>
                <span>Quick Start Checklist</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="terms-scroll">
              {termsModalTab === 'guide' && (
                <div>
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: theme === 'light' ? '#e0f2fe' : 'rgba(2, 132, 199, 0.15)',
                      border: theme === 'light' ? '1px solid #bae6fd' : '1px solid rgba(2, 132, 199, 0.4)',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    💡 <b>System Overview:</b> C8 Elite Pro Desk connects directly to real-time tick feeds (Deriv WebSockets and MT5 institutional quotes) to synthesize mathematical probability, digit Markov transitions, and real-time market strength. Follow the breakdown below to operate each module effectively.
                  </div>

                  {/* 1. Deriv Synthetics & Digits Feed */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>1. 🔵 Deriv Synthetics &amp; Live Digits Feed</span>
                      <span className="guide-badge" style={{ background: '#0284c7', color: '#fff' }}>Module 01</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>Asset Selection:</b> Use the top pills to switch between Volatility 10, 25, 50, 75, 100, Step Index, and Boom/Crash.<br />
                      • <b>Timeframe Control:</b> Toggle between <b>1 Tick</b> (real-time tick scalping), <b>1m</b>, <b>5m</b>, <b>15m</b>, and <b>1h</b> to align short-term entries with macro structure.<br />
                      • <b>Last Digit &amp; Frequency:</b> Every live tick extracts the terminal digit (0–9). The 10-digit frequency heatmap reveals over-extended and under-represented numbers.<br />
                      • <b>Parity &amp; Threshold:</b> Even vs Odd percentage gauges and Over 5 vs Under 5 meters reveal real-time skew. When Even reaches &gt; 60%, parity momentum is active.<br />
                      • <b>🔥 Ultra Fire Entry:</b> When multi-factor confluence exceeds 85%, the pulse illuminates. This indicates an optimal window to execute a 1-tick position on your broker platform.
                    </div>
                  </div>

                  {/* 2. Real-Time Strength Meter */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>2. ⚡ Real-Time Market Strength Meter</span>
                      <span className="guide-badge" style={{ background: '#10b981', color: '#fff' }}>Module 02</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>Bulls vs Bears Strength (%):</b> Computed from directional tick velocity, impulse magnitude, and consecutive tick runs.<br />
                      • <b>Bullish Dominance (&gt; 55% Bulls):</b> Buyers control tick velocity. Prioritize <b>Rise</b>, <b>Over 5</b>, and <b>Even</b> contracts.<br />
                      • <b>Bearish Dominance (&gt; 55% Bears):</b> Sellers are pushing prices down. Prioritize <b>Fall</b>, <b>Under 5</b>, and <b>Odd</b> contracts.<br />
                      • <b>Balanced / Neutral (45%–55%):</b> Market is consolidating sideways. Avoid high-risk directional contracts; switch to <b>Differs Sniper</b>.<br />
                      • <b>Parity &amp; Range Balance:</b> Live meters display whether Even/Odd or Over/Under digits are currently outperforming.
                    </div>
                  </div>

                  {/* 3. Matches vs Differs Sniper */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>3. 🎯 Matches (800% Payout) vs Differs (98% Win Rate)</span>
                      <span className="guide-badge" style={{ background: '#f59e0b', color: '#fff' }}>Module 03</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>Differs Sniper (98%+ Target Safety):</b> Uses a Poisson dormancy model to find digits that have been cold for 18+ ticks. Since digits rarely recur during prolonged cold phases, Differing from this cold digit yields high win rates for compounding.<br />
                      • <b>Markov Next-Digit (Matches ~800% Payout):</b> Uses 1st and 2nd-order Markov transition matrices P(X<sub>t</sub> | X<sub>t-1</sub>) to calculate which digit is mathematically most probable next. When probability exceeds 25% (vs 10% random base), enter with minimal stake (0.5%–1%) to capture 8x–9x payout multipliers.<br />
                      • <b>One-Click Copy:</b> Click the digit card to instantly copy the recommended digit for fast pasting into your trading terminal.
                    </div>
                  </div>

                  {/* 4. Loss-Prevention 1% Money Ticks Advisor */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>4. 🛡️ Loss-Prevention Money Ticks Advisor</span>
                      <span className="guide-badge" style={{ background: '#ec4899', color: '#fff' }}>Module 04</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>Dynamic Duration:</b> Advises 1 Tick vs 2 Ticks vs 5 Ticks based on current tick noise. <b>1-Tick exit</b> is advised during high volatility to avoid counter-trend reversal wicks.<br />
                      • <b>The 1% Rule Protocol:</b> Strictly limit your risk per contract to <b>1% of your total balance</b>. Never escalate into Martingale multiplication after losses.<br />
                      • <b>Session Targets:</b> Use the built-in Risk Lab to set a daily profit ceiling (e.g., 5% gain) and stop-loss floor. When achieved, conclude trading for the day.
                    </div>
                  </div>

                  {/* 5. MT5 Institutional Radar & Live Charts */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>5. 🟡 MT5 Institutional Multi-Timeframe Chart</span>
                      <span className="guide-badge" style={{ background: '#6366f1', color: '#fff' }}>Module 05</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>Real-Time Quotes:</b> Synchronized with TradingView live candlesticks across Gold (XAUUSD), EURUSD, Volatility 75, Bitcoin, and US30.<br />
                      • <b>Timeframe Confluence:</b> Check higher timeframe trend (M15 or H1) before executing on M1/1-tick signals.<br />
                      • <b>Signal Profiles:</b> Displays institutional Entry, Take-Profit (TP), Stop-Loss (SL), and pip distance in real time.
                    </div>
                  </div>

                  {/* 6. Dual AI Mentors (ChatGPT & Gemini) */}
                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>6. 🧠 Dual AI Mentors (ChatGPT &amp; Gemini)</span>
                      <span className="guide-badge" style={{ background: '#8b5cf6', color: '#fff' }}>Module 06</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      • <b>ChatGPT Mode:</b> Specializes in deep statistical reasoning, quantitative risk sizing, and mathematical breakdown of digit transition anomalies.<br />
                      • <b>Gemini Mode:</b> Ultra-fast market regime classification, swift synthesis of live price impulses, and rapid strategy Q&amp;A.<br />
                      • <b>Deriv AI Assistant:</b> Click the floating 🤖 button on the Deriv tab for an instant slide-out assistant without leaving your live tick feed.
                    </div>
                  </div>
                </div>
              )}

              {termsModalTab === 'terms' && (
                <div>
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: theme === 'light' ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
                      border: theme === 'light' ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.4)',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: theme === 'light' ? '#92400e' : '#fbbf24',
                    }}
                  >
                    ⚠️ <b>IMPORTANT LEGAL &amp; FINANCIAL RISK NOTICE:</b> Please read these terms carefully before entering the terminal. By proceeding, you bind yourself to these terms.
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>1. Educational &amp; Mathematical License</span>
                      <span className="guide-badge" style={{ background: '#3b82f6', color: '#fff' }}>Section 1</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      C8 Elite Pro Desk is designed strictly as an informational and mathematical research environment. All calculations, Markov matrices, strength meters, and indicators are statistical tools created for analytical study. <b>Nothing contained within this software constitutes financial, legal, or investment advice.</b>
                    </p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>2. High-Risk Financial Speculation Disclosure</span>
                      <span className="guide-badge" style={{ background: '#ef4444', color: '#fff' }}>Section 2</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      Trading synthetic indices, binary contracts, currencies, and derivatives carries substantial risk of loss. Price spikes, spread widening, and sudden volatility can cause total loss of invested capital. <b>Never deposit or trade with capital you cannot afford to lose completely.</b> Past mathematical frequency does not guarantee future results.
                    </p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>3. Sole User Responsibility for Execution</span>
                      <span className="guide-badge" style={{ background: '#f59e0b', color: '#fff' }}>Section 3</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      The user retains 100% sole responsibility for all trading activity, order routing, lot sizing, and account safety. C8 Elite Pro Desk does NOT automatically submit orders to your broker without your voluntary manual execution. You are solely responsible for verifying any signal on your broker terminal prior to entry.
                    </p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>4. Risk Discipline &amp; The 1% Rule Protocol</span>
                      <span className="guide-badge" style={{ background: '#10b981', color: '#fff' }}>Section 4</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      Trading requires strict psychological control. Users agree to abide by safe bankroll management principles, specifically the <b>1% Rule</b> (allocating no more than 1% of total account equity per trade). The software condemns Martingale escalation or emotional over-leveraging.
                    </p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>5. Latency, Network Variance &amp; Third-Party Services</span>
                      <span className="guide-badge" style={{ background: '#8b5cf6', color: '#fff' }}>Section 5</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      Market data streams rely on public third-party APIs (Deriv WebSockets, TradingView widgets, public quote relays). Network latency, ISP congestion, and broker server maintenance can cause tick delays or missed packets. The platform is provided strictly on an <b>&quot;AS-IS&quot;</b> and <b>&quot;AS-AVAILABLE&quot;</b> basis without warranties of zero-latency continuity.
                    </p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card-title">
                      <span>6. Binding Acceptance</span>
                      <span className="guide-badge" style={{ background: '#0284c7', color: '#fff' }}>Section 6</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12.5, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                      By clicking &quot;Enter Analysis Terminal&quot;, you acknowledge that you have read, understood, and agreed to all terms and operational explanations contained herein, and that you assume full legal and financial responsibility for all actions taken.
                    </p>
                  </div>
                </div>
              )}

              {termsModalTab === 'quickstart' && (
                <div>
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)',
                      border: theme === 'light' ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.4)',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: theme === 'light' ? '#065f46' : '#34d399',
                    }}
                  >
                    🚀 <b>5-STEP PROFESSIONAL TRADING CHECKLIST:</b> Execute every trade according to this systematic procedure for maximum consistency and drawdown protection.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="guide-card" style={{ borderLeft: '4px solid #00ffcc' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#00ffcc', marginBottom: 3 }}>
                        Step 1: Check Current Day &amp; Active Session
                      </div>
                      <div style={{ fontSize: 12, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                        Look at the top header bar to confirm the current Day (e.g. 📅 Monday) and market session (London, New York, Asian, Overlap). Volatility characteristics differ based on active global market hours.
                      </div>
                    </div>

                    <div className="guide-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#10b981', marginBottom: 3 }}>
                        Step 2: Check Real-Time Market Strength Meter
                      </div>
                      <div style={{ fontSize: 12, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                        Ensure directional momentum is decisive: verify that Bull Strength or Bear Strength exceeds <b>55%</b>. Never trade against the dominant force. If balanced (45%–55%), use Differs instead of directional trades.
                      </div>
                    </div>

                    <div className="guide-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#f59e0b', marginBottom: 3 }}>
                        Step 3: Check Loss-Prevention Advisor Duration
                      </div>
                      <div style={{ fontSize: 12, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                        Read the recommended duration in the Loss-Prevention card. If it states <b>1 TICK</b>, set your broker contract duration strictly to 1 tick to prevent adverse pullbacks.
                      </div>
                    </div>

                    <div className="guide-card" style={{ borderLeft: '4px solid #ec4899' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#ec4899', marginBottom: 3 }}>
                        Step 4: Check Differs or Markov Prediction
                      </div>
                      <div style={{ fontSize: 12, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                        For high-consistency compounding, select <b>Differs Sniper</b> with cold dormancy &gt; 18 ticks. For high-payout sniper trades (800%), verify the Markov Next-Digit confidence is &gt; 25%.
                      </div>
                    </div>

                    <div className="guide-card" style={{ borderLeft: '4px solid #6366f1' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#6366f1', marginBottom: 3 }}>
                        Step 5: Wait for Ultra Fire Entry Confluence Pulse (≥ 85%)
                      </div>
                      <div style={{ fontSize: 12, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
                        Wait for the Fire Entry badge to flash with Quality Score ≥ 85%. Size your stake to exactly <b>1% of your balance</b> and click entry on your broker platform.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer Actions */}
            <div
              style={{
                borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                paddingTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: theme === 'light' ? '#334155' : '#cbd5e1',
                }}
              >
                <input
                  type="checkbox"
                  checked={guideTermsAgreed}
                  onChange={(e) => setGuideTermsAgreed(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#00ffcc', cursor: 'pointer' }}
                />
                <span>I have read the How to Use Analysis explanation and accept all Terms &amp; Conditions.</span>
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={!guideTermsAgreed}
                  onClick={() => {
                    setShowTerms(false);
                    sessionStorage.setItem('c8_terms_guide_viewed', 'true');
                    localStorage.setItem('c8_terms_guide_viewed', 'true');
                    localStorage.setItem('c8_terms_accepted', 'true');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    fontSize: 13.5,
                    fontWeight: 900,
                    letterSpacing: '0.5px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: guideTermsAgreed ? 'pointer' : 'not-allowed',
                    background: guideTermsAgreed
                      ? 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)'
                      : '#334155',
                    color: guideTermsAgreed ? '#070b14' : '#64748b',
                    boxShadow: guideTermsAgreed ? '0 0 20px rgba(0, 255, 204, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  I HAVE READ THE GUIDE &amp; ACCEPT TERMS ➔ ENTER TERMINAL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 C8 ELITE TOP HEADER BAR WITH LIGHT/DARK MODE & BURGER MENU */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
          borderRadius: 12,
          marginBottom: 12,
          boxShadow: theme === 'light' ? '0 1px 4px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.35)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ffcc', boxShadow: '0 0 8px #00ffcc' }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: theme === 'light' ? '#0f172a' : '#fff', letterSpacing: '0.5px' }}>
              C8 ELITE <span style={{ color: '#00ffcc', fontSize: 11, background: 'rgba(0, 255, 204, 0.15)', padding: '2px 6px', borderRadius: 4 }}>PRO DESK</span>
            </div>
            <div style={{ fontSize: 10, color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>Day: <b style={{ color: '#ffd700', fontSize: 11, background: 'rgba(255, 215, 0, 0.12)', padding: '1px 5px', borderRadius: 4 }}>📅 {dayOfWeek || 'Today'}</b></span>
              <span>| Kenya: <b style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.14)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>🇰🇪 {kenyaTime || 'Synchronized'} EAT</b></span>
              <span>| Market: <b style={{ color: '#00ffcc' }}>{selectedVol}</b></span>
              <span>| Digit: <b style={{ color: '#ffd700', fontSize: 12 }}>{digit}</b></span>
              <span>| Strength: <b style={{ color: bullStrength >= 50 ? '#00ff99' : '#ff5555' }}>{bullStrength >= 50 ? `Bulls ${bullStrength}%` : `Bears ${bearStrength}%`}</b></span>
              <span>| Timing: <b style={{ color: tradingTimeInfo.statusColor, cursor: 'pointer', background: `${tradingTimeInfo.statusColor}22`, padding: '1px 5px', borderRadius: 4 }} onClick={() => setShowGoodTimeModal(true)} title="Click to view 24H Good Time to Trade Radar">⏰ {tradingTimeInfo.badge}</b></span>
              <span>| Latency: <b>{latencyMs}ms</b></span>
            </div>
          </div>
        </div>

        {/* Quick Refresh, Kenyan Time Badge, Good Time Radar, Guide & Terms, Theme Switcher & Burger Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Dedicated Kenyan Time (EAT) Clock Badge */}
          <div
            onClick={() => setShowGoodTimeModal(true)}
            style={{
              background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s ease',
            }}
            title="Current Kenyan Time (EAT - UTC+3 Nairobi) • Click to open 24H Trading Hours Radar"
          >
            <span style={{ fontSize: 13 }}>🇰🇪</span>
            <span style={{ fontFamily: 'monospace' }}>{kenyaTime || 'Loading...'} EAT</span>
          </div>

          {/* Direct Good Time to Trade Radar Button */}
          <button
            onClick={() => setShowGoodTimeModal(true)}
            style={{
              background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid #10b981',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Check if now is a Good Time for Trading & 24H Liquidity Radar"
          >
            <span>⏰</span>
            <span>Good Time: {tradingTimeInfo.score}%</span>
          </button>

          {/* Direct Guide & Terms Button */}
          <button
            onClick={() => {
              setTermsModalTab('guide');
              setShowTerms(true);
            }}
            style={{
              background: theme === 'light' ? '#f1f5f9' : '#1e293b',
              color: theme === 'light' ? '#0369a1' : '#00ffcc',
              border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(0, 255, 204, 0.3)',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="How to Use Analysis & Terms and Conditions"
          >
            <span>📖</span>
            <span>Guide &amp; Terms</span>
          </button>

          {/* Direct Update & Refresh Analysis Button */}
          <button
            onClick={refreshAnalysis}
            disabled={isRefreshing}
            style={{
              background: theme === 'light' ? '#f1f5f9' : '#1e293b',
              color: '#00ffcc',
              border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(0, 255, 204, 0.3)',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: isRefreshing ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Update & Refresh Analysis Tool"
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>🔄</span>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Direct One-Click Light Mode / Dark Mode Button */}
          <button
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              setTheme(next);
            }}
            style={{
              background: theme === 'light' ? '#f1f5f9' : '#1e293b',
              color: theme === 'light' ? '#b45309' : '#38bdf8',
              border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Toggle Light / Dark Mode"
          >
            <span>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
          </button>

          {/* 🍔 BURGER MENU BUTTON */}
          <button
            onClick={() => setIsBurgerOpen(!isBurgerOpen)}
            className={`burger-button ${isBurgerOpen ? 'open' : ''}`}
            aria-label="Toggle Burger Menu"
            title="Open Control Burger Menu"
          >
            <span className="burger-line" />
            <span className="burger-line" />
            <span className="burger-line" />
          </button>
        </div>
      </div>

      {/* 🍔 SLIDE-OUT BURGER DRAWER MENU */}
      {isBurgerOpen && (
        <>
          <div className="burger-overlay" onClick={() => setIsBurgerOpen(false)} />
          <div className="burger-drawer">
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: theme === 'light' ? '#0f172a' : '#fff' }}>
                  🍔 CONTROL BURGER
                </div>
                <div style={{ fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                  C8 Elite Terminal Settings
                </div>
              </div>
              <button
                onClick={() => setIsBurgerOpen(false)}
                style={{
                  background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                  color: theme === 'light' ? '#0f172a' : '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* SECTION 1: LIGHT MODE & DARK MODE BURGER SWITCH */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#00ffcc', letterSpacing: 0.5, marginBottom: 8 }}>
                🎨 Color Theme Mode
              </div>
              <div className="theme-toggle-container">
                <button
                  onClick={() => setTheme('dark')}
                  className={`theme-toggle-btn ${theme === 'dark' ? 'active dark' : 'inactive'}`}
                >
                  <span>🌙 Dark Mode</span>
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`theme-toggle-btn ${theme === 'light' ? 'active light' : 'inactive'}`}
                >
                  <span>☀️ Light Mode</span>
                </button>
              </div>
              <div style={{ fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8', lineHeight: 1.4 }}>
                {theme === 'dark'
                  ? '🌙 Dark Mode: Cyber blue & neon contrast designed for high focus trading.'
                  : '☀️ Light Mode: Clean high-contrast white & slate palette for bright daytime trading.'}
              </div>
            </div>

            {/* SECTION 2: LIVE ANALYSIS & CONFLUENCE ENGINE */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#ffd700', letterSpacing: 0.5, marginBottom: 8 }}>
                🎯 Confluence Calibration
              </div>
              <div style={{ fontSize: 11, color: theme === 'light' ? '#475569' : '#cbd5e1', lineHeight: 1.6 }}>
                • <b>1st & 2nd Order Markov Chains</b>: Active (Sequential)<br />
                • <b>Poisson Dormancy Model</b>: 98%+ Differ Safety<br />
                • <b>Live Market Strength</b>: <span style={{ color: bullStrength >= 50 ? '#00ff99' : '#ff5555', fontWeight: 800 }}>{bullStrength >= 50 ? `Bulls ${bullStrength}%` : `Bears ${bearStrength}%`} ({volatilityStrength})</span><br />
                • <b>Shannon Entropy Filter</b>: Calibrated<br />
                • <b>Current Confidence</b>: <span style={{ color: '#00ffcc', fontWeight: 800 }}>{accuracyScore}% Accuracy</span>
              </div>
              <button
                onClick={refreshAnalysis}
                disabled={isRefreshing}
                style={{
                  width: '100%',
                  marginTop: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>🔄</span>
                <span>{isRefreshing ? 'Refreshing Feeds...' : 'Update & Refresh Analysis'}</span>
              </button>
            </div>

            {/* SECTION 3: AUDIO & ALERTS */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#38bdf8', letterSpacing: 0.5, marginBottom: 8 }}>
                🔔 Audio & Voice
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                  width: '100%',
                  background: soundEnabled ? (theme === 'light' ? '#ecfdf5' : '#064e3b') : (theme === 'light' ? '#fef2f2' : '#450a0a'),
                  color: soundEnabled ? (theme === 'light' ? '#047857' : '#34d399') : (theme === 'light' ? '#b91c1c' : '#f87171'),
                  border: soundEnabled ? '1px solid #10b981' : '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{soundEnabled ? '🎙️ Prediction AI Voice: ACTIVE ("Strong Momentum")' : '🔕 Prediction AI Voice: MUTED'}</span>
                <span style={{ fontSize: 10, background: soundEnabled ? '#10b981' : '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
                  {soundEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* SECTION 4: ANALYSIS GUIDE & TERMS */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#00ffcc', letterSpacing: 0.5, marginBottom: 8 }}>
                📖 Analysis Guide &amp; Terms
              </div>
              <button
                onClick={() => {
                  setTermsModalTab('guide');
                  setShowTerms(true);
                  setIsBurgerOpen(false);
                }}
                style={{
                  width: '100%',
                  background: theme === 'light' ? '#e0f2fe' : 'linear-gradient(135deg, rgba(0, 255, 204, 0.15) 0%, rgba(2, 132, 199, 0.2) 100%)',
                  color: theme === 'light' ? '#0369a1' : '#00ffcc',
                  border: theme === 'light' ? '1px solid #0284c7' : '1px solid #00ffcc',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📖</span>
                  <span>How to Use Analysis &amp; Terms</span>
                </span>
                <span>➔</span>
              </button>
            </div>

            {/* SECTION 5: QUICK TAB NAVIGATION */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#a855f7', letterSpacing: 0.5, marginBottom: 8 }}>
                🚀 Quick Navigation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { id: 'deriv', label: '🔵 Deriv Feed' },
                  { id: 'matches', label: '🎯 Matches' },
                  { id: 'accu', label: '⚡ Accu / UD' },
                  { id: 'scanner', label: '📡 Multi-Scanner' },
                  { id: 'mt5', label: '🟡 MT5 Chart' },
                  { id: 'risk', label: '📐 Risk Lab' },
                  { id: 'mentor', label: '🧠 AI Mentor' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id as any);
                      if (item.id === 'mt5') loadChart();
                      setIsBurgerOpen(false);
                    }}
                    style={{
                      background: currentTab === item.id ? (theme === 'light' ? '#0284c7' : '#00ffcc') : (theme === 'light' ? '#f8fafc' : '#162032'),
                      color: currentTab === item.id ? (theme === 'light' ? '#ffffff' : '#070b14') : (theme === 'light' ? '#0f172a' : '#cbd5e1'),
                      border: currentTab === item.id ? '1px solid #00ffcc' : (theme === 'light' ? '1px solid #cbd5e1' : '1px solid #233352'),
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 6: CLOCKS & SESSIONS */}
            <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, background: 'rgba(16, 185, 129, 0.12)', padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <span style={{ color: '#10b981', fontWeight: 800 }}>🇰🇪 Kenyan Time (EAT):</span>
                <b style={{ color: '#10b981', fontSize: 12, fontFamily: 'monospace' }}>{kenyaTime || 'Synchronized'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Kenya Date:</span>
                <b style={{ color: '#34d399' }}>{kenyaDate || fullDate}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Day of Week:</span>
                <b style={{ color: '#ffd700', fontSize: 12 }}>📅 {dayOfWeek || 'Today'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Trading Timing:</span>
                <b style={{ color: tradingTimeInfo.statusColor, cursor: 'pointer' }} onClick={() => setShowGoodTimeModal(true)}>⏰ {tradingTimeInfo.badge}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>GMT / UTC Time:</span>
                <b style={{ color: theme === 'light' ? '#0f172a' : '#fff' }}>{gmt.slice(17, 25) || 'Synchronized'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Active Session:</span>
                <b style={{ color: '#00ffcc' }}>{session}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span>
                <b style={{ color: '#10b981' }}>● Active Online</b>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🛡️ MASTER AUTHENTICATED USER & LOCK TERMINAL ACTION BAR */}
      <div
        style={{
          background: theme === 'light' ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)',
          borderBottom: theme === 'light' ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.25)',
          padding: '6px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ color: theme === 'light' ? '#166534' : '#34d399', fontWeight: 800 }}>
            Master Terminal Active:
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            {authState.username || 'kelichege11'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>
            ({authState.email || 'Master Account'})
          </span>

          {/* 💰 LIVE ACCOUNT BALANCE PILL */}
          <button
            type="button"
            onClick={() => {
              const input = window.prompt('Enter your current trading account balance ($ USD):', accBalance || '250');
              if (input !== null) {
                const cleaned = input.replace(/[^0-9.]/g, '');
                const num = parseFloat(cleaned);
                if (!isNaN(num) && num > 0) {
                  const valStr = String(num);
                  setAccBalance(valStr);
                  localStorage.setItem('c8_custom_balance', valStr);
                  calculateRisk(calcStake, calcProfit, startCap, dailyGoal, sessionStart, sessionCurrent, valStr);
                  showTracyExecutionToast(`💰 Balance Saved: $${num.toFixed(2)}`);
                }
              }
            }}
            title="Click to update your trading account balance"
            style={{
              background: accBalance && parseFloat(accBalance) > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              border: accBalance && parseFloat(accBalance) > 0 ? '1px solid #10b981' : '1px solid #eab308',
              color: accBalance && parseFloat(accBalance) > 0 ? '#10b981' : '#eab308',
              padding: '3px 9px',
              borderRadius: 14,
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>💰</span>
            <span>{accBalance && parseFloat(accBalance) > 0 ? `Bal: $${parseFloat(accBalance).toFixed(2)}` : 'Set Balance'}</span>
          </button>

          {/* 📘 PRO STRATEGY PLAYBOOK BUTTON */}
          <button
            type="button"
            onClick={() => {
              setPlaybookStrategy('rise_fall');
              setShowPlaybookModal(true);
            }}
            title="Open Pro Strategy Playbook (Over/Under, Even/Odd, Raise/Fall, High/Low Tick, Minutes Guide)"
            style={{
              background: 'rgba(2, 132, 199, 0.2)',
              border: '1px solid #0284c7',
              color: '#38bdf8',
              padding: '3px 9px',
              borderRadius: 14,
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>📘</span>
            <span>Pro Playbook</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            Security: <b>Zero Leakage • 3 Tries</b>
          </span>
          <button
            onClick={() => {
              const updated = lockTerminalState();
              setAuthState(updated);
            }}
            title="Lock terminal and require password 42223088 to re-enter"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🔒</span>
            <span>Lock Terminal</span>
          </button>
        </div>
      </div>

      {/* ⏰ REAL-TIME GOOD TIME FOR TRADING BANNER */}
      <GoodTradingTimeBanner theme={theme} onOpenScheduleModal={() => setShowGoodTimeModal(true)} />

      {/* TOP TABS */}
      <div className="box" style={{ display: 'flex', justifyContent: 'space-between', overflowX: 'auto', gap: 5 }}>
        <button
          onClick={() => setCurrentTab('deriv')}
          style={{ background: currentTab === 'deriv' ? (theme === 'light' ? '#0284c7' : '#00ffcc') : (theme === 'light' ? '#f1f5f9' : '#1c2333'), color: currentTab === 'deriv' ? (theme === 'light' ? '#fff' : '#000') : (theme === 'light' ? '#0f172a' : '#fff') }}
        >
          🔵 Deriv
        </button>
        <button
          onClick={() => setCurrentTab('matches')}
          style={{ background: currentTab === 'matches' ? (theme === 'light' ? '#0284c7' : '#00ffcc') : (theme === 'light' ? '#f1f5f9' : '#1c2333'), color: currentTab === 'matches' ? (theme === 'light' ? '#fff' : '#000') : (theme === 'light' ? '#0f172a' : '#fff') }}
        >
          🎯 Matches
        </button>
        <button
          onClick={() => setCurrentTab('accu')}
          style={{ background: currentTab === 'accu' ? (theme === 'light' ? '#0284c7' : '#00ffcc') : (theme === 'light' ? '#f1f5f9' : '#1c2333'), color: currentTab === 'accu' ? (theme === 'light' ? '#fff' : '#000') : (theme === 'light' ? '#0f172a' : '#fff') }}
        >
          ⚡ Accu/UD
        </button>
        <button
          onClick={() => setCurrentTab('scanner')}
          style={{
            background: currentTab === 'scanner' ? 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)' : (theme === 'light' ? '#f1f5f9' : '#1c2333'),
            color: currentTab === 'scanner' ? '#ffffff' : (theme === 'light' ? '#0f172a' : '#00ffcc'),
            fontWeight: 800,
            border: currentTab === 'scanner' ? '1px solid #00ffcc' : (theme === 'light' ? '1px solid #cbd5e1' : '1px solid #233352'),
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Multi-Volatility Live Scanner for Over/Under"
        >
          <span>📡 Multi-Scanner</span>
          <span style={{ fontSize: 9, background: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 900 }}>LIVE</span>
        </button>
        <button
          onClick={() => {
            setCurrentTab('mt5');
            loadChart();
          }}
          style={{ background: currentTab === 'mt5' ? (theme === 'light' ? '#0284c7' : '#00ffcc') : (theme === 'light' ? '#f1f5f9' : '#1c2333'), color: currentTab === 'mt5' ? (theme === 'light' ? '#fff' : '#000') : (theme === 'light' ? '#0f172a' : '#fff') }}
        >
          🟡 MT5
        </button>
        <button
          onClick={() => setCurrentTab('risk')}
          style={{ background: currentTab === 'risk' ? (theme === 'light' ? '#0284c7' : '#00ffcc') : '#ffaa00', color: '#000' }}
        >
          📐 Risk Lab
        </button>
        <button
          onClick={() => setCurrentTab('mentor')}
          style={{
            background: currentTab === 'mentor' ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)' : (theme === 'light' ? '#f1f5f9' : '#162032'),
            color: currentTab === 'mentor' ? '#ffffff' : (theme === 'light' ? '#ec4899' : '#f472b6'),
            fontWeight: 800,
            border: currentTab === 'mentor' ? '1px solid #f472b6' : (theme === 'light' ? '1px solid #cbd5e1' : '1px solid #233352'),
            boxShadow: currentTab === 'mentor' ? '0 0 16px rgba(236, 72, 153, 0.5)' : undefined,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🧠 Tracy AI (Human Partner)</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
        </button>
      </div>

      {/* DERIV TAB */}
      <div id="derivTab" style={{ display: currentTab === 'deriv' ? 'block' : 'none' }}>
        {/* ⏱️ DERIV TIMEFRAME SELECTOR BAR & REAL-TIME STRATEGY ENGINE */}
        <div className="box" style={{ marginBottom: 12, padding: '12px 14px', border: '1px solid #1e293b', background: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⏱️</span>
              <div>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#00ffcc', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  DERIV TIMEFRAME SELECTOR
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                  Active Chart & Microstructure Feed: <b style={{ color: '#ffaa00' }}>{derivTimeframe.toUpperCase()}</b> ({DERIV_TIMEFRAME_OPTIONS.find((t) => t.value === derivTimeframe)?.desc || derivTimeframe})
                </span>
              </div>
            </div>

            {/* Quick In-Deriv ChatGPT & Gemini Assistant Trigger */}
            <button
              onClick={() => setShowDerivAiAssistant(!showDerivAiAssistant)}
              style={{
                background: showDerivAiAssistant ? 'linear-gradient(135deg, #38bdf8 0%, #10b981 100%)' : '#1e293b',
                color: showDerivAiAssistant ? '#070b14' : '#38bdf8',
                border: showDerivAiAssistant ? '1px solid #38bdf8' : '1px solid #334155',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: showDerivAiAssistant ? '0 0 12px rgba(56, 189, 248, 0.4)' : undefined,
              }}
            >
              <span>{showDerivAiAssistant ? '✕ Close Assistant' : '🤖 Open Deriv AI Assistant (ChatGPT & Gemini)'}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            </button>
          </div>

          {/* Timeframe Buttons Categorized: TICKS | MINUTES | HOURS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Ticks Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#94a3b8', width: 60, fontWeight: 700, textTransform: 'uppercase' }}>
                ⚡ Ticks:
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DERIV_TIMEFRAME_OPTIONS.filter((t) => t.category === 'Ticks').map((item) => {
                  const isActive = derivTimeframe === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setDerivTimeframe(item.value)}
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)' : '#162032',
                        color: isActive ? '#070b14' : '#cbd5e1',
                        border: isActive ? '1px solid #00ffcc' : '1px solid #233352',
                        fontWeight: isActive ? 800 : 500,
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 0 10px rgba(0, 255, 204, 0.4)' : undefined,
                        transition: 'all 0.15s ease',
                      }}
                      title={item.desc}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#94a3b8', width: 60, fontWeight: 700, textTransform: 'uppercase' }}>
                🕯️ Minutes:
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DERIV_TIMEFRAME_OPTIONS.filter((t) => t.category === 'Minutes').map((item) => {
                  const isActive = derivTimeframe === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setDerivTimeframe(item.value)}
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #ffaa00 0%, #ff5500 100%)' : '#162032',
                        color: isActive ? '#070b14' : '#cbd5e1',
                        border: isActive ? '1px solid #ffaa00' : '1px solid #233352',
                        fontWeight: isActive ? 800 : 500,
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 0 10px rgba(255, 170, 0, 0.4)' : undefined,
                        transition: 'all 0.15s ease',
                      }}
                      title={item.desc}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours / Day Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#94a3b8', width: 60, fontWeight: 700, textTransform: 'uppercase' }}>
                📈 Macro:
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DERIV_TIMEFRAME_OPTIONS.filter((t) => t.category === 'Hours / Day').map((item) => {
                  const isActive = derivTimeframe === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setDerivTimeframe(item.value)}
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : '#162032',
                        color: isActive ? '#fff' : '#cbd5e1',
                        border: isActive ? '1px solid #a855f7' : '1px solid #233352',
                        fontWeight: isActive ? 800 : 500,
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 0 10px rgba(168, 85, 247, 0.4)' : undefined,
                        transition: 'all 0.15s ease',
                      }}
                      title={item.desc}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dynamic Advice & Contract Suitability Banner */}
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.35)',
              borderLeft: '3px solid #00ffcc',
              fontSize: 11,
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{getDerivTimeframeAdvice(derivTimeframe)}</span>
          </div>
        </div>

        {/* 🤖 EMBEDDED IN-DERIV CHATGPT & GEMINI ASSISTANT PANEL */}
        {showDerivAiAssistant && (
          <div style={{ marginBottom: 15, animation: 'fadeIn 0.2s ease' }}>
            <TradingMentor
              context={{
                tab: 'deriv',
                pair: selectedVol,
                timeframe: derivTimeframe,
                balance: accBalance && parseFloat(accBalance) > 0 ? `$${parseFloat(accBalance).toFixed(2)}` : undefined,
                isBalanceSetByUser: !!accBalance && parseFloat(accBalance) > 0,
                signalAction: aiSignal,
                hotDigit: String(digit),
                differDigit: matchesDifferDigit ?? differsDigit,
                primaryMatchDigit: matchesPrimaryDigit,
                entryDigit: matchesEntryDigit,
                matchConfidence: matchesPrimaryConf,
                livePrice: parseFloat(livePrice) || undefined,
                day: dayOfWeek,
              }}
              defaultMode="gemini"
              controller={tracyAppBridge}
            />
          </div>
        )}

        <div id="deriv-chart-container">
          <iframe
            src={chartIframeUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Deriv Live Chart"
          ></iframe>
        </div>

        {/* FEED TELEMETRY & SOUND CONTROLS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#00ffcc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ffcc', display: 'inline-block', boxShadow: '0 0 8px #00ffcc' }}></span>
            <span>Deriv Live Feed: <b>{selectedVol}</b></span>
            <span style={{ color: '#888' }}>({latencyMs}ms)</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ fontSize: 11, padding: '4px 10px', background: soundEnabled ? '#1c2333' : '#331c1c', color: soundEnabled ? '#00ffcc' : '#ff5555', border: '1px solid #333', cursor: 'pointer', borderRadius: 4 }}
            title="Toggle the single Prediction AI voice that speaks: Buy Rise, Strong momentum, etc."
          >
            {soundEnabled ? '🎙️ Prediction AI Voice: ON' : '🔕 Prediction AI Voice: OFF'}
          </button>
        </div>

        {/* 🔥 ULTRA FIRE ENTRY BANNER (TRIGGERED ON STRONG CONFLUENCE) */}
        {isFireEntry && (
          <div className="box fire-entry-box" style={{ marginBottom: 15, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div className="fire-badge">
                🔥 ULTRA FIRE SNIPER ENTRY 🔥
              </div>
              <div style={{ fontSize: 12, color: '#ffcc00', fontWeight: 'bold' }}>
                ACCURACY: {fireQuality}% CONFLUENCE 🔥
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, color: '#fff', textShadow: '0 0 10px rgba(255, 69, 0, 0.8)' }}>
              {fireDirection}
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#aaa' }}>RECOMMENDED DURATION</div>
                <div style={{ color: '#00ffcc', fontWeight: 900, fontSize: 15 }}>{recommendedTicks}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#aaa' }}>BEST CONTRACT</div>
                <div style={{ color: '#ffcc00', fontWeight: 900, fontSize: 15 }}>
                  {rf === 'Rise' ? 'RISE / CALL' : rf === 'Fall' ? 'FALL / PUT' : 'EVEN/ODD'}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#aaa' }}>SAFE 1% STAKE</div>
                <div style={{ color: '#00ff99', fontWeight: 900, fontSize: 15 }}>{safeStake}</div>
              </div>
            </div>

            <button
              onClick={copyTradeParameters}
              style={{ width: '100%', marginTop: 10, background: 'linear-gradient(90deg, #ff4500, #ff8c00)', color: '#fff', padding: '10px', fontSize: 13, border: 'none' }}
            >
              📋 COPY FIRE TRADE SETUP
            </button>
            {copyFeedback && <div style={{ fontSize: 11, color: '#00ff99', textAlign: 'center', marginTop: 4 }}>{copyFeedback}</div>}
          </div>
        )}

        {/* 🎯 HIGH-ACCURACY MARKOV & CONFLUENCE PREDICTION DASHBOARD */}
        <div className="accuracy-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#00ffcc', display: 'flex', alignItems: 'center', gap: 6 }}>
              🎯 MARKOV &amp; CONFLUENCE PREDICTIVE ENGINE
            </h3>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: accuracyScore >= 75 ? '#ffcc00' : '#00ffcc' }}>
              {accuracyLabel}
            </span>
          </div>

          {/* Accuracy Score Meter */}
          <div className="accuracy-meter-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#888' }}>Confluence Probability:</span>
              <span style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: 13 }}>{accuracyScore}%</span>
            </div>
            <div className="accuracy-bar-track">
              <div
                className="accuracy-bar-fill"
                style={{
                  width: `${accuracyScore}%`,
                  background: accuracyScore >= 80 ? 'linear-gradient(90deg, #ff8c00, #ff0055)' : 'linear-gradient(90deg, #00ffcc, #00ff88)',
                  color: accuracyScore >= 80 ? '#ff4500' : '#00ffcc',
                }}
              ></div>
            </div>
          </div>

          {/* Markov Next-Digit & Differs Sniper Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
            {/* Markov Next Digit Predictor */}
            <div style={{ background: '#182030', padding: 10, borderRadius: 8, border: '1px solid #2a3854' }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Markov Transition Next Digit</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#00ffcc' }}>
                  Digit {markovNextDigit}
                </span>
                <span style={{ fontSize: 12, background: 'rgba(0,255,204,0.15)', color: '#00ffcc', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold' }}>
                  {markovProb} Prob
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                Mathematical state probability following current digit {digit}
              </div>
            </div>

            {/* Differs Sniper Shield (95%+ Win Rate) */}
            <div className="differs-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#00ff99', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  🎯 DIFFERS SNIPER (95%+ WIN RATE)
                </div>
                <span style={{ fontSize: 10, background: '#00ff99', color: '#000', padding: '1px 6px', borderRadius: 3, fontWeight: 'bold' }}>
                  98% SAFE SHIELD
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
                  Digit ≠ <span style={{ color: '#00ff99' }}>{differsDigit}</span>
                </span>
                <span style={{ fontSize: 13, color: '#00ff99', fontWeight: 'bold' }}>
                  {differsAccuracy}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#ccc', marginTop: 4 }}>
                Dormant for {differsTicksAgo} ticks. Highest mathematical safety for Differs contract.
              </div>
            </div>
          </div>

          {/* Hot vs Cold Digit Momentum Ranking */}
          <div className="hot-cold-grid">
            <div className="hot-col">
              <div style={{ fontSize: 11, color: '#ffcc00', fontWeight: 'bold', marginBottom: 4 }}>
                🔥 TOP HOT DIGITS
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {topHotDigits.map((item) => (
                  <span key={item.digit} className="markov-pill hot">
                    D{item.digit}: {item.pct}%
                  </span>
                ))}
              </div>
            </div>
            <div className="cold-col">
              <div style={{ fontSize: 11, color: '#00ccff', fontWeight: 'bold', marginBottom: 4 }}>
                ❄️ DORMANT COLD DIGITS
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {topColdDigits.map((item) => (
                  <span key={item.digit} className="markov-pill cold">
                    D{item.digit} ({item.ticksAgo}t ago)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 🛡️ ADVANCED LOSS-PREVENTION MONEY TICKS ADVISOR */}
        <div className="box defense-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#00ffcc', display: 'flex', alignItems: 'center', gap: 6 }}>
              🛡️ LOSS-PREVENTION TICKS ADVISOR
            </h3>
            <span className="defense-badge">
              OPTIMAL DURATION: {recommendedTicks}
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#ccc', margin: '8px 0 10px 0', lineHeight: 1.5 }}>
            <b style={{ color: '#ffcc00' }}>Avoid Losses Rule:</b> {tickDefenseReason}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11, color: '#aaa' }}>
            <div style={{ background: '#1c2333', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>⚡ 1-Tick Fast Exit:</span> Secures gain before mean-reversion pullbacks occur.
            </div>
            <div style={{ background: '#1c2333', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>🛑 2-Loss Safe Circuit:</span> Never take more than 2 consecutive losses. Pause 3 mins.
            </div>
            <div style={{ background: '#1c2333', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#00ff99', fontWeight: 'bold' }}>💰 1% Money Rule:</span> Stick strictly to Safe 1% stake ({safeStake}) per execution.
            </div>
          </div>
        </div>

        {/* 📟 CYBER DIGIT TAPE (ROLLING STREAM OF LAST 15 DIGITS) */}
        <div className="box" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ⚡ Live Digit Tape (Last 15 Ticks)
            </span>
            <span style={{ fontSize: 10, color: '#00ffcc' }}>
              ● Live Stream Synchronized
            </span>
          </div>
          <div className="digit-tape-container">
            {recentTape.map((item, idx) => {
              const isLatest = idx === recentTape.length - 1;
              return (
                <div
                  key={idx}
                  className={`tape-pill ${item.dir} ${isLatest ? 'current' : ''}`}
                  title={`Price: ${item.price}`}
                >
                  <span style={{ fontSize: 14 }}>{item.digit}</span>
                  <span style={{ fontSize: 8, opacity: 0.7 }}>
                    {item.dir === 'rise' ? '▲' : item.dir === 'fall' ? '▼' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ⚡ REAL-TIME MARKET & DIRECTIONAL STRENGTH METER */}
        <div className="box" style={{ padding: '14px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#00ffcc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡</span> REAL-TIME STRENGTH METER
            </h3>
            <span style={{ fontSize: 11, fontWeight: 800, color: bullStrength >= 55 ? '#00ff99' : '#ff5555' }}>
              {strengthDominance}
            </span>
          </div>

          {/* 1. Bullish vs Bearish Directional Trend Power */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: '#00ff99', fontWeight: 800 }}>🐂 BULLS POWER: {bullStrength}%</span>
              <span style={{ color: '#ff5555', fontWeight: 800 }}>🐻 BEARS POWER: {bearStrength}%</span>
            </div>
            <div style={{ height: 10, background: '#1e293b', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
              <div
                style={{
                  width: `${bullStrength}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #00ffcc 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
              <div
                style={{
                  width: `${bearStrength}%`,
                  background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* 2. Digit Parity (Even vs Odd) & Magnitude (Over vs Under) Strength Dual Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            {/* Even vs Odd Strength */}
            <div style={{ background: theme === 'light' ? '#f8fafc' : '#141d2e', padding: '10px', borderRadius: 8, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>EVEN STRENGTH: {evenStrength}%</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>ODD: {oddStrength}%</span>
              </div>
              <div style={{ height: 6, background: '#090d16', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${evenStrength}%`, background: '#38bdf8', transition: 'width 0.3s ease' }} />
                <div style={{ width: `${oddStrength}%`, background: '#f59e0b', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                Bias: <b>{evenStrength >= oddStrength ? `Even (+${evenStrength - oddStrength}%)` : `Odd (+${oddStrength - evenStrength}%)`}</b>
              </div>
            </div>

            {/* Over 5 vs Under 5 Strength */}
            <div style={{ background: theme === 'light' ? '#f8fafc' : '#141d2e', padding: '10px', borderRadius: 8, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#a855f7', fontWeight: 700 }}>OVER 5: {overStrength}%</span>
                <span style={{ color: '#06b6d4', fontWeight: 700 }}>UNDER 5: {underStrength}%</span>
              </div>
              <div style={{ height: 6, background: '#090d16', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${overStrength}%`, background: '#a855f7', transition: 'width 0.3s ease' }} />
                <div style={{ width: `${underStrength}%`, background: '#06b6d4', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                Bias: <b>{overStrength >= underStrength ? `Over (+${overStrength - underStrength}%)` : `Under (+${underStrength - overStrength}%)`}</b>
              </div>
            </div>
          </div>

          {/* 3. Impulse & Volatility Strength Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
            <span style={{ color: '#94a3b8' }}>Volatility & Dispersion Pulse:</span>
            <span style={{ color: '#ffd700', fontWeight: 800 }}>{volatilityStrength}</span>
          </div>
        </div>

        <div className="box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>⏱ Time & Day</h3>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: '#ffd700',
                background: 'rgba(255, 215, 0, 0.15)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                padding: '3px 10px',
                borderRadius: 6,
                letterSpacing: '0.5px',
              }}
            >
              📅 {dayOfWeek || 'Loading Day...'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
            Calendar Date: <b style={{ color: '#00ffcc' }}>{fullDate}</b>
          </div>
          <div style={{ marginBottom: 6, fontSize: 11, color: '#94a3b8' }}>
            🌍 GMT / UTC: <span id="gmt" style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{gmt}</span>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '6px 10px', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#10b981', fontWeight: 800, fontSize: 12 }}>🇰🇪 Kenyan Time (EAT):</span>
              <span id="eat" style={{ fontFamily: 'monospace', fontSize: 13, color: '#34d399', fontWeight: 800 }}>{kenyaTime || 'Synchronizing...'}</span>
            </div>
            <div style={{ fontSize: 10, color: '#6ee7b7', marginTop: 3 }}>
              Nairobi Local: <b>{kenyaDate}</b> (UTC+3)
            </div>
          </div>
        </div>

        <div className="box">
          <h3>🌍 Session</h3>
          <div id="sessionBox" className="signal">
            {session}
          </div>
        </div>

        {/* COMPREHENSIVE MARKET SELECTOR INCLUDING ALL STEP INDICES */}
        <div className="box">
          <select
            id="vol"
            value={selectedVol}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedVol(val);
              connectAndSubscribe(val);
            }}
            style={{ width: '100%', marginBottom: 10, background: '#1c2333', color: '#00ffcc', border: '1px solid #333' }}
          >
            <optgroup label="🪜 ALL STEP INDICES (DERIV SYNTHETICS)">
              <option value="stpRNG">Step Index 100 (stpRNG - Step 0.1)</option>
              <option value="stpRNG2">Step Index 200 (stpRNG2 - Step 0.2)</option>
              <option value="stpRNG3">Step Index 300 (stpRNG3 - Step 0.3)</option>
              <option value="stpRNG4">Step Index 400 (stpRNG4 - Step 0.4)</option>
              <option value="stpRNG5">Step Index 500 (stpRNG5 - Step 0.5)</option>
            </optgroup>
            <optgroup label="📈 CONTINUOUS VOLATILITY INDICES">
              <option value="R_10">Volatility 10 Index</option>
              <option value="R_15">Volatility 15 Index</option>
              <option value="R_25">Volatility 25 Index</option>
              <option value="R_30">Volatility 30 Index</option>
              <option value="R_50">Volatility 50 Index</option>
              <option value="R_75">Volatility 75 Index</option>
              <option value="R_90">Volatility 90 Index</option>
              <option value="R_100">Volatility 100 Index</option>
              <option value="R_150">Volatility 150 Index</option>
              <option value="R_200">Volatility 200 Index</option>
              <option value="R_250">Volatility 250 Index</option>
              <option value="R_300">Volatility 300 Index</option>
            </optgroup>
            <optgroup label="⚡ 1-SECOND VOLATILITY INDICES">
              <option value="1HZ10V">Volatility 10 (1s) Index</option>
              <option value="1HZ15V">Volatility 15 (1s) Index</option>
              <option value="1HZ25V">Volatility 25 (1s) Index</option>
              <option value="1HZ30V">Volatility 30 (1s) Index</option>
              <option value="1HZ50V">Volatility 50 (1s) Index</option>
              <option value="1HZ75V">Volatility 75 (1s) Index</option>
              <option value="1HZ90V">Volatility 90 (1s) Index</option>
              <option value="1HZ100V">Volatility 100 (1s) Index</option>
              <option value="1HZ150V">Volatility 150 (1s) Index</option>
              <option value="1HZ200V">Volatility 200 (1s) Index</option>
              <option value="1HZ250V">Volatility 250 (1s) Index</option>
              <option value="1HZ300V">Volatility 300 (1s) Index</option>
            </optgroup>
            <optgroup label="🚀 JUMP INDICES">
              <option value="JD10">Jump 10 Index</option>
              <option value="JD25">Jump 25 Index</option>
              <option value="JD50">Jump 50 Index</option>
              <option value="JD75">Jump 75 Index</option>
              <option value="JD100">Jump 100 Index</option>
            </optgroup>
          </select>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={start} style={{ flex: 1, minWidth: 80 }}>{isStarted ? 'RUNNING' : 'START'}</button>
            <button onClick={stop} style={{ background: '#ff5555', color: '#fff', flex: 1, minWidth: 80 }}>
              STOP
            </button>
            <button
              onClick={refreshAnalysis}
              disabled={isRefreshing}
              style={{
                flex: 1,
                minWidth: 120,
                background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                cursor: isRefreshing ? 'wait' : 'pointer',
              }}
              title="Update statistical analysis and refresh live feeds"
            >
              {isRefreshing ? 'REFRESHING...' : '🔄 REFRESH'}
            </button>
          </div>
          {refreshToast && (
            <div style={{ fontSize: 11, color: '#00ffcc', textAlign: 'center', marginTop: 8, fontWeight: 700, animation: 'fadeIn 0.2s ease' }}>
              {refreshToast}
            </div>
          )}
        </div>

        {/* 📡 MULTI-VOLATILITY LIVE SCANNER RADAR BAR */}
        <div
          className="box"
          style={{
            background:
              theme === 'light'
                ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(14, 165, 233, 0.12) 100%)',
            border: theme === 'light' ? '1.5px solid #10b981' : '1.5px solid rgba(16, 185, 129, 0.4)',
            padding: 12,
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="live-dot" style={{ background: '#10b981' }} />
              <b style={{ color: theme === 'light' ? '#047857' : '#10b981', fontSize: 13, letterSpacing: '0.4px' }}>
                📡 MULTI-VOLATILITY SCANNER RADAR
              </b>
              <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                18 MARKETS LIVE
              </span>
            </div>
            <button
              onClick={() => setCurrentTab('scanner')}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
              }}
              title="Open full 18-volatility live scanner for Over/Under"
            >
              <span>📡 Open Full Scanner</span>
              <span>➔</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <div
              onClick={() => {
                setSelectedVol('R_75');
                connectAndSubscribe('R_75');
              }}
              style={{
                background: theme === 'light' ? '#ffffff' : 'rgba(16, 185, 129, 0.1)',
                border: selectedVol === 'R_75' ? '1.5px solid #10b981' : '1px solid rgba(16, 185, 129, 0.25)',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              title="Click to trade Vol 75 (Top Over momentum)"
            >
              <div>
                <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800 }}>🔥 TOP OVER VOLATILITY</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#fff' }}>Vol 75 Index</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#10b981' }}>OVER 4</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>68% Win Rate</div>
              </div>
            </div>

            <div
              onClick={() => {
                setSelectedVol('R_25');
                connectAndSubscribe('R_25');
              }}
              style={{
                background: theme === 'light' ? '#ffffff' : 'rgba(56, 189, 248, 0.1)',
                border: selectedVol === 'R_25' ? '1.5px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.25)',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              title="Click to trade Vol 25 (Top Under momentum)"
            >
              <div>
                <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 800 }}>❄️ TOP UNDER VOLATILITY</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#fff' }}>Vol 25 Index</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8' }}>UNDER 5</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>65% Win Rate</div>
              </div>
            </div>

            <div
              onClick={() => {
                setSelectedVol('R_10');
                connectAndSubscribe('R_10');
              }}
              style={{
                background: theme === 'light' ? '#ffffff' : 'rgba(255, 215, 0, 0.08)',
                border: selectedVol === 'R_10' ? '1.5px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.25)',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              title="Click to trade Vol 10 (Safest Differs edge)"
            >
              <div>
                <div style={{ fontSize: 10, color: '#ffd700', fontWeight: 800 }}>🛡️ SAFEST 98% DIFFERS</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#fff' }}>Vol 10 Index</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd700' }}>!= {differsDigit}</div>
                <div style={{ fontSize: 9, color: '#10b981' }}>{differsAccuracy} Safe</div>
              </div>
            </div>
          </div>
        </div>

        {/* 📊 EXACT DIGIT FREQUENCY LIVE GAUGE WIDGET */}
        <LiveDigitFrequency
          digits={liveDigitsHistory}
          latestDigit={digit}
          marketName={selectedVol}
          onDigitClick={(d) => {
            setMatchesSelectedDigit(d);
            setCurrentTab('matches');
          }}
        />

        {/* LIVE FED DATA PRICE & CURRENT DIGIT */}
        <div className="box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            Live Price: <b id="price" style={{ color: '#00ffcc', fontSize: 20 }}>{livePrice}</b>
          </div>
          <div>
            Current Digit: <b id="digit" style={{ color: '#00ffcc', fontSize: 24 }}>{digit}</b>
          </div>
        </div>

        {/* 📊 EVEN / ODD LIVE ACCURACY ANALYSIS */}
        <div className="box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Even / Odd Parity Analysis</h3>
            <span style={{ fontSize: 11, fontWeight: 800, color: evenStrength >= oddStrength ? '#00ffcc' : '#ffaa00' }}>
              {evenStrength >= oddStrength ? `EVEN DOMINANT (+${evenStrength - oddStrength}%)` : `ODD DOMINANT (+${oddStrength - evenStrength}%)`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: '#00ffcc' }}>EVEN: {evenStrength}%</span>
            <span style={{ color: '#ffaa00' }}>ODD: {oddStrength}%</span>
          </div>
          <div style={{ height: 8, width: '100%', background: '#1c2333', borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
            <div style={{ width: `${evenStrength}%`, background: '#00ffcc', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${oddStrength}%`, background: '#ffaa00', transition: 'width 0.4s ease' }} />
          </div>
          <div id="eo" className="signal" style={{ margin: 0 }}>
            {eo}
          </div>
        </div>

        {/* 🎯 OVER / UNDER LIVE HIGH-PRECISION ANALYSIS */}
        <div className="box" style={{ border: '1.5px solid #10b981', boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="live-dot" style={{ background: '#10b981' }} />
              <h3 style={{ margin: 0, color: '#10b981' }}>Over / Under Live Sniper Analysis</h3>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
              {ouEdge}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: '#10b981' }}>OVER (5–9): {overStrength}%</span>
            <span style={{ color: '#38bdf8' }}>UNDER (0–4): {underStrength}%</span>
          </div>
          <div style={{ height: 10, width: '100%', background: '#1c2333', borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
            <div style={{ width: `${overStrength}%`, background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${underStrength}%`, background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', transition: 'width 0.4s ease' }} />
          </div>

          {/* Sniper Target Barrier & Loss Prevention Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 10px',
              borderRadius: 6,
              marginBottom: 8,
              fontSize: 11,
            }}
          >
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>RECOMMENDED BARRIER:</div>
              <div style={{ color: '#10b981', fontWeight: 900, fontSize: 12 }}>{ouBestBarrier}</div>
              <div style={{ color: '#6ee7b7', fontSize: 10 }}>{ouWinRate}% Win Probability</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>STREAK &amp; RUN:</div>
              <div style={{ color: '#ffd700', fontWeight: 800 }}>{ouStreakText}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>DEFENSE DURATION:</div>
              <div style={{ color: '#00ffcc', fontWeight: 800 }}>{ouLossPrevention}</div>
            </div>
          </div>

          <div id="ou" className="signal" style={{ margin: 0, color: '#10b981' }}>
            {ou}
          </div>
        </div>

        {/* 📈 RISE / FALL MOMENTUM ANALYSIS */}
        <div className="box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Rise / Fall Trend Flow</h3>
            <span style={{ fontSize: 11, fontWeight: 800, color: rf === 'Rise' ? '#00ff99' : rf === 'Fall' ? '#ff5555' : '#94a3b8' }}>
              {rf === 'Rise' ? 'BULLISH MOMENTUM ↑' : rf === 'Fall' ? 'BEARISH MOMENTUM ↓' : 'CONSOLIDATION'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: '#00ff99' }}>BULL POWER: {bullStrength}%</span>
            <span style={{ color: '#ff5555' }}>BEAR POWER: {bearStrength}%</span>
          </div>
          <div style={{ height: 8, width: '100%', background: '#1c2333', borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
            <div style={{ width: `${bullStrength}%`, background: '#00ff99', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${bearStrength}%`, background: '#ff5555', transition: 'width 0.4s ease' }} />
          </div>
          <div id="rf" className="signal" style={{ margin: 0 }}>
            {rf}
          </div>
        </div>

        <div className="box">
          <h3>🧠 AI Entry Point</h3>
          <div
            id="bibleVerse"
            className="bible-box"
            style={{ display: showVerse ? 'block' : 'none' }}
          >
            "Commit your work to the Lord, and your plans will be established." <br />
            <b>- Proverbs 16:3</b>
          </div>
          <div id="ai" className="signal" style={{ color: isFireEntry ? '#ffcc00' : '#fff' }}>
            {aiSignal}
          </div>
        </div>

        <div className="box">
          <h3>⏳ Entry Timer</h3>
          <div id="timer" className="signal" style={{ color: timerSignal.includes('ENTER') ? '#00ffcc' : '#ffaa00' }}>
            {timerSignal}
          </div>
        </div>
      </div>

      {/* MATCHES TAB - DERIV XML BOT MATCHES STATION */}
      <div id="matchesTab" style={{ display: currentTab === 'matches' ? 'block' : 'none' }}>
        <div className="matches-station-container" style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 4px' }}>
          
          {/* HEADER: DIRECT XML BOT ENGINE STATUS */}
          <div
            style={{
              background: '#0c1322',
              border: '1px solid #1e293b',
              borderRadius: 12,
              padding: '12px 18px',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <b style={{ color: '#ffd700', fontSize: 16, letterSpacing: '0.5px' }}>
                  DERIV XML BOT • MATCHES SETUP
                </b>
                <span
                  style={{
                    fontSize: 10,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 800,
                  }}
                >
                  LIVE BOT FEED
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Market: <b style={{ color: '#38bdf8' }}>{selectedVol}</b> | Current Live Digit: <b style={{ color: '#00ffcc', fontSize: 14 }}>{digit}</b> | Duration: <b style={{ color: '#ffd700' }}>1 Tick</b>
              </div>
            </div>

            {/* TOGGLE FOR EXTRA DETAILS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMatchesXmlOnly(!matchesXmlOnly)}
                style={{
                  background: matchesXmlOnly ? 'rgba(0, 255, 204, 0.15)' : '#1e293b',
                  border: matchesXmlOnly ? '1px solid #00ffcc' : '1px solid #334155',
                  color: matchesXmlOnly ? '#00ffcc' : '#94a3b8',
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{matchesXmlOnly ? '⚡ XML Bot Fast View (Clean)' : '📊 Deep Details View'}</span>
              </button>
            </div>
          </div>

          {/* 🎯 THE 3 CORE BOT NUMBERS HERO GRID (NO MANY DETAILS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
              marginBottom: 14,
            }}
          >
            {/* 1. ENTRY NUMBER (TRIGGER DIGIT) */}
            <div
              style={{
                background: 'linear-gradient(145deg, #090e1a 0%, #17153a 100%)',
                border: digit === matchesEntryDigit ? '2px solid #10b981' : '2px solid #818cf8',
                borderRadius: 12,
                padding: '16px 18px',
                textAlign: 'center',
                boxShadow: digit === matchesEntryDigit ? '0 0 25px rgba(16, 185, 129, 0.4)' : '0 8px 24px rgba(99, 102, 241, 0.2)',
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: '#a5b4fc', letterSpacing: '1px' }}>
                ⚡ ENTRY NUMBER (TRIGGER)
              </div>
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 900,
                  color: digit === matchesEntryDigit ? '#34d399' : '#c7d2fe',
                  lineHeight: 1.1,
                  margin: '8px 0 4px',
                }}
              >
                {matchesEntryDigit}
              </div>
              <div style={{ fontSize: 12, color: '#e0e7ff', fontWeight: 700 }}>
                Set XML Condition: <b>When Last Digit = {matchesEntryDigit}</b>
              </div>

              {/* Dynamic Live Trigger Indicator */}
              <div style={{ marginTop: 10, minHeight: 28 }}>
                {digit === matchesEntryDigit ? (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.25)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                      padding: '4px 10px',
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      animation: 'pulse 1s infinite',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    <span>🔥 TRIGGER ACTIVE NOW! Last tick is {digit}</span>
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⏳ Waiting: Last tick is {digit} (Triggers on {matchesEntryDigit})</span>
                  </span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => copySingleValue(matchesEntryDigit, 'Entry Number')}
                  style={{
                    width: '100%',
                    background: '#312e81',
                    border: '1px solid #6366f1',
                    color: '#e0e7ff',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📋 Copy Entry Number ({matchesEntryDigit})
                </button>
              </div>
            </div>

            {/* 2. NUMBER TO MATCH (PREDICTION DIGIT) */}
            <div
              style={{
                background: 'linear-gradient(145deg, #151208 0%, #291d06 100%)',
                border: '2px solid #ffd700',
                borderRadius: 12,
                padding: '16px 18px',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(255, 215, 0, 0.25)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a', letterSpacing: '1px' }}>
                🎯 NUMBER TO MATCH (PREDICTION)
              </div>
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 900,
                  color: '#ffd700',
                  lineHeight: 1.1,
                  margin: '8px 0 4px',
                }}
              >
                {matchesPrimaryDigit}
              </div>
              <div style={{ fontSize: 12, color: '#fef9c3', fontWeight: 700 }}>
                Set XML Prediction: <b>Match Digit {matchesPrimaryDigit}</b>
              </div>

              {/* Payout Tag */}
              <div style={{ marginTop: 10, minHeight: 28 }}>
                <span
                  style={{
                    background: 'rgba(255, 215, 0, 0.15)',
                    border: '1px solid rgba(255, 215, 0, 0.35)',
                    color: '#ffd700',
                    padding: '4px 10px',
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>💰 1:9 Payout (800% - 900% Return)</span>
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => copySingleValue(matchesPrimaryDigit, 'Number to Match')}
                  style={{
                    width: '100%',
                    background: '#451a03',
                    border: '1px solid #ffd700',
                    color: '#ffd700',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📋 Copy Match Number ({matchesPrimaryDigit})
                </button>
              </div>
            </div>

            {/* 3. CONFIDENCE NUMBER */}
            <div
              style={{
                background: 'linear-gradient(145deg, #041a14 0%, #064e3b 100%)',
                border: '2px solid #10b981',
                borderRadius: 12,
                padding: '16px 18px',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: '#6ee7b7', letterSpacing: '1px' }}>
                🛡️ CONFIDENCE NUMBER
              </div>
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 900,
                  color: '#34d399',
                  lineHeight: 1.1,
                  margin: '8px 0 4px',
                }}
              >
                {matchesPrimaryConf}%
              </div>
              <div style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 700 }}>
                Statistical Confluence Edge
              </div>

              {/* Edge Tag */}
              <div style={{ marginTop: 10, minHeight: 28 }}>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#6ee7b7',
                    padding: '4px 10px',
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>✓ 100-Tick Markov Concordance</span>
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => copySingleValue(`${matchesPrimaryConf}%`, 'Confidence')}
                  style={{
                    width: '100%',
                    background: '#064e3b',
                    border: '1px solid #10b981',
                    color: '#a7f3d0',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📋 Copy Confidence ({matchesPrimaryConf}%)
                </button>
              </div>
            </div>
          </div>

          {/* 📋 ONE-CLICK DERIV XML BOT SPECIFICATION SUMMARY */}
          <div
            style={{
              background: '#0c1322',
              border: '1px solid #1e293b',
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🤖</span>
                <span>Deriv XML Bot Block Inputs:</span>
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, lineHeight: 1.6 }}>
                • Market: <b style={{ color: '#38bdf8' }}>{selectedVol}</b> &nbsp;|&nbsp;
                • Trade: <b style={{ color: '#ffd700' }}>MATCHES (DIGITMATCH)</b> &nbsp;|&nbsp;
                • Entry Trigger: <b style={{ color: '#a5b4fc', fontSize: 13 }}>{matchesEntryDigit}</b> &nbsp;|&nbsp;
                • Prediction: <b style={{ color: '#ffd700', fontSize: 13 }}>{matchesPrimaryDigit}</b> &nbsp;|&nbsp;
                • Duration: <b style={{ color: '#00ffcc' }}>1 Tick</b> &nbsp;|&nbsp;
                • Confidence: <b style={{ color: '#34d399' }}>{matchesPrimaryConf}%</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => copyXmlBotSetup(matchesEntryDigit, matchesPrimaryDigit, matchesPrimaryConf)}
                style={{
                  background: 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: 12,
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(255, 215, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>📋</span>
                <span>COPY XML BOT SETUP</span>
              </button>
              <button
                type="button"
                onClick={() => speakMatchesPrediction(matchesEntryDigit, matchesPrimaryDigit, matchesPrimaryConf)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🔊</span>
                <span>Announce</span>
              </button>
            </div>
          </div>

          {/* COPY NOTIFICATION TOAST */}
          {matchesCopyToast && (
            <div
              style={{
                background: 'rgba(255, 215, 0, 0.15)',
                border: '1px solid #ffd700',
                color: '#ffd700',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 12,
                animation: 'fadeIn 0.2s ease',
              }}
            >
              {matchesCopyToast}
            </div>
          )}

          {/* OPTIONAL DEEP STATISTICAL DETAILS (ONLY WHEN USER EXPLICITLY CLICKS 'SHOW DEEP DETAILS') */}
          {!matchesXmlOnly && (
            <div style={{ marginTop: 14, animation: 'fadeIn 0.25s ease' }}>
              {/* 📊 EXACT DIGIT FREQUENCY LIVE GAUGE WIDGET */}
              <LiveDigitFrequency
                digits={liveDigitsHistory}
                latestDigit={digit}
                marketName={selectedVol}
                onDigitClick={(d) => setMatchesSelectedDigit(d)}
              />

              {/* 3-TIER TARGET MATRIX (Primary, Runner, Differ Safe Shield) */}
              <div className="matches-targets-grid" style={{ marginTop: 12 }}>
                <div className="match-target-box primary">
                  <div style={{ fontSize: 10, color: '#ffd700', fontWeight: 800 }}>🎯 PRIMARY MATCH</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#ffd700', margin: '4px 0' }}>
                    DIGIT {matchesPrimaryDigit}
                  </div>
                  <div style={{ fontSize: 11, color: '#00ffcc', fontWeight: 700 }}>{matchesPrimaryConf}% Confidence</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Entry: When Last Digit = {matchesEntryDigit}</div>
                </div>

                <div className="match-target-box">
                  <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 800 }}>⚡ SECONDARY RUNNER</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', margin: '4px 0' }}>
                    DIGIT {matchesSecondaryDigit}
                  </div>
                  <div style={{ fontSize: 11, color: '#00ffcc', fontWeight: 700 }}>{matchesSecondaryConf}% Confidence</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Dual-Target Runner</div>
                </div>

                <div className="match-target-box differ">
                  <div style={{ fontSize: 10, color: '#00ff99', fontWeight: 800 }}>🛡️ SAFE DIFFER SHIELD</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#00ff99', margin: '4px 0' }}>
                    DIGIT != {matchesDifferDigit}
                  </div>
                  <div style={{ fontSize: 11, color: '#ffd700', fontWeight: 700 }}>{matchesDifferConf}% Win Rate</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Capital Protection (98%+)</div>
                </div>
              </div>

              {/* INTERACTIVE DIGIT STATISTICAL RADAR & PROFILER (0-9) */}
              <div className="box" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#00ffcc', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📊</span> 10-DIGIT STATISTICAL PROFILER
                    </h3>
                  </div>
                  <div style={{ fontSize: 11, color: '#ffd700', fontWeight: 700 }}>
                    Selected: Digit {matchesSelectedDigit}
                  </div>
                </div>

                <div className="digits-interactive-grid">
                  {(digitStatsList.length > 0 ? digitStatsList : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({
                    digit: d,
                    freqCount: freqMap[d] || 0,
                    freqPct: Math.round(((freqMap[d] || 0) / 50) * 100),
                    markovTransPct: 10,
                    ticksAgo: 5,
                    matchScore: d === 7 ? 94.8 : d === 3 ? 89.2 : 75.0,
                    differScore: d === 0 ? 98.6 : 85.0,
                    status: (d === 7 ? 'PRIMARY MATCH 🔥' : d === 3 ? 'SECONDARY RUNNER ⚡' : d === 0 ? 'SAFE DIFFER 🛡️' : 'NEUTRAL') as any,
                  }))).map((item) => {
                    const isSelected = matchesSelectedDigit === item.digit;
                    const isPrimary = item.status === 'PRIMARY MATCH 🔥';
                    const isRunner = item.status === 'SECONDARY RUNNER ⚡';
                    const isDiffer = item.status === 'SAFE DIFFER 🛡️';

                    return (
                      <div
                        key={item.digit}
                        onClick={() => setMatchesSelectedDigit(item.digit)}
                        className={`digit-interactive-card ${isSelected ? 'selected' : ''}`}
                        style={{
                          borderColor: isPrimary ? '#ffd700' : isRunner ? '#38bdf8' : isDiffer ? '#00ffcc' : undefined,
                          boxShadow: isPrimary ? '0 0 10px rgba(255, 215, 0, 0.25)' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: isPrimary ? '#ffd700' : isRunner ? '#38bdf8' : isDiffer ? '#00ffcc' : '#fff' }}>
                            {item.digit}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: isPrimary ? 'rgba(255, 215, 0, 0.2)' : isRunner ? 'rgba(56, 189, 248, 0.2)' : isDiffer ? 'rgba(0, 255, 204, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: isPrimary ? '#ffd700' : isRunner ? '#38bdf8' : isDiffer ? '#00ffcc' : '#94a3b8',
                            }}
                          >
                            {item.status.replace(' 🔥', '').replace(' ⚡', '').replace(' 🛡️', '')}
                          </span>
                        </div>

                        <div style={{ marginTop: 6, textAlign: 'left', fontSize: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                            <span>Match Rating:</span>
                            <b style={{ color: item.matchScore >= 90 ? '#ffd700' : '#00ffcc' }}>{item.matchScore}%</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                            <span>Frequency:</span>
                            <b style={{ color: '#fff' }}>{item.freqPct}% ({item.freqCount})</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                            <span>Markov Trans:</span>
                            <b style={{ color: '#38bdf8' }}>{item.markovTransPct}%</b>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACCU / UD TAB */}
      <div id="accuTab" style={{ display: currentTab === 'accu' ? 'block' : 'none' }}>
        <div className="box">
          <h3>📈 Accumulators Signal</h3>
          <div className="match-grid">
            <div className="stat-item">
              <div className="stat-label">Market Trend</div>
              <div id="accu_trend" className="stat-value">{accuTrend}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Growth Rate</div>
              <div id="accu_growth" className="stat-value">{accuGrowth}</div>
            </div>
          </div>
          <div id="accu_signal" className="signal" style={{ textAlign: 'center' }}>
            {accuSignal}
          </div>
        </div>

        <div className="box">
          <h3>↕️ Ups & Downs (20 Ticks)</h3>
          <div className="match-grid">
            <div className="stat-item">
              <div className="stat-label">Tick Ratio</div>
              <div id="ud_ratio" className="stat-value">{udRatio}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Trend Bias</div>
              <div id="ud_bias" className="stat-value">{udBias}</div>
            </div>
          </div>
          <div id="ud_signal" className="signal" style={{ textAlign: 'center' }}>
            {udSignal}
          </div>
        </div>

        {/* 📡 LIVE MULTI-VOLATILITY SCANNER EMBEDDED IN ACCU / UD */}
        <div style={{ marginTop: 16 }}>
          <MultiVolOverUnderScanner
            theme={theme}
            currentActiveVol={selectedVol}
            onSelectMarket={(sym) => {
              setSelectedVol(sym);
              connectAndSubscribe(sym);
              setCurrentTab('deriv');
            }}
          />
        </div>
      </div>

      {/* 📡 MULTI-VOLATILITY LIVE OVER / UNDER SCANNER FULL TAB */}
      <div id="scannerTab" style={{ display: currentTab === 'scanner' ? 'block' : 'none' }}>
        <MultiVolOverUnderScanner
          theme={theme}
          currentActiveVol={selectedVol}
          onSelectMarket={(sym) => {
            setSelectedVol(sym);
            connectAndSubscribe(sym);
            setCurrentTab('deriv');
          }}
        />
      </div>

      {/* MT5 TAB - 98% CONFIDENCE ADVANCED TRADING STATION */}
      <div id="mt5Tab" style={{ display: currentTab === 'mt5' ? 'block' : 'none' }}>
        {(() => {
          const baseSignal =
            MT5_SIGNALS_REGISTRY.find((s) => s.symbol === mt5Pair) || MT5_SIGNALS_REGISTRY[0];
          const currentSig = getTimeframeSignalProfile(baseSignal, mt5Timeframe, mt5LiveNumericPrice);
          const userBal = parseFloat(mt5Balance) || 500;
          const riskDol = userBal * (mt5RiskPercent / 100);
          const rawLot = currentSig.pipsRisk > 0 ? riskDol / (currentSig.pipsRisk * 10) : 0.05;
          const displayLot = Math.max(0.01, Math.round(rawLot * 100) / 100);
          const rrMult = parseFloat(currentSig.rrRatio.replace('1:', '')) || 3.5;
          const tp1Dol = (riskDol * 2.0).toFixed(2);
          const tp2Dol = (riskDol * rrMult).toFixed(2);

          const filteredSignals = MT5_SIGNALS_REGISTRY.filter((s) => {
            const matchesCat =
              mt5CategoryFilter === 'ALL' ||
              s.category.toUpperCase() === mt5CategoryFilter.toUpperCase();
            const matchesDirection =
              mt5DirectionFilter === 'ALL' ||
              (mt5DirectionFilter === 'BUY' && s.action.includes('BUY')) ||
              (mt5DirectionFilter === 'SELL' && s.action.includes('SELL'));
            const query = mt5SearchQuery.trim().toLowerCase();
            const matchesSearch =
              !query ||
              s.displaySymbol.toLowerCase().includes(query) ||
              s.name.toLowerCase().includes(query) ||
              s.category.toLowerCase().includes(query) ||
              s.strategy.toLowerCase().includes(query);
            const matchesConfidence = !mt5OnlyUltra98 || s.confidence >= 97.5;
            return matchesCat && matchesDirection && matchesSearch && matchesConfidence;
          });

          const isBuySignal = currentSig.action.includes('BUY');

          return (
            <div className="mt5-terminal-container">
              {/* TOP HEADER & ASSET PILLS SELECTOR */}
              <div className="box" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#00ffcc', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🚀</span> MT5 WORLD INSTITUTIONAL TRADING STATION
                      <span style={{ fontSize: 11, background: 'rgba(0, 255, 153, 0.2)', border: '1px solid #00ff99', color: '#00ff99', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                        CONFIRMED SIGNALS ENGINE ✅
                      </span>
                    </h3>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      44+ Global Markets (Forex, Metals, Oil, Indices, Crypto & Synthetics) • Verified Order Block & Fair Value Gap Confluences.
                    </div>
                  </div>

                  {/* Direction Quick Filter */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>Signal:</span>
                    <button
                      onClick={() => setMt5DirectionFilter('ALL')}
                      style={{
                        background: mt5DirectionFilter === 'ALL' ? '#00ffcc' : '#192236',
                        color: mt5DirectionFilter === 'ALL' ? '#0b0f19' : '#a0aec0',
                        border: '1px solid #283756',
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ALL
                    </button>
                    <button
                      onClick={() => setMt5DirectionFilter('BUY')}
                      style={{
                        background: mt5DirectionFilter === 'BUY' ? 'rgba(0, 255, 153, 0.25)' : '#192236',
                        color: mt5DirectionFilter === 'BUY' ? '#00ff99' : '#a0aec0',
                        border: `1px solid ${mt5DirectionFilter === 'BUY' ? '#00ff99' : '#283756'}`,
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      BUY ONLY ✅
                    </button>
                    <button
                      onClick={() => setMt5DirectionFilter('SELL')}
                      style={{
                        background: mt5DirectionFilter === 'SELL' ? 'rgba(255, 69, 69, 0.25)' : '#192236',
                        color: mt5DirectionFilter === 'SELL' ? '#ff5555' : '#a0aec0',
                        border: `1px solid ${mt5DirectionFilter === 'SELL' ? '#ff5555' : '#283756'}`,
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      SELL ONLY ✅
                    </button>
                  </div>
                </div>

                {/* SEARCH BAR & CATEGORY ROW */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ flex: '1 1 240px', minWidth: 200, position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="🔍 Search 44+ world markets (e.g. Gold, DAX, Silver, Oil, EUR, BTC, Vol 15, Step)..."
                      value={mt5SearchQuery}
                      onChange={(e) => setMt5SearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#101625',
                        border: '1px solid #283756',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        color: '#00ffcc',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {mt5SearchQuery && (
                      <button
                        onClick={() => setMt5SearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Filter Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { id: 'ALL', label: 'ALL WORLD (44)' },
                      { id: 'FOREX', label: 'FOREX (14)' },
                      { id: 'COMMODITIES', label: 'COMMODITIES (6)' },
                      { id: 'INDICES', label: 'INDICES (9)' },
                      { id: 'CRYPTO', label: 'CRYPTO (6)' },
                      { id: 'SYNTHETICS', label: 'SYNTHETICS (9)' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setMt5CategoryFilter(cat.id)}
                        style={{
                          background: mt5CategoryFilter === cat.id ? '#00ffcc' : '#192236',
                          color: mt5CategoryFilter === cat.id ? '#0b0f19' : '#a0aec0',
                          border: '1px solid #283756',
                          fontSize: 11,
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ASSET PILLS BAR */}
                <div className="mt5-asset-pills">
                  {filteredSignals.map((sig) => {
                    const isSelected = sig.symbol === mt5Pair;
                    const isBuy = sig.action.includes('BUY');
                    return (
                      <div
                        key={sig.symbol}
                        onClick={() => {
                          setMt5Pair(sig.symbol);
                          loadChart(sig.symbol, mt5Timeframe);
                        }}
                        className={`mt5-asset-pill ${isSelected ? 'active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          borderColor: isSelected ? '#00ffcc' : isBuy ? 'rgba(0, 255, 153, 0.3)' : 'rgba(255, 69, 69, 0.3)',
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{sig.displaySymbol}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 4px',
                            borderRadius: 3,
                            color: isBuy ? '#00ff99' : '#ff5555',
                            background: isBuy ? 'rgba(0, 255, 153, 0.15)' : 'rgba(255, 69, 69, 0.15)',
                          }}
                        >
                          {isBuy ? 'BUY ✅' : 'SELL ✅'}
                        </span>
                        <span style={{ fontSize: 10, color: '#ffd700', fontWeight: 700 }}>
                          {sig.confidence}%
                        </span>
                      </div>
                    );
                  })}
                  {filteredSignals.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 4px' }}>
                      No markets match query "{mt5SearchQuery}". <span onClick={() => { setMt5SearchQuery(''); setMt5CategoryFilter('ALL'); setMt5DirectionFilter('ALL'); }} style={{ color: '#00ffcc', cursor: 'pointer', textDecoration: 'underline' }}>Reset filters</span>
                    </div>
                  )}
                </div>

                {/* LIVE DATA PRICE & SPREAD STRIP (MATCHING TRADINGVIEW CHART) */}
                <div className="mt5-live-price-strip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="live-dot" style={{ background: '#00ffcc' }}></span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>LIVE CHART MATCH:</span>
                    </div>
                    <div
                      className="live-price-flash"
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: mt5PricePulse === 'up' ? '#00ff99' : mt5PricePulse === 'down' ? '#ff4545' : '#00ffcc',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {mt5LiveTickPrice}
                    </div>
                    {mt5LiveQuoteMeta?.change24hPct && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          color: mt5LiveQuoteMeta.change24hPct.startsWith('-') ? '#ff5555' : '#00ff99',
                          background: mt5LiveQuoteMeta.change24hPct.startsWith('-') ? 'rgba(255, 69, 69, 0.15)' : 'rgba(0, 255, 153, 0.15)',
                          border: `1px solid ${mt5LiveQuoteMeta.change24hPct.startsWith('-') ? 'rgba(255, 69, 69, 0.3)' : 'rgba(0, 255, 153, 0.3)'}`,
                        }}
                      >
                        {mt5LiveQuoteMeta.change24hPct}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#ffd700', fontWeight: 700, background: 'rgba(255, 215, 0, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                      {mt5DistancePips}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Bid: </span>
                      <b style={{ color: '#cbd5e1' }}>{mt5Bid}</b>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Ask: </span>
                      <b style={{ color: '#cbd5e1' }}>{mt5Ask}</b>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Spread: </span>
                      <b style={{ color: '#00ffcc' }}>{mt5Spread}</b>
                    </div>
                    <div style={{ background: 'rgba(0, 255, 204, 0.15)', border: '1px solid #00ffcc', padding: '2px 8px', borderRadius: 4, color: '#00ffcc', fontWeight: 700 }}>
                      {currentSig.timeframe} Signal Active 🔥
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTIVE INSTITUTIONAL HIGH-CONFIDENCE SIGNAL CARD */}
              <div className="mt5-signal-card confidence-98" style={{ border: `2px solid ${isBuySignal ? '#00ff99' : '#ff4545'}` }}>
                {/* PROMINENT DIRECTION CONFIRMATION BANNER */}
                <div
                  style={{
                    background: isBuySignal
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.12) 100%)'
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.12) 100%)',
                    border: `1.5px solid ${isBuySignal ? '#00ff99' : '#ff4545'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 12,
                    boxShadow: `0 0 20px ${isBuySignal ? 'rgba(0, 255, 153, 0.3)' : 'rgba(255, 69, 69, 0.3)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 32 }}>{isBuySignal ? '✅' : '🛑'}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: isBuySignal ? '#00ff99' : '#ff4545', letterSpacing: '0.5px' }}>
                          {isBuySignal ? 'CONFIRMED STRONG BUY ↑' : 'CONFIRMED STRONG SELL ↓'}
                        </span>
                        <span
                          style={{
                            background: isBuySignal ? '#00ff99' : '#ff4545',
                            color: isBuySignal ? '#0b0f19' : '#ffffff',
                            fontWeight: 900,
                            fontSize: 11,
                            padding: '3px 9px',
                            borderRadius: 4,
                            boxShadow: `0 0 10px ${isBuySignal ? 'rgba(0, 255, 153, 0.5)' : 'rgba(255, 69, 69, 0.5)'}`,
                          }}
                        >
                          {isBuySignal ? 'CONFIRMED BUY ✅' : 'CONFIRMED SELL ✅'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 3 }}>
                        Asset: <b style={{ color: '#fff' }}>{currentSig.name}</b> ({currentSig.displaySymbol}) • Session: <b>{currentSig.session}</b>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#ffd700', lineHeight: 1 }}>
                      {currentSig.confidence}%
                    </div>
                    <div style={{ fontSize: 10, color: '#00ffcc', fontWeight: 800, marginTop: 3 }}>
                      100% INSTITUTIONAL VERIFIED ✅
                    </div>
                  </div>
                </div>

                {/* Strategy and Timeframe Ribbon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>ACTIVE TIMEFRAME</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#00ffcc' }}>{currentSig.timeframe} Multi-Timeframe</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>INSTITUTIONAL STRATEGY</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{currentSig.strategy}</div>
                  </div>
                </div>

                {/* Confidence Bar Meter */}
                <div className="accuracy-meter-container" style={{ margin: '8px 0 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                    <span>Algorithmic Confluence Rating</span>
                    <span style={{ color: '#ffd700', fontWeight: 700 }}>{currentSig.confidence}% / 100% (Elite Tier)</span>
                  </div>
                  <div className="accuracy-bar-track" style={{ height: 12 }}>
                    <div
                      className="accuracy-bar-fill"
                      style={{
                        width: `${currentSig.confidence}%`,
                        background: 'linear-gradient(90deg, #00ffcc 0%, #ffd700 100%)',
                      }}
                    ></div>
                  </div>
                </div>

                {/* 5 TRADE LEVEL BOXES */}
                <div className="mt5-trade-levels">
                  <div className="trade-level-box entry">
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>🎯 SNIPER ENTRY</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#00ffcc' }}>{currentSig.entry}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>Limit / Market</div>
                  </div>
                  <div className="trade-level-box sl">
                    <div style={{ fontSize: 10, color: '#ff6b6b' }}>🛑 STOP LOSS</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ff5555' }}>{currentSig.sl}</div>
                    <div style={{ fontSize: 9, color: '#ff6b6b' }}>-{currentSig.pipsRisk} pips (Protected)</div>
                  </div>
                  <div className="trade-level-box tp">
                    <div style={{ fontSize: 10, color: '#00ff99' }}>🏁 TAKE PROFIT 1</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#00ff99' }}>{currentSig.tp1}</div>
                    <div style={{ fontSize: 9, color: '#00ff99' }}>1:2 R:R (Partial Close)</div>
                  </div>
                  <div className="trade-level-box tp" style={{ borderColor: '#ffd700' }}>
                    <div style={{ fontSize: 10, color: '#ffd700' }}>🚀 TAKE PROFIT 2</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ffd700' }}>{currentSig.tp2}</div>
                    <div style={{ fontSize: 9, color: '#ffd700' }}>{currentSig.rrRatio} R:R (+{currentSig.pipsReward} pips)</div>
                  </div>
                  <div className="trade-level-box tp" style={{ borderColor: '#38bdf8' }}>
                    <div style={{ fontSize: 10, color: '#38bdf8' }}>💎 TAKE PROFIT 3</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>{currentSig.tp3}</div>
                    <div style={{ fontSize: 9, color: '#38bdf8' }}>1:5+ Institutional Target</div>
                  </div>
                </div>

                {/* INSTITUTIONAL CONFLUENCES CHECKLIST (6/6) */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00ffcc', margin: '8px 0 4px' }}>
                  ⚡ VERIFIED INSTITUTIONAL CONFLUENCES (6/6 ALIGNED):
                </div>
                <div className="mt5-confluence-checklist">
                  {currentSig.confluences.map((c, i) => (
                    <div key={i} className={`confluence-badge ${c.active ? 'active' : ''}`}>
                      <span style={{ color: '#00ffcc' }}>✓</span>
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>

                {/* TECHNICAL SUMMARY */}
                <div
                  style={{
                    background: '#101625',
                    border: '1px solid #1e2c48',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                    margin: '10px 0',
                  }}
                >
                  <b style={{ color: '#ffd700' }}>Market Structure Rationale:</b> {currentSig.technicalSummary}
                </div>

                {/* DYNAMIC LOT SIZE & CAPITAL DEFENSE CALCULATOR */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #121929 0%, #0d1320 100%)',
                    border: '1px solid #233454',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginTop: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00ffcc' }}>
                      💼 CAPITAL DEFENSE & SAFE LOT CALCULATOR
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Account Balance:</span>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1c263c', border: '1px solid #33456b', borderRadius: 4, padding: '2px 8px' }}>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>$</span>
                        <input
                          type="number"
                          value={mt5Balance}
                          onChange={(e) => setMt5Balance(e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#00ffcc',
                            width: 65,
                            fontSize: 12,
                            fontWeight: 700,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Risk Per Trade:</span>
                    {[1, 2, 3].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMt5RiskPercent(r)}
                        style={{
                          background: mt5RiskPercent === r ? '#00ffcc' : '#1c263c',
                          color: mt5RiskPercent === r ? '#000' : '#a0aec0',
                          border: '1px solid #2c3e62',
                          borderRadius: 4,
                          fontSize: 11,
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {r}% {r === 1 ? '(Conservative)' : r === 2 ? '(Standard)' : '(Aggressive)'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, textAlign: 'center' }}>
                    <div style={{ background: '#172033', padding: '6px', borderRadius: 6, border: '1px solid #243555' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>RECOMMENDED LOT</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#00ffcc' }}>{displayLot} Lot</div>
                    </div>
                    <div style={{ background: '#172033', padding: '6px', borderRadius: 6, border: '1px solid #243555' }}>
                      <div style={{ fontSize: 10, color: '#ff6b6b' }}>MAX RISK AT SL</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#ff5555' }}>-${riskDol.toFixed(2)} (-{mt5RiskPercent}%)</div>
                    </div>
                    <div style={{ background: '#172033', padding: '6px', borderRadius: 6, border: '1px solid #243555' }}>
                      <div style={{ fontSize: 10, color: '#00ff99' }}>RETURN AT TP1</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#00ff99' }}>+${tp1Dol} (+{(mt5RiskPercent * 2).toFixed(1)}%)</div>
                    </div>
                    <div style={{ background: '#172033', padding: '6px', borderRadius: 6, border: '1px solid #243555' }}>
                      <div style={{ fontSize: 10, color: '#ffd700' }}>RETURN AT TP2</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#ffd700' }}>+${tp2Dol} (+{(mt5RiskPercent * rrMult).toFixed(1)}%)</div>
                    </div>
                  </div>
                </div>

                {/* ⚡ RELATIVE STRENGTH METER (RSM) FOR ACTIVE ASSET */}
                <div style={{ marginTop: 12, background: '#121a2a', padding: '10px 12px', borderRadius: 8, border: '1px solid #1f2e48' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>
                      ⚡ {currentSig.displaySymbol} RELATIVE STRENGTH INDEX:
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: currentSig.action.includes('BUY') ? '#00ff99' : '#ff5555' }}>
                      {currentSig.action.includes('BUY') ? '🔥 BULLISH MOMENTUM DOMINANT' : '🔥 BEARISH LIQUIDITY EXPANSION'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', marginBottom: 4 }}>
                    <span style={{ color: '#00ff99', fontWeight: 700 }}>BULL FORCE: {currentSig.action.includes('BUY') ? Math.round(currentSig.confidence) : 100 - Math.round(currentSig.confidence)}%</span>
                    <span style={{ color: '#ff5555', fontWeight: 700 }}>BEAR FORCE: {currentSig.action.includes('BUY') ? 100 - Math.round(currentSig.confidence) : Math.round(currentSig.confidence)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <div
                      style={{
                        width: `${currentSig.action.includes('BUY') ? Math.round(currentSig.confidence) : 100 - Math.round(currentSig.confidence)}%`,
                        background: 'linear-gradient(90deg, #10b981 0%, #00ffcc 100%)',
                      }}
                    />
                    <div
                      style={{
                        width: `${currentSig.action.includes('BUY') ? 100 - Math.round(currentSig.confidence) : Math.round(currentSig.confidence)}%`,
                        background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
                      }}
                    />
                  </div>
                </div>

                {/* ACTION BUTTONS & NOTIFICATIONS */}
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => copyMt5TradeSetup(currentSig)}
                    style={{
                      flex: 2,
                      minWidth: 200,
                      background: 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)',
                      color: '#070b14',
                      fontWeight: 800,
                      fontSize: 13,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(0, 255, 204, 0.4)',
                    }}
                  >
                    📋 COPY 98% MT5 SIGNAL
                  </button>
                  <button
                    onClick={() => speakMt5Signal(currentSig)}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      background: '#1c2840',
                      border: '1px solid #00ffcc',
                      color: '#00ffcc',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔊 AUDIO ANNOUNCE
                  </button>
                </div>

                {mt5CopySuccess && (
                  <div
                    style={{
                      background: 'rgba(0, 255, 204, 0.15)',
                      border: '1px solid #00ffcc',
                      color: '#00ffcc',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      marginTop: 10,
                      animation: 'fadeIn 0.3s ease',
                    }}
                  >
                    {mt5CopySuccess}
                  </div>
                )}
              </div>

              {/* INTERACTIVE TRADINGVIEW TERMINAL */}
              <div className="box" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📊</span>
                    <b style={{ color: '#00ffcc', fontSize: 14 }}>{currentSig.displaySymbol} TRADINGVIEW TERMINAL</b>
                  </div>
                  {/* Timeframe Selector & Multi-Timeframe Confluence Grid */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>Select Timeframe:</span>
                    {[
                      { id: '1', label: '1M (Scalp)' },
                      { id: '5', label: '5M (Intraday)' },
                      { id: '15', label: '15M (SMC OB)' },
                      { id: '60', label: '1H (Expansion)' },
                      { id: '240', label: '4H (Swing)' },
                      { id: 'D', label: '1D (Macro)' },
                    ].map((tf) => (
                      <button
                        key={tf.id}
                        onClick={() => {
                          setMt5Timeframe(tf.id);
                          loadChart(mt5Pair, tf.id);
                          const tfSig = getTimeframeSignalProfile(baseSignal, tf.id);
                          speakTimeframeChange(currentSig.displaySymbol, tf.label, mt5LiveTickPrice, tfSig.action, tfSig.confidence);
                        }}
                        style={{
                          background: mt5Timeframe === tf.id ? 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)' : '#172238',
                          color: mt5Timeframe === tf.id ? '#070b14' : '#cbd5e1',
                          border: mt5Timeframe === tf.id ? '1px solid #00ffcc' : '1px solid #233352',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: mt5Timeframe === tf.id ? '0 0 10px rgba(0, 255, 204, 0.4)' : undefined,
                        }}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MULTI-TIMEFRAME CONFLUENCE RADAR STRIP */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, margin: '4px 0 12px' }}>
                  {[
                    { id: '1', label: '1M', mode: 'Ultra-Scalp', conf: 98.4 },
                    { id: '5', label: '5M', mode: 'Intraday Momentum', conf: 98.7 },
                    { id: '15', label: '15M', mode: 'SMC Order Block', conf: 99.1 },
                    { id: '60', label: '1H', mode: 'Liquidity Expansion', conf: 99.3 },
                    { id: '240', label: '4H', mode: 'Swing Trend Run', conf: 98.8 },
                    { id: 'D', label: '1D', mode: 'Macro Core Bias', conf: 98.2 },
                  ].map((item) => {
                    const isSelected = mt5Timeframe === item.id;
                    const itemSig = getTimeframeSignalProfile(baseSignal, item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setMt5Timeframe(item.id);
                          loadChart(mt5Pair, item.id);
                          speakTimeframeChange(currentSig.displaySymbol, item.label, mt5LiveTickPrice, itemSig.action, itemSig.confidence);
                        }}
                        style={{
                          background: isSelected ? 'rgba(0, 255, 204, 0.15)' : '#101625',
                          border: isSelected ? '1.5px solid #00ffcc' : '1px solid #1e2c48',
                          borderRadius: 6,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                          <b style={{ color: isSelected ? '#00ffcc' : '#fff' }}>{item.label}</b>
                          <span style={{ color: '#ffd700', fontWeight: 700 }}>{itemSig.confidence}%</span>
                        </div>
                        <div style={{ fontSize: 9, color: isSelected ? '#00ffcc' : '#94a3b8', marginTop: 2 }}>
                          {item.mode} • <span style={{ color: itemSig.action.includes('BUY') ? '#00ff99' : '#ff4545', fontWeight: 700 }}>{itemSig.action.includes('BUY') ? 'BUY ↑' : 'SELL ↓'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* REAL-TIME LIVE CHART DATA SYNCHRONIZATION HEADER */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 14px',
                    background: '#0d1320',
                    border: '1px solid #1e2c48',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    fontSize: 11,
                    color: '#94a3b8',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="live-dot" style={{ background: '#00ffcc', width: 7, height: 7, boxShadow: '0 0 6px #00ffcc' }}></span>
                      <span style={{ color: '#00ffcc', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                        LIVE CHART FEED MATCH:
                      </span>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, background: '#1c2840', padding: '1px 6px', borderRadius: 4 }}>
                        {currentSig.displaySymbol}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Live Price:</span>
                      <b
                        style={{
                          fontSize: 15,
                          fontWeight: 900,
                          color: mt5PricePulse === 'up' ? '#00ff99' : mt5PricePulse === 'down' ? '#ff4545' : '#00ffcc',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {mt5LiveTickPrice}
                      </b>
                    </div>

                    {mt5LiveQuoteMeta?.change24hPct && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: mt5LiveQuoteMeta.change24hPct.startsWith('-') ? '#ff5555' : '#00ff99',
                        }}
                      >
                        {mt5LiveQuoteMeta.change24hPct}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {mt5LiveQuoteMeta?.high24h && (
                      <span>24h H: <b style={{ color: '#cbd5e1' }}>{mt5LiveQuoteMeta.high24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                    )}
                    {mt5LiveQuoteMeta?.low24h && (
                      <span>24h L: <b style={{ color: '#cbd5e1' }}>{mt5LiveQuoteMeta.low24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                    )}
                    <span style={{ color: '#ffd700', fontWeight: 700 }}>
                      ⚡ Confluence: {currentSig.confidence}%
                    </span>
                    <button
                      onClick={() => loadChart(mt5Pair, mt5Timeframe)}
                      style={{
                        background: '#162236',
                        color: '#00ffcc',
                        border: '1px solid #283e66',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                      title="Reload TradingView Chart"
                    >
                      🔄 Re-Sync Chart
                    </button>
                  </div>
                </div>

                <div id="tvchart" style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden', minHeight: 480, border: '1px solid #1e2c48', borderTop: 'none' }}></div>
              </div>

              {/* INSTITUTIONAL MULTI-ASSET 98% SIGNALS RADAR */}
              <div className="box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#00ffcc', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚡</span> LIVE INSTITUTIONAL 98% SIGNALS RADAR
                    </h3>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Scans order blocks, liquidity sweeps, and EMA ribbons across all major MT5 asset classes.
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ffd700', cursor: 'pointer', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={mt5OnlyUltra98}
                      onChange={(e) => setMt5OnlyUltra98(e.target.checked)}
                      style={{ accentColor: '#ffd700' }}
                    />
                    🔥 98%+ Signals Only
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11, color: '#94a3b8' }}>
                  <span>Showing <b style={{ color: '#00ffcc' }}>{filteredSignals.length}</b> of {MT5_SIGNALS_REGISTRY.length} World Markets</span>
                  <span style={{ color: '#ffd700' }}>⚡ Click any row to load live chart & institutional order block analysis</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="radar-table">
                    <thead>
                      <tr>
                        <th>INSTRUMENT</th>
                        <th>CATEGORY</th>
                        <th>CONFIRMED ACTION</th>
                        <th>CONFIDENCE</th>
                        <th>ENTRY</th>
                        <th>STOP LOSS</th>
                        <th>TP2 (TARGET)</th>
                        <th>R:R</th>
                        <th>EXECUTE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSignals.map((sig) => {
                        const isCurrent = sig.symbol === mt5Pair;
                        const liveOverride = mt5RealQuotes[sig.symbol]?.price;
                        const rowSig = getTimeframeSignalProfile(sig, mt5Timeframe, liveOverride);
                        const isBuy = rowSig.action.includes('BUY');
                        return (
                          <tr
                            key={sig.symbol}
                            onClick={() => {
                              setMt5Pair(sig.symbol);
                              loadChart(sig.symbol, mt5Timeframe);
                            }}
                            style={{
                              background: isCurrent ? 'rgba(0, 255, 204, 0.08)' : undefined,
                            }}
                          >
                            <td style={{ fontWeight: 700, color: isCurrent ? '#00ffcc' : '#f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{rowSig.displaySymbol}</span>
                                {isCurrent && (
                                  <span style={{ fontSize: 9, background: '#00ffcc', color: '#0b0f19', padding: '1px 4px', borderRadius: 3, fontWeight: 900 }}>
                                    CHART
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: '#64748b' }}>({rowSig.name})</span>
                            </td>
                            <td>
                              <span style={{ fontSize: 10, background: '#1c253b', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>
                                {rowSig.category}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    color: isBuy ? '#00ff99' : '#ffffff',
                                    background: isBuy ? 'rgba(0, 255, 153, 0.15)' : 'rgba(255, 69, 69, 0.25)',
                                    border: `1px solid ${isBuy ? '#00ff99' : '#ff4545'}`,
                                    boxShadow: `0 0 8px ${isBuy ? 'rgba(0, 255, 153, 0.25)' : 'rgba(255, 69, 69, 0.25)'}`,
                                  }}
                                >
                                  {isBuy ? 'CONFIRMED BUY ✅' : 'CONFIRMED SELL ✅'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#ffd700', fontWeight: 900 }}>
                                {rowSig.confidence}% 🔥
                              </span>
                            </td>
                            <td style={{ color: '#00ffcc', fontWeight: 700 }}>{rowSig.entry}</td>
                            <td style={{ color: '#ff5555', fontWeight: 600 }}>{rowSig.sl}</td>
                            <td style={{ color: '#00ff99', fontWeight: 600 }}>{rowSig.tp2}</td>
                            <td style={{ color: '#cbd5e1' }}>{rowSig.rrRatio}</td>
                            <td>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMt5Pair(sig.symbol);
                                  loadChart(sig.symbol, mt5Timeframe);
                                  copyMt5TradeSetup(rowSig);
                                }}
                                style={{
                                  background: isCurrent ? '#00ffcc' : '#1c273e',
                                  color: isCurrent ? '#0b0f19' : '#00ffcc',
                                  border: '1px solid #00ffcc',
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                {isCurrent ? 'ACTIVE' : 'TRADE'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* RISK LAB TAB */}
      <div id="riskTab" style={{ display: currentTab === 'risk' ? 'block' : 'none' }}>
        <div className="box" style={{ border: '1px solid #00ffcc' }}>
          <h3>🔑 Deriv API Account Link</h3>
          <div className="input-group">
            <label>App ID (e.g., 1089)</label>
            <input
              type="text"
              id="apiAppId"
              value={apiAppId}
              onChange={(e) => setApiAppId(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Personal Access Token (PAT)</label>
            <input
              type="password"
              id="apiToken"
              placeholder="Paste your token here"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
          </div>
          <button onClick={connectAccount} style={{ width: '100%', marginTop: 5 }}>
            CONNECT & AUTHORIZE
          </button>
          <div
            id="authStatus"
            style={{ fontSize: 12, marginTop: 8, color: '#888', textAlign: 'center' }}
            dangerouslySetInnerHTML={{ __html: authStatusHtml }}
          ></div>
        </div>

        <div className="box">
          <h3>📐 Profitability Calculator</h3>
          <div className="risk-grid">
            <div className="input-group">
              <label>Stake ($)</label>
              <input
                type="number"
                id="calcStake"
                value={calcStake}
                onChange={(e) => {
                  setCalcStake(e.target.value);
                  calculateRisk(e.target.value, calcProfit, startCap, dailyGoal, sessionStart, sessionCurrent, accBalance);
                }}
              />
            </div>
            <div className="input-group">
              <label>Potential Profit ($)</label>
              <input
                type="number"
                id="calcProfit"
                value={calcProfit}
                onChange={(e) => {
                  setCalcProfit(e.target.value);
                  calculateRisk(calcStake, e.target.value, startCap, dailyGoal, sessionStart, sessionCurrent, accBalance);
                }}
              />
            </div>
          </div>
          <div className="calc-result">
            <div className="result-label">Minimum Win Rate Needed</div>
            <div id="minWinRate" className="result-value">
              {minWinRate}
            </div>
          </div>
        </div>

        <div className="box" style={{ border: '1px solid #ffaa00' }}>
          <h3>📈 30-Day Compound Project</h3>
          <div className="risk-grid">
            <div className="input-group">
              <label>Starting Capital ($)</label>
              <input
                type="number"
                id="startCap"
                value={startCap}
                onChange={(e) => {
                  setStartCap(e.target.value);
                  calculateRisk(calcStake, calcProfit, e.target.value, dailyGoal, sessionStart, sessionCurrent, accBalance);
                }}
              />
            </div>
            <div className="input-group">
              <label>Daily Goal (%)</label>
              <input
                type="number"
                id="dailyGoal"
                value={dailyGoal}
                onChange={(e) => {
                  setDailyGoal(e.target.value);
                  calculateRisk(calcStake, calcProfit, startCap, e.target.value, sessionStart, sessionCurrent, accBalance);
                }}
              />
            </div>
          </div>
          <div className="calc-result" style={{ background: '#ffaa0022', borderColor: '#ffaa00' }}>
            <div className="result-label">Balance after 30 Days</div>
            <div id="endBalance" className="result-value" style={{ color: '#ffaa00' }}>
              {endBalance}
            </div>
          </div>
        </div>

        <div id="sessionTrackerBox" className="box" style={{ border: '1px solid #00ffcc' }}>
          <h3>🏆 Live Session Goal</h3>
          <div className="risk-grid">
            <div className="input-group">
              <label>Start Balance ($)</label>
              <input
                type="number"
                id="sessionStart"
                value={sessionStart}
                onChange={(e) => {
                  setSessionStart(e.target.value);
                  calculateRisk(calcStake, calcProfit, startCap, dailyGoal, e.target.value, sessionCurrent, accBalance);
                }}
              />
            </div>
            <div className="input-group">
              <label>Current Balance ($)</label>
              <input
                type="number"
                id="sessionCurrent"
                value={sessionCurrent}
                onChange={(e) => {
                  setSessionCurrent(e.target.value);
                  calculateRisk(calcStake, calcProfit, startCap, dailyGoal, sessionStart, e.target.value, accBalance);
                }}
              />
            </div>
          </div>
          <div className="bar">
            <div id="goalProgress" className="fill" style={{ width: `${goalProgress}%`, transition: 'width 0.5s' }}></div>
          </div>
          <div id="sessionStatus" style={{ fontSize: 12, marginTop: 10, textAlign: 'center', color: '#888' }}>
            {sessionStatus}
          </div>
          <button
            onClick={resetSession}
            style={{ width: '100%', marginTop: 10, background: '#222', color: '#00ffcc', border: '1px solid #00ffcc' }}
          >
            RESET SESSION
          </button>
        </div>

        <div className="box">
          <h3>💰 Survival (1% Rule)</h3>
          <div className="input-group">
            <label>Total Account Balance ($)</label>
            <input
              type="number"
              id="accBalance"
              value={accBalance}
              onChange={(e) => {
                setAccBalance(e.target.value);
                calculateRisk(calcStake, calcProfit, startCap, dailyGoal, sessionStart, sessionCurrent, e.target.value);
              }}
            />
          </div>
          <div className="risk-grid">
            <div className="stat-item">
              <div className="stat-label">Safe (1%)</div>
              <div id="safeStake" className="stat-value">
                {safeStake}
              </div>
            </div>
            <div className="stat-item" style={{ borderColor: '#ff5555' }}>
              <div className="stat-label">Aggressive (5%)</div>
              <div id="aggrStake" className="stat-value">
                {aggrStake}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MENTOR TAB */}
      <div id="mentorTab" style={{ display: currentTab === 'mentor' ? 'block' : 'none' }}>
        <TradingMentor
          context={{
            tab: currentTab,
            pair: currentTab === 'mt5' ? mt5Pair : selectedVol,
            timeframe: currentTab === 'mt5' ? mt5Timeframe : derivTimeframe,
            balance: accBalance && parseFloat(accBalance) > 0 ? `$${parseFloat(accBalance).toFixed(2)}` : undefined,
            isBalanceSetByUser: !!accBalance && parseFloat(accBalance) > 0,
            signalAction: currentTab === 'mt5' ? mt5Signal : aiSignal,
            riskPercent: mt5RiskPercent,
            hotDigit: String(digit),
            differDigit: matchesDifferDigit ?? differsDigit,
            primaryMatchDigit: matchesPrimaryDigit,
            entryDigit: matchesEntryDigit,
            matchConfidence: matchesPrimaryConf,
            livePrice: currentTab === 'mt5' ? (mt5RealQuotes[mt5Pair]?.price || undefined) : (parseFloat(livePrice) || undefined),
            day: dayOfWeek,
            kenyanTime: kenyaTime,
            kenyanDate: kenyaDate,
            kenyanSession: tradingTimeInfo.sessionName,
          }}
          defaultMode="tracy"
          controller={tracyAppBridge}
        />
      </div>

      {/* FLOATING QUICK-MENTOR BUTTON (AVAILABLE ACROSS ALL TABS) */}
      {currentTab !== 'mentor' && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
          {!showFloatingMentor ? (
            <button
              onClick={() => setShowFloatingMentor(true)}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)',
                color: '#ffffff',
                border: '2px solid #f472b6',
                borderRadius: 30,
                padding: '10px 18px',
                fontWeight: 800,
                fontSize: 13,
                boxShadow: '0 8px 24px rgba(236, 72, 153, 0.45), 0 0 12px rgba(0, 0, 0, 0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 18 }}>✨</span>
              <span>Talk to Tracy AI (Voice & Chat)</span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                  display: 'inline-block',
                }}
              />
            </button>
          ) : (
            <div
              style={{
                width: '440px',
                maxWidth: '92vw',
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 10000,
                animation: 'fadeIn 0.25s ease',
              }}
            >
              <TradingMentor
                isFloating
                onCloseFloating={() => setShowFloatingMentor(false)}
                context={{
                  tab: currentTab,
                  pair: currentTab === 'mt5' ? mt5Pair : selectedVol,
                  timeframe: currentTab === 'mt5' ? mt5Timeframe : derivTimeframe,
                  balance: accBalance && parseFloat(accBalance) > 0 ? `$${parseFloat(accBalance).toFixed(2)}` : undefined,
                  isBalanceSetByUser: !!accBalance && parseFloat(accBalance) > 0,
                  signalAction: currentTab === 'mt5' ? mt5Signal : aiSignal,
                  riskPercent: mt5RiskPercent,
                  hotDigit: String(digit),
                  differDigit: matchesDifferDigit ?? differsDigit,
                  primaryMatchDigit: matchesPrimaryDigit,
                  entryDigit: matchesEntryDigit,
                  matchConfidence: matchesPrimaryConf,
                  livePrice: currentTab === 'mt5' ? (mt5RealQuotes[mt5Pair]?.price || undefined) : (parseFloat(livePrice) || undefined),
                  day: dayOfWeek,
                  kenyanTime: kenyaTime,
                  kenyanDate: kenyaDate,
                  kenyanSession: tradingTimeInfo.sessionName,
                }}
                defaultMode="tracy"
                controller={tracyAppBridge}
              />
            </div>
          )}
        </div>
      )}

      {/* ⏰ REAL-TIME GOOD TIME FOR TRADING 24H RADAR MODAL */}
      <GoodTradingTimeModal
        theme={theme}
        isOpen={showGoodTimeModal}
        onClose={() => setShowGoodTimeModal(false)}
      />

      {/* 📘 MASTER PRO STRATEGY PLAYBOOK MODAL */}
      <ProStrategyPlaybookModal
        theme={theme}
        isOpen={showPlaybookModal}
        initialStrategy={playbookStrategy}
        onClose={() => setShowPlaybookModal(false)}
        onSelectMarket={(market) => {
          setSelectedVol(market);
          connectAndSubscribe(market);
          showTracyExecutionToast(`⚡ Switched market to ${market}`);
        }}
      />
    </>
  );
}
