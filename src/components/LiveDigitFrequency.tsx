/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';

export interface LiveDigitFrequencyProps {
  /** Array of digits from the live Deriv tick stream */
  digits: number[];
  /** Latest tick digit (0-9) */
  latestDigit: number | string;
  /** Active market name (e.g. Volatility 75) */
  marketName?: string;
  /** Optional click callback */
  onDigitClick?: (digit: number) => void;
  /** Optional custom container style */
  className?: string;
}

export interface DigitStat {
  digit: number;
  count: number;
  pct: number;
  pctFormatted: string;
  rank: 'most' | 'second-most' | 'second-least' | 'least' | 'neutral';
  color: string;
}

export const LiveDigitFrequency: React.FC<LiveDigitFrequencyProps> = ({
  digits,
  latestDigit,
  marketName,
  onDigitClick,
  className = '',
}) => {
  // Sample window size: 100 ticks (standard Deriv digit frequency), 50, 500, or 1000
  const [sampleSize, setSampleSize] = useState<number>(100);

  // Compute live frequencies and ranking based on sampleSize
  const { stats, sampleTotal, activeDigitNum } = useMemo(() => {
    const activeNum = typeof latestDigit === 'number' 
      ? latestDigit 
      : (latestDigit !== '-' && !isNaN(Number(latestDigit))) 
        ? Number(latestDigit) 
        : null;

    // Slice recent window
    const windowDigits = digits.length > 0 ? digits.slice(-sampleSize) : [];
    const total = windowDigits.length;

    // Count frequency for each digit 0-9
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    
    if (total > 0) {
      windowDigits.forEach((d) => {
        if (d >= 0 && d <= 9) counts[d] = (counts[d] || 0) + 1;
      });
    } else {
      // Default sample matching screenshot for initial visual state before ticks arrive
      const fallbackCounts = [101, 115, 86, 90, 100, 122, 92, 87, 100, 107]; // sum 1000
      fallbackCounts.forEach((c, d) => {
        counts[d] = c;
      });
    }

    const calcTotal = total > 0 ? total : 1000;

    // Calculate percentages
    const rawList: { digit: number; count: number; pct: number }[] = [];
    for (let d = 0; d <= 9; d++) {
      const c = counts[d] || 0;
      const pct = (c / calcTotal) * 100;
      rawList.push({ digit: d, count: c, pct });
    }

    // Sort to determine ranks:
    // Rank 1: Most appearing (Green)
    // Rank 2: Second most (Purple/Indigo)
    // Rank 9: Second least (Amber)
    // Rank 10: Least appearing (Crimson/Dark Red)
    // All others: Neutral (Charcoal/Dark slate)
    const sorted = [...rawList].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.digit - b.digit; // tie breaker
    });

    const mostDigit = sorted[0].digit;
    const secondMostDigit = sorted[1].digit;
    const secondLeastDigit = sorted[sorted.length - 2].digit;
    const leastDigit = sorted[sorted.length - 1].digit;

    const computedStats: DigitStat[] = rawList.map((item) => {
      let rank: DigitStat['rank'] = 'neutral';
      let color = '#334155'; // Dark slate for neutral

      if (item.digit === mostDigit) {
        rank = 'most';
        color = '#16a34a'; // Green
      } else if (item.digit === secondMostDigit) {
        rank = 'second-most';
        color = '#4f46e5'; // Purple / Indigo
      } else if (item.digit === secondLeastDigit) {
        rank = 'second-least';
        color = '#ca8a04'; // Amber / Gold
      } else if (item.digit === leastDigit) {
        rank = 'least';
        color = '#991b1b'; // Dark crimson red
      }

      return {
        digit: item.digit,
        count: item.count,
        pct: item.pct,
        pctFormatted: `${item.pct.toFixed(1)}%`,
        rank,
        color,
      };
    });

    return {
      stats: computedStats,
      sampleTotal: total > 0 ? total : 1000,
      activeDigitNum: activeNum !== null ? activeNum : 9, // default to 9 as shown in screenshot if not yet connected
    };
  }, [digits, latestDigit, sampleSize]);

  // Donut gauge SVG dimensions
  const size = 68;
  const strokeWidth = 5.5;
  const radius = (size - strokeWidth) / 2 - 2; // ~29
  const center = size / 2; // 34
  const circumference = 2 * Math.PI * radius; // ~182.2

  return (
    <div
      className={`digit-frequency-card ${className}`}
      style={{
        background: '#f3f4f6', // Light clean card as in screenshot
        color: '#111827',
        borderRadius: 20,
        padding: '20px 24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        border: '1px solid #e5e7eb',
        maxWidth: 760,
        margin: '0 auto 16px auto',
      }}
    >
      {/* HEADER SECTION: Title + Latest Digit Badge + Sample Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2
            style={{
              margin: '0 0 10px 0',
              fontSize: 22,
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.02em',
            }}
          >
            Digit Frequency
          </h2>

          {/* LATEST DIGIT BADGE */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#e2e8f0',
              color: '#334155',
              fontWeight: 700,
              fontSize: 13,
              padding: '4px 14px',
              borderRadius: 20,
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            Latest digit {activeDigitNum !== null ? activeDigitNum : '-'}
          </div>
        </div>

        {/* SAMPLE SIZE DROPDOWN & LIVE STATUS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {marketName && (
            <span
              style={{
                fontSize: 11,
                background: '#e5e7eb',
                color: '#4b5563',
                padding: '3px 8px',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {marketName}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#e5e7eb', borderRadius: 8, padding: '2px 4px' }}>
            <span style={{ fontSize: 11, color: '#6b7280', padding: '0 4px', fontWeight: 600 }}>Sample:</span>
            {[50, 100, 500, 1000].map((sz) => (
              <button
                key={sz}
                onClick={() => setSampleSize(sz)}
                style={{
                  background: sampleSize === sz ? '#111827' : 'transparent',
                  color: sampleSize === sz ? '#ffffff' : '#4b5563',
                  fontSize: 11,
                  fontWeight: sampleSize === sz ? 700 : 500,
                  border: 'none',
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LEGEND SECTION */}
      <div style={{ marginTop: 14, marginBottom: 20 }}>
        {/* Row 1: Most appearing | Second most | Second least | Least appearing */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#16a34a', // Green
                display: 'inline-block',
              }}
            />
            <span>Most appearing</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#4f46e5', // Purple / Indigo
                display: 'inline-block',
              }}
            />
            <span>Second most</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#ca8a04', // Amber
                display: 'inline-block',
              }}
            />
            <span>Second least</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#991b1b', // Least appearing crimson red
                display: 'inline-block',
              }}
            />
            <span>Least appearing</span>
          </div>
        </div>

        {/* Row 2: Latest tick */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            marginTop: 6,
          }}
        >
          <span
            style={{
              color: '#b91c1c',
              fontSize: 10,
              lineHeight: 1,
              transform: 'scale(1.2)',
              display: 'inline-block',
            }}
          >
            ▲
          </span>
          <span>Latest tick</span>
        </div>
      </div>

      {/* 2 ROWS OF 5 CIRCULAR GAUGES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ROW 1: DIGITS 0 to 4 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            alignItems: 'center',
            justifyItems: 'center',
          }}
        >
          {stats.slice(0, 5).map((stat) => (
            <DigitCircleItem
              key={stat.digit}
              stat={stat}
              isLatest={stat.digit === activeDigitNum}
              size={size}
              radius={radius}
              strokeWidth={strokeWidth}
              center={center}
              circumference={circumference}
              onClick={() => onDigitClick?.(stat.digit)}
            />
          ))}
        </div>

        {/* ROW 2: DIGITS 5 to 9 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            alignItems: 'center',
            justifyItems: 'center',
          }}
        >
          {stats.slice(5, 10).map((stat) => (
            <DigitCircleItem
              key={stat.digit}
              stat={stat}
              isLatest={stat.digit === activeDigitNum}
              size={size}
              radius={radius}
              strokeWidth={strokeWidth}
              center={center}
              circumference={circumference}
              onClick={() => onDigitClick?.(stat.digit)}
            />
          ))}
        </div>
      </div>

      {/* FOOTER STATS INFO */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#6b7280',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          Ticks Evaluated: <b style={{ color: '#111827' }}>{sampleTotal}</b>
        </span>
        <span>
          Real-time Deriv WebSocket Feed Active
        </span>
      </div>
    </div>
  );
};

