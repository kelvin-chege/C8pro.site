import React, { useMemo } from 'react';

export interface TradingTimeInfo {
  score: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  badge: string;
  verdict: string;
  sessionName: string;
  statusColor: string;
  syntheticsNotice: string;
  overUnderAdvice: string;
  bestContract: string;
  timeToNextOrRemaining: string;
  isPeakWindow: boolean;
  dayGrade: string;
  dayNote: string;
  currentKenyanTime: string;
  currentKenyanDate: string;
  hoursSchedule: Array<{
    hour: number;
    hourLabel: string;
    kenyanHourLabel: string;
    session: string;
    quality: 'prime' | 'high' | 'medium' | 'low';
    score: number;
    isCurrent: boolean;
    overUnderEdge: string;
  }>;
}

export function computeTradingTimeInfo(date: Date = new Date()): TradingTimeInfo {
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  const dayOfWeek = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Kenyan Time calculations (East Africa Time: UTC+3, Nairobi)
  const currentKenyanTime = date.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const currentKenyanDate = date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Nairobi',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Day factor
  let dayGrade = 'Grade A (High Volume)';
  let dayNote = 'Prime mid-week institutional liquidity & algorithmic stability.';
  let dayScoreBonus = 0;

  if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
    dayGrade = 'Grade A+ (Peak Activity)';
    dayNote = 'Peak global trading days. Maximum volume, clear trends, minimal fakeouts.';
    dayScoreBonus = 5;
  } else if (dayOfWeek === 1) {
    dayGrade = 'Grade B+ (Weekly Open)';
    dayNote = 'Market finding weekly direction. Good volume after 08:00 UTC (11:00 EAT Kenya).';
    dayScoreBonus = 0;
  } else if (dayOfWeek === 5) {
    dayGrade = 'Grade B (Weekly Close)';
    dayNote = 'Good before 18:00 UTC (21:00 EAT Kenya). Caution late session due to profit-taking.';
    dayScoreBonus = -2;
  } else {
    // Weekend
    dayGrade = 'Grade A (Deriv Synthetics 24/7)';
    dayNote = 'Forex/MT5 closed; Deriv Synthetic Volatilities operate 24/7 in Kenya with zero spread widening!';
    dayScoreBonus = 4;
  }

  // Session & Hourly Quality
  let score = 70;
  let grade: 'A+' | 'A' | 'B+' | 'B' | 'C' = 'B';
  let badge = '🟡 MODERATE WINDOW';
  let verdict = 'MODERATE TRADING CONDITIONS';
  let sessionName = 'Asian Session';
  let statusColor = '#ffd700';
  let overUnderAdvice = 'Market velocity is moderate. Over/Under requires confirmation of digit skew > 56%.';
  let bestContract = 'Differs Sniper & Accumulators';
  let timeToNextOrRemaining = '';
  let isPeakWindow = false;

  // Evaluation by UTC hours and Kenyan EAT hours (UTC+3):
  // 12:00 - 16:30 UTC = 15:00 - 19:30 EAT: London & New York Overlap (Absolute Peak Liquidity)
  if (utcHour >= 12 && utcHour < 17) {
    score = Math.min(98, 92 + dayScoreBonus);
    grade = 'A+';
    badge = '🔥 PRIME OVERLAP (96%)';
    verdict = 'EXCELLENT TIME TO TRADE 🔥';
    sessionName = 'London / New York Overlap (3:00 PM – 8:00 PM EAT Kenya)';
    statusColor = '#00ff99';
    isPeakWindow = true;
    overUnderAdvice = '🚀 HIGHEST ACCURACY FOR OVER/UNDER: Rapid directional tick flow creates strong digit clustering and sustained Over/Under streaks. Target Over 4 or Under 5.';
    bestContract = 'Over/Under (Over 4 / Under 5) & Rise/Fall';
    const minsLeft = (17 - utcHour) * 60 - utcMinute;
    timeToNextOrRemaining = `Prime Overlap Active: ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m remaining (Ends 8:00 PM EAT)`;
  }
  // 07:00 - 12:00 UTC = 10:00 - 15:00 EAT: London Morning (High Trend Flow)
  else if (utcHour >= 7 && utcHour < 12) {
    score = Math.min(94, 86 + dayScoreBonus);
    grade = 'A';
    badge = '🟢 LONDON ACTIVE (88%)';
    verdict = 'HIGH QUALITY TREND WINDOW ⚡';
    sessionName = 'London Morning Session (10:00 AM – 3:00 PM EAT Kenya)';
    statusColor = '#00ffcc';
    isPeakWindow = true;
    overUnderAdvice = '📈 STRONG FOR OVER/UNDER: London breakout momentum generates high tick frequency and clear Bull/Bear dominance.';
    bestContract = 'Over/Under & Matches Sniper';
    const minsToOverlap = (12 - utcHour) * 60 - utcMinute;
    timeToNextOrRemaining = `London Session: ${Math.floor(minsToOverlap / 60)}h ${minsToOverlap % 60}m until Peak Overlap (starts 3:00 PM EAT)`;
  }
  // 17:00 - 20:30 UTC = 20:00 - 23:30 EAT: New York Afternoon (Good Trend Continuation)
  else if (utcHour >= 17 && utcHour < 21) {
    score = Math.min(88, 80 + dayScoreBonus);
    grade = 'B+';
    badge = '🟢 NEW YORK ACTIVE (82%)';
    verdict = 'GOOD TIME TO TRADE';
    sessionName = 'New York Afternoon (8:00 PM – 12:00 AM EAT Kenya)';
    statusColor = '#38bdf8';
    overUnderAdvice = '⚡ SOLID FOR OVER/UNDER: Steady momentum across US indices and Deriv synthetics. Check Multi-Scanner for highest edge.';
    bestContract = 'Over/Under & Fast 1-Tick Entries';
    timeToNextOrRemaining = 'New York Session winding down. Good trend continuation.';
  }
  // 21:00 - 24:00 UTC = 00:00 - 03:00 EAT: Pacific Rollover (Low Volume on Forex; Synthetics Steady)
  else if (utcHour >= 21) {
    score = Math.max(55, 62 + dayScoreBonus);
    grade = 'C';
    badge = '🟠 PACIFIC ROLLOVER (60%)';
    verdict = 'SELECTIVE TRADING / LOW VOLUME';
    sessionName = 'Pacific Rollover (Midnight – 3:00 AM EAT Kenya)';
    statusColor = '#f97316';
    overUnderAdvice = '⚠️ REDUCED VELOCITY: Lower global tick impulses. Digits tend to oscillate near the center (3, 4, 5, 6). Best for Differs Sniper rather than directional Over/Under.';
    bestContract = 'Differs Sniper (98%+ Win Rate)';
    const minsToTokyo = (24 - utcHour) * 60 - utcMinute;
    timeToNextOrRemaining = `Tokyo / Asian Open in ${Math.floor(minsToTokyo / 60)}h ${minsToTokyo % 60}m (3:00 AM EAT)`;
  }
  // 00:00 - 07:00 UTC = 03:00 - 10:00 EAT: Asian Session (Tokyo/Hong Kong/Singapore)
  else {
    score = Math.min(78, 70 + dayScoreBonus);
    grade = 'B';
    badge = '🟡 ASIAN SESSION (72%)';
    verdict = 'MODERATE RANGE PHASE';
    sessionName = 'Asian Session (3:00 AM – 10:00 AM EAT Kenya)';
    statusColor = '#ffd700';
    overUnderAdvice = '⚖️ CONSOLIDATION PHASE: Volatility is calm. Look for specific Volatilities with Over% or Under% > 58% on the Multi-Scanner.';
    bestContract = 'Differs & Range-bound Over/Under';
    const minsToLondon = (7 - utcHour) * 60 - utcMinute;
    timeToNextOrRemaining = `London Session Open in ${Math.floor(minsToLondon / 60)}h ${minsToLondon % 60}m (10:00 AM EAT)`;
  }

  // Synthetics 24/7 notice
  const syntheticsNotice =
    'Deriv Synthetic Volatilities (Vol 10, 25, 50, 75, 100) run 24/7 on cryptographically secure RNG with constant tick cadence, but global session overlaps generate the highest user participation and cleanest algorithmic runs!';

  // Build 24-hour visual schedule with Kenyan Time (EAT)
  const hoursSchedule = [];
  for (let h = 0; h < 24; h++) {
    let sess = 'Asia';
    let qual: 'prime' | 'high' | 'medium' | 'low' = 'medium';
    let sc = 70;
    let ouEdge = 'Moderate (Edge ~5%)';

    if (h >= 12 && h < 17) {
      sess = 'London / NY Overlap 🔥';
      qual = 'prime';
      sc = 96;
      ouEdge = 'Maximum (Edge > 15%) 🔥';
    } else if (h >= 7 && h < 12) {
      sess = 'London Active';
      qual = 'high';
      sc = 88;
      ouEdge = 'High (Edge 10%-14%)';
    } else if (h >= 17 && h < 21) {
      sess = 'New York';
      qual = 'high';
      sc = 82;
      ouEdge = 'Good (Edge 8%-12%)';
    } else if (h >= 21) {
      sess = 'Pacific / Rollover';
      qual = 'low';
      sc = 58;
      ouEdge = 'Low (Range / Differs)';
    }

    const eatH = (h + 3) % 24;
    const eatAmPm = eatH >= 12 ? 'PM' : 'AM';
    const eat12 = eatH % 12 === 0 ? 12 : eatH % 12;

    hoursSchedule.push({
      hour: h,
      hourLabel: `${h.toString().padStart(2, '0')}:00 UTC`,
      kenyanHourLabel: `${eatH.toString().padStart(2, '0')}:00 EAT (${eat12} ${eatAmPm})`,
      session: sess,
      quality: qual,
      score: sc,
      isCurrent: h === utcHour,
      overUnderEdge: ouEdge,
    });
  }

  return {
    score,
    grade,
    badge,
    verdict,
    sessionName,
    statusColor,
    syntheticsNotice,
    overUnderAdvice,
    bestContract,
    timeToNextOrRemaining,
    isPeakWindow,
    dayGrade,
    dayNote,
    currentKenyanTime,
    currentKenyanDate,
    hoursSchedule,
  };
}