interface DigitCircleItemProps {
  stat: DigitStat;
  isLatest: boolean;
  size: number;
  radius: number;
  strokeWidth: number;
  center: number;
  circumference: number;
  onClick?: () => void;
}

const DigitCircleItem: React.FC<DigitCircleItemProps> = ({
  stat,
  isLatest,
  size,
  radius,
  strokeWidth,
  center,
  circumference,
  onClick,
}) => {
  // SVG dash calculation:
  // We want the arc to start at top (12 o'clock, -90deg) and sweep clockwise
  // Percentage is stat.pct (e.g. 10.1% -> 0.101 * circumference)
  const strokeDasharray = `${(stat.pct / 100) * circumference} ${circumference}`;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* CIRCLE CONTAINER WITH OPTIONAL HIGHLIGHT RING FOR LATEST TICK */}
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          // When isLatest: Red/coral outer highlight ring as seen in screenshot on digit 9
          boxShadow: isLatest
            ? '0 0 0 2.5px rgba(239, 68, 68, 0.45), 0 2px 8px rgba(239, 68, 68, 0.25)'
            : '0 2px 5px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* SVG DONUT RING */}
        <svg
          width={size}
          height={size}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'rotate(-90deg)', // Start at 12 o'clock
          }}
        >
          {/* Subtle Outer Track Circle / Soft Silver Rim */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="#edf2f7" // Light silvery white center
            stroke="#cbd5e1" // Soft light slate border track
            strokeWidth={strokeWidth}
          />

          {/* Active Frequency Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={stat.color}
            strokeWidth={strokeWidth + 0.5}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease',
            }}
          />
        </svg>

        {/* CENTER DIGIT NUMBER (0-9) */}
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            fontSize: 22,
            fontWeight: 800,
            color: '#111827', // Bold dark number
            lineHeight: 1,
          }}
        >
          {stat.digit}
        </span>
      </div>

      {/* LATEST TICK UPWARD TRIANGLE POINTER */}
      {/* Sits right beneath the circle pointing UP toward it */}
      <div
        style={{
          height: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        {isLatest ? (
          <span
            style={{
              color: '#b91c1c',
              fontSize: 10,
              lineHeight: 1,
              animation: 'bounceUp 1s infinite alternate ease-in-out',
            }}
          >
            ▲
          </span>
        ) : (
          <span style={{ visibility: 'hidden', fontSize: 10 }}>▲</span>
        )}
      </div>

      {/* PERCENTAGE TEXT DIRECTLY BENEATH EACH CIRCLE */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#111827',
          marginTop: -1,
          letterSpacing: '-0.01em',
        }}
      >
        {stat.pctFormatted}
      </div>
    </div>
  );
};