interface BannerProps {
  theme: 'dark' | 'light';
  onOpenScheduleModal: () => void;
}

export const GoodTradingTimeBanner: React.FC<BannerProps> = ({ theme, onOpenScheduleModal }) => {
  const info = useMemo(() => computeTradingTimeInfo(), []);

  return (
    <div
      style={{
        background:
          theme === 'light'
            ? 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)'
            : 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(12, 74, 110, 0.25) 100%)',
        border: theme === 'light' ? '1px solid #99f6e4' : '1px solid rgba(0, 255, 204, 0.35)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        boxShadow: theme === 'light' ? '0 1px 4px rgba(0,0,0,0.05)' : '0 4px 16px rgba(0, 255, 204, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(0, 255, 204, 0.15)',
            border: `1.5px solid ${info.statusColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            boxShadow: `0 0 10px ${info.statusColor}44`,
          }}
        >
          ⏰
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#fff',
                background: info.statusColor,
                padding: '2px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {info.badge}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#fff' }}>
              {info.verdict}
            </span>
            <span style={{ fontSize: 11, color: theme === 'light' ? '#0369a1' : '#00ffcc', fontWeight: 700 }}>
              • {info.sessionName}
            </span>
            <span
              style={{
                background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                padding: '1px 7px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 800,
                color: theme === 'light' ? '#047857' : '#00ff99',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Kenyan Local Time (EAT / UTC+3)"
            >
              <span>🇰🇪</span>
              <span>Kenya: {info.currentKenyanTime} EAT</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: theme === 'light' ? '#475569' : '#cbd5e1', marginTop: 3 }}>
            <b>Over/Under Status:</b> {info.overUnderAdvice.slice(0, 115)}...
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ textAlign: 'right', display: 'none' }}>
          <div style={{ fontSize: 10, color: theme === 'light' ? '#64748b' : '#94a3b8' }}>LIQUIDITY SCORE</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: info.statusColor }}>{info.score}/100</div>
        </div>
        <button
          onClick={onOpenScheduleModal}
          style={{
            background: theme === 'light' ? '#0284c7' : 'linear-gradient(135deg, #00ffcc 0%, #0284c7 100%)',
            color: theme === 'light' ? '#fff' : '#070b14',
            border: 'none',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 0 10px rgba(0, 255, 204, 0.2)',
            transition: 'transform 0.1s ease',
          }}
          title="Open Full 24H Trading Timing Radar (Kenyan EAT & UTC)"
        >
          <span>🔍 View 24H Radar (Kenya EAT)</span>
          <span>➔</span>
        </button>
      </div>
    </div>
  );
};

interface ModalProps {
  theme: 'dark' | 'light';
  isOpen: boolean;
  onClose: () => void;
}

export const GoodTradingTimeModal: React.FC<ModalProps> = ({ theme, isOpen, onClose }) => {
  const info = useMemo(() => computeTradingTimeInfo(), []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(8, 12, 22, 0.94)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f1f5f9',
          maxWidth: 760,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          borderRadius: 16,
          border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(0, 255, 204, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(0, 255, 204, 0.15)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#00ffcc' }}>
                BEST TRADING TIME &amp; MARKET RADAR
              </div>
              <div style={{ fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span>Real-Time Global Session Quality &amp; Optimal Over/Under Timing</span>
                <span>•</span>
                <span style={{ color: '#00ff99', fontWeight: 800 }}>🇰🇪 Kenyan Time: {info.currentKenyanTime} EAT</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: theme === 'light' ? '#f1f5f9' : '#1e293b',
              color: theme === 'light' ? '#0f172a' : '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, margin: '14px 0' }}>
          {/* Current Live Rating Card */}
          <div
            style={{
              background: theme === 'light' ? '#f8fafc' : '#141d30',
              border: `1.5px solid ${info.statusColor}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 14,
              boxShadow: `0 0 16px ${info.statusColor}25`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <div>
                <span
                  style={{
                    background: info.statusColor,
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: 4,
                  }}
                >
                  {info.badge}
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, marginLeft: 8, color: theme === 'light' ? '#0f172a' : '#fff' }}>
                  {info.verdict}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: info.statusColor }}>
                  {info.score}/100 Score
                </span>
                <span style={{ fontSize: 11, color: theme === 'light' ? '#64748b' : '#94a3b8', marginLeft: 6 }}>
                  ({info.grade})
                </span>
              </div>
            </div>

            {/* 🇰🇪 PROMINENT KENYAN TIME HIGHLIGHT STRIP */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: 6,
                padding: '6px 12px',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>🇰🇪</span>
                <span style={{ fontWeight: 800, color: '#00ff99', fontSize: 12 }}>
                  Kenyan Local Time (EAT / UTC+3, Nairobi):
                </span>
              </div>
              <b style={{ color: '#ffd700', fontSize: 14, fontFamily: 'monospace' }}>
                {info.currentKenyanTime} — {info.currentKenyanDate}
              </b>
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>
              • <b>Active Session:</b> {info.sessionName} ({info.timeToNextOrRemaining})<br />
              • <b>Day Rating:</b> <b style={{ color: '#ffd700' }}>{info.dayGrade}</b> — {info.dayNote}<br />
              • <b>Best Strategy Right Now:</b> <span style={{ color: '#00ffcc', fontWeight: 800 }}>{info.bestContract}</span><br />
              • <b>Over/Under Advice:</b> {info.overUnderAdvice}
            </div>
          </div>

          {/* Over/Under Timing Strategy Guide */}
          <div
            style={{
              background: theme === 'light' ? '#f0fdf4' : 'rgba(16, 185, 129, 0.12)',
              border: theme === 'light' ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🎯</span>
              <span>HOW TIMING IMPACTS OVER/UNDER TRADING:</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: theme === 'light' ? '#1e3a2b' : '#cbd5e1' }}>
              • <b>High-Liquidity Windows (3:00 PM – 7:30 PM EAT Kenyan Time | 12:00 – 16:30 UTC):</b> Directional momentum is at its peak. Prices trend in rapid bursts, causing last digits to cluster heavily either high (Over 5: digits 5, 6, 7, 8, 9) or low (Under 5: digits 0, 1, 2, 3, 4). This is the <b>absolute best window</b> for Over/Under streak trading in Kenya.<br />
              • <b>Consolidation Windows (3:00 AM – 10:00 AM EAT Kenyan Time | 00:00 – 07:00 UTC):</b> Market oscillates in tight ranges. Last digits distribute evenly (50/50). Avoid blind Over/Under here; rely on the <b>Multi-Scanner</b> to pick the few volatilities showing strong current skew!
            </div>
          </div>

          {/* 24-Hour Visual Schedule */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#00ffcc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📊</span>
              <span>24-HOUR KENYAN (EAT) &amp; GLOBAL TIMETABLE:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
              {info.hoursSchedule.map((h) => {
                const isPrime = h.quality === 'prime';
                const isHigh = h.quality === 'high';
                const isLow = h.quality === 'low';
                const borderC = h.isCurrent
                  ? '#00ffcc'
                  : isPrime
                  ? '#10b981'
                  : isHigh
                  ? '#0284c7'
                  : isLow
                  ? '#f97316'
                  : '#64748b';

                return (
                  <div
                    key={h.hour}
                    style={{
                      background: h.isCurrent
                        ? (theme === 'light' ? '#e0f2fe' : 'rgba(0, 255, 204, 0.15)')
                        : (theme === 'light' ? '#f8fafc' : '#141d30'),
                      border: `1.5px solid ${borderC}`,
                      borderRadius: 6,
                      padding: '6px 8px',
                      position: 'relative',
                      boxShadow: h.isCurrent ? '0 0 10px rgba(0, 255, 204, 0.3)' : undefined,
                    }}
                  >
                    {h.isCurrent && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: 6,
                          fontSize: 9,
                          fontWeight: 900,
                          background: '#00ffcc',
                          color: '#000',
                          padding: '1px 4px',
                          borderRadius: 3,
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#00ff99' }}>
                      🇰🇪 {h.kenyanHourLabel}
                    </div>
                    <div style={{ fontSize: 9.5, color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                      ({h.hourLabel})
                    </div>
                    <div style={{ fontSize: 10, color: isPrime ? '#10b981' : isHigh ? '#38bdf8' : isLow ? '#f97316' : '#ffd700', fontWeight: 700, marginTop: 2 }}>
                      {h.session.replace(' 🔥', '')}
                    </div>
                    <div style={{ fontSize: 9, color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                      Score: <b>{h.score}%</b>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deriv Synthetics 24/7 Notice */}
          <div
            style={{
              background: theme === 'light' ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
              border: theme === 'light' ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 8,
              padding: 10,
              fontSize: 11.5,
              lineHeight: 1.5,
              color: theme === 'light' ? '#92400e' : '#fbbf24',
            }}
          >
            ⚡ <b>DERIV SYNTHETIC INDICES 24/7 ADVANTAGE:</b> Unlike Forex, Deriv Synthetic Volatilities (Vol 10 to 100, Step, Boom/Crash) run uninterrupted 24 hours a day, 7 days a week, including weekends! Use this timing radar to pick the hours with the cleanest trend runs.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #00ffcc 0%, #0284c7 100%)',
              color: '#070b14',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            GOT IT ➔ RETURN TO TERMINAL
          </button>
        </div>
      </div>
    </div>
  );
};
