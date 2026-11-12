import React, { useState, useEffect } from 'react';

export interface SecurityAuthState {
  isAuthenticated: boolean;
  email: string;
  username: string;
  attemptsLeft: number;
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  authenticatedAt?: string;
}

const STORAGE_KEY = 'c8_security_auth_v2';
const MASTER_KEY_HASH = '42223088'; // Exact requested password
const BYPASS_KEY_CODE = '46281228'; // Secret lockout bypass code requested by user

interface SecurityLoginGateProps {
  onAuthenticated: (email: string, username: string) => void;
  theme: 'dark' | 'light';
  kenyanTime?: string;
  kenyanDate?: string;
}

const AI_SECURITY_QUESTIONS = [
  {
    question: "Tracy AI Question 1: What is our mandatory capital protection risk rule per trade?",
    options: [
      "Strict 1% to 2% max risk per trade (The Golden Rule)",
      "50% Martingale on every consecutive loss",
      "All-in on 100% of balance every trade"
    ],
    correctIndex: 0,
    explanation: "Correct! Capital protection comes first with strict 1-2% risk."
  },
  {
    question: "Tracy AI Question 2: What is the official designated operational time zone of our analysis terminal?",
    options: [
      "New York Eastern Standard Time (EST)",
      "Kenyan Time (EAT - East Africa Time, Nairobi)",
      "Tokyo Standard Time (JST)"
    ],
    correctIndex: 1,
    explanation: "Correct! Synchronized with East Africa Time (EAT) in Nairobi."
  },
  {
    question: "Tracy AI Question 3: Which high-speed Deriv synthetic asset features 1-second tick intervals?",
    options: [
      "Volatility 15 (1s) Index",
      "Apple Inc (AAPL)",
      "Euro FX CME Futures"
    ],
    correctIndex: 0,
    explanation: "Correct! Volatility 15 (1s) offers ultra-fast 1-second institutional tick feeds."
  }
];

export function getStoredAuthState(): SecurityAuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isAuthenticated: !!parsed.isAuthenticated,
        email: parsed.email || '',
        username: parsed.username || '',
        attemptsLeft: typeof parsed.attemptsLeft === 'number' ? parsed.attemptsLeft : 3,
        isBlocked: !!parsed.isBlocked || (typeof parsed.attemptsLeft === 'number' && parsed.attemptsLeft <= 0),
        blockedAt: parsed.blockedAt,
        blockedReason: parsed.blockedReason,
        authenticatedAt: parsed.authenticatedAt,
      };
    }
  } catch (err) {
    console.error('Failed to read security auth state:', err);
  }
  return {
    isAuthenticated: false,
    email: '',
    username: '',
    attemptsLeft: 3,
    isBlocked: false,
  };
}

export function saveStoredAuthState(state: SecurityAuthState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save security auth state:', err);
  }
}

export function lockTerminalState(): SecurityAuthState {
  const current = getStoredAuthState();
  const updated: SecurityAuthState = {
    ...current,
    isAuthenticated: false,
  };
  saveStoredAuthState(updated);
  return updated;
}

export const SecurityLoginGate: React.FC<SecurityLoginGateProps> = ({
  onAuthenticated,
  theme,
  kenyanTime,
  kenyanDate,
}) => {
  const [authState, setAuthState] = useState<SecurityAuthState>(() => getStoredAuthState());
  const [email, setEmail] = useState<string>(() => authState.email || '');
  const [username, setUsername] = useState<string>(() => authState.username || '');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  // Recovery & Bypass States
  const [bypassMode, setBypassMode] = useState<'code' | 'quiz'>('code');
  const [bypassInput, setBypassInput] = useState<string>('');
  const [bypassError, setBypassError] = useState<string>('');
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizError, setQuizError] = useState<string>('');
  const [quizSuccessMsg, setQuizSuccessMsg] = useState<string>('');

  // Sync derived username whenever email changes if username is empty or previously auto-derived
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (newEmail.includes('@')) {
      const derived = newEmail.split('@')[0].trim();
      if (!username || username === authState.username) {
        setUsername(derived);
      }
    }
  };

  const handleUnlockSuccess = (customEmail?: string, customUser?: string) => {
    const trimmedEmail = (customEmail || email || authState.email || 'kelichege11@gmail.com').trim();
    const finalUsername = (customUser || username || authState.username || 'Master Trader').trim();

    setIsSuccess(true);
    const updatedState: SecurityAuthState = {
      isAuthenticated: true,
      email: trimmedEmail,
      username: finalUsername,
      attemptsLeft: 3,
      isBlocked: false,
      authenticatedAt: new Date().toISOString(),
    };
    saveStoredAuthState(updatedState);
    setAuthState(updatedState);

    setTimeout(() => {
      onAuthenticated(trimmedEmail, finalUsername);
    }, 900);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authState.isBlocked) return;

    const trimmedEmail = email.trim();
    const finalUsername = (username.trim() || trimmedEmail.split('@')[0] || 'Master Trader').trim();

    if (!trimmedEmail) {
      setErrorMsg('Please enter your original email address.');
      triggerShake();
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your security password key 🔑');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Strict Password Verification against master password 42223088 or bypass code 46281228
    if (password === MASTER_KEY_HASH || password === BYPASS_KEY_CODE) {
      handleUnlockSuccess(trimmedEmail, finalUsername);
    } else {
      // FAILED ATTEMPT
      const remaining = Math.max(0, authState.attemptsLeft - 1);
      const isNowBlocked = remaining <= 0;
      const nowKenya = kenyanTime ? `${kenyanTime} EAT (${kenyanDate || ''})` : new Date().toLocaleString();

      const updatedState: SecurityAuthState = {
        ...authState,
        email: trimmedEmail,
        username: finalUsername,
        attemptsLeft: remaining,
        isBlocked: isNowBlocked,
        blockedAt: isNowBlocked ? nowKenya : authState.blockedAt,
        blockedReason: isNowBlocked ? 'Exceeded maximum 3 failed password attempts' : undefined,
      };

      saveStoredAuthState(updatedState);
      setAuthState(updatedState);
      setPassword('');
      setIsSubmitting(false);
      triggerShake();

      if (isNowBlocked) {
        setErrorMsg('ACCESS PERMANENTLY BLOCKED: 3 failed password attempts reached.');
      } else {
        setErrorMsg(
          `❌ Incorrect security key. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before permanent lockout.`
        );
      }
    }
  };

  // Secret Bypass Code Submit Handler
  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bypassInput.trim() === BYPASS_KEY_CODE) {
      setBypassError('');
      handleUnlockSuccess();
    } else {
      setBypassError('❌ Incorrect secret bypass code. Check your 8-digit emergency key.');
      triggerShake();
    }
  };

  // AI Security Questions Answer Handler
  const handleAnswerQuestion = (optionIndex: number) => {
    const q = AI_SECURITY_QUESTIONS[quizStep];
    if (optionIndex === q.correctIndex) {
      setQuizError('');
      setQuizSuccessMsg(q.explanation);

      if (quizStep + 1 < AI_SECURITY_QUESTIONS.length) {
        setTimeout(() => {
          setQuizStep((prev) => prev + 1);
          setQuizSuccessMsg('');
        }, 700);
      } else {
        // All questions completed successfully!
        setTimeout(() => {
          handleUnlockSuccess();
        }, 800);
      }
    } else {
      setQuizError('❌ Incorrect selection. Think carefully about our core trading rules and try again.');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // If permanently blocked, render high-security blocked vault screen WITH BYPASS OPTIONS
  if (authState.isBlocked) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'radial-gradient(circle at center, #1e0909 0%, #0a0101 60%, #000000 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          color: '#f87171',
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          overflowY: 'auto',
        }}
      >
        <div
          className={shake ? 'shake-animation' : ''}
          style={{
            maxWidth: 540,
            width: '100%',
            background: 'rgba(20, 5, 5, 0.95)',
            border: isSuccess ? '2px solid #10b981' : '2px solid #ef4444',
            borderRadius: 16,
            padding: 28,
            boxShadow: isSuccess
              ? '0 0 50px rgba(16, 185, 129, 0.5)'
              : '0 0 50px rgba(239, 68, 68, 0.4), inset 0 0 20px rgba(239, 68, 68, 0.2)',
            textAlign: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          {isSuccess ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 60, marginBottom: 16, animation: 'pulse 1s infinite' }}>
                ✅
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#34d399', margin: '0 0 10px' }}>
                COMPLETE ✅ TERMINAL UNLOCKED!
              </h2>
              <p style={{ fontSize: 14, color: '#a7f3d0', lineHeight: 1.6 }}>
                Security bypass accepted. Lockout cleared and master credentials verified. Launching trading desk...
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid #ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 34,
                  margin: '0 auto 16px',
                  animation: 'pulse 1.8s infinite',
                }}
              >
                🚫
              </div>

              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: 900,
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.2)',
                  padding: '4px 12px',
                  borderRadius: 20,
                  display: 'inline-block',
                  marginBottom: 10,
                }}
              >
                SECURITY LOCKOUT ENGAGED
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fee2e2', margin: '0 0 8px' }}>
                TERMINAL ACCESS RESTRICTED
              </h2>

              <p style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5, marginBottom: 18 }}>
                3 failed attempts reached. To restore access, enter your <b>secret bypass code</b> or answer <b>AI clearance questions</b>.
              </p>

              {/* TABS: SECRET CODE OR AI QUESTIONS */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 18,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setBypassMode('code')}
                  style={{
                    flex: 1,
                    background: bypassMode === 'code' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                    color: bypassMode === 'code' ? '#fff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>🔑</span>
                  <span>Secret Bypass Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBypassMode('quiz')}
                  style={{
                    flex: 1,
                    background: bypassMode === 'quiz' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                    color: bypassMode === 'quiz' ? '#fff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>🤖</span>
                  <span>AI Security Questions</span>
                </button>
              </div>

              {/* OPTION 1: SECRET CODE BYPASS */}
              {bypassMode === 'code' && (
                <form onSubmit={handleBypassSubmit} style={{ textAlign: 'left', marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>
                    Enter Secret Recovery Code 🔑:
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      value={bypassInput}
                      onChange={(e) => setBypassInput(e.target.value)}
                      placeholder="Enter emergency code"
                      style={{
                        flex: 1,
                        background: '#090d16',
                        border: '1px solid #ef4444',
                        borderRadius: 8,
                        padding: '10px 14px',
                        color: '#f8fafc',
                        fontSize: 14,
                        letterSpacing: 2,
                        outline: 'none',
                      }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontWeight: 900,
                        fontSize: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      Bypass &amp; Unlock ✅
                    </button>
                  </div>
                  {bypassError && (
                    <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: 700 }}>
                      {bypassError}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    💡 Tip: Emergency master key restores instant access and resets lockout attempts.
                  </div>
                </form>
              )}

              {/* OPTION 2: AI CLEARANCE QUESTIONS */}
              {bypassMode === 'quiz' && (
                <div style={{ textAlign: 'left', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>
                      Tracy AI Clearance Protocol
                    </span>
                    <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>
                      Question {quizStep + 1} of {AI_SECURITY_QUESTIONS.length}
                    </span>
                  </div>

                  {/* Question Card */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: '1px solid #10b981',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
                      {AI_SECURITY_QUESTIONS[quizStep].question}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {AI_SECURITY_QUESTIONS[quizStep].options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAnswerQuestion(idx)}
                          style={{
                            background: '#0e1628',
                            border: '1px solid #1e293b',
                            color: '#cbd5e1',
                            padding: '10px 12px',
                            borderRadius: 8,
                            textAlign: 'left',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#10b981';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#1e293b';
                            e.currentTarget.style.color = '#cbd5e1';
                          }}
                        >
                          <b style={{ color: '#10b981', marginRight: 6 }}>{String.fromCharCode(65 + idx)}.</b> {opt}
                        </button>
                      ))}
                    </div>

                    {quizError && (
                      <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, fontWeight: 700 }}>
                        {quizError}
                      </div>
                    )}
                    {quizSuccessMsg && (
                      <div style={{ color: '#10b981', fontSize: 12, marginTop: 8, fontWeight: 700 }}>
                        {quizSuccessMsg}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Info Box */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  color: '#94a3b8',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Security Status:</span>
                  <span style={{ color: '#ef4444', fontWeight: 800 }}>Locked (Bypass Ready)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Operational Clock:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 700 }}>{kenyanTime || 'EAT (Nairobi)'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Active Login Screen
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'radial-gradient(circle at 50% 30%, #0d1527 0%, #050811 70%, #020408 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        className={shake ? 'shake-animation' : ''}
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #1e293b',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: isSuccess
            ? '0 0 60px rgba(16, 185, 129, 0.4)'
            : '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.15)',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Top subtle glow line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: isSuccess
              ? 'linear-gradient(90deg, #10b981, #06b6d4, #10b981)'
              : 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)',
          }}
        />

        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
            }}
          >
            {isSuccess ? '✅' : '🔐'}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#38bdf8',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Master Security Authentication
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: '0 0 6px' }}>
            Deriv & MT5 Quantitative Terminal
          </h2>

          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            Enter your original email and master access key to unlock the analysis suite and Tracy AI.
          </p>
        </div>

        {/* Attempts Remaining Meter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: authState.attemptsLeft === 1 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.7)',
            border: `1px solid ${authState.attemptsLeft === 1 ? '#ef4444' : '#334155'}`,
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{authState.attemptsLeft === 1 ? '🚨' : '🛡️'}</span>
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Security Quota:</span>
          </div>
          <div style={{ fontWeight: 800 }}>
            {authState.attemptsLeft === 3 && <span style={{ color: '#10b981' }}>3 of 3 Attempts Available</span>}
            {authState.attemptsLeft === 2 && <span style={{ color: '#f59e0b' }}>⚠️ 2 Attempts Remaining</span>}
            {authState.attemptsLeft === 1 && (
              <span style={{ color: '#ef4444', animation: 'pulse 1.2s infinite' }}>
                🚨 FINAL ATTEMPT REMAINING!
              </span>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 18,
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              lineHeight: 1.4,
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Notification */}
        {isSuccess && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 18,
              color: '#34d399',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span>✨</span>
            <span>Identity Verified! Launching Analysis Terminal...</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#cbd5e1',
                marginBottom: 6,
              }}
            >
              Original Email Address:
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="e.g. yourname@domain.com"
              required
              disabled={isSuccess}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '11px 14px',
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
              onBlur={(e) => (e.target.style.borderColor = '#334155')}
            />
          </div>

          {/* Username (Auto-derived from email) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>Authorized Username:</label>
              <span style={{ fontSize: 11, color: '#38bdf8' }}>Linked to Email</span>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Auto-generated username"
              disabled={isSuccess}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: 10,
                padding: '11px 14px',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Master Password Input (type="password" with toggle, strict zero-leakage) */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                Master Access Key 🔑:
              </label>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Protected (Zero Leakage)</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter 8-digit security key"
                required
                disabled={isSuccess}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '11px 44px 11px 14px',
                  color: '#f8fafc',
                  fontSize: 14,
                  letterSpacing: showPassword ? 'normal' : 3,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#ec4899')}
                onBlur={(e) => (e.target.style.borderColor = '#334155')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            style={{
              width: '100%',
              background: isSuccess
                ? '#10b981'
                : 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #ec4899 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              padding: '13px 20px',
              fontWeight: 800,
              fontSize: 14,
              cursor: isSubmitting || isSuccess ? 'default' : 'pointer',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSuccess ? (
              <>
                <span>🔓</span>
                <span>Access Granted</span>
              </>
            ) : isSubmitting ? (
              <span>Verifying Security Key...</span>
            ) : (
              <>
                <span>🔐</span>
                <span>Unlock Terminal & Analysis</span>
              </>
            )}
          </button>
        </form>

        {/* Kenyan Time & Session Footer */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#64748b',
          }}
        >
          <div>
            📍 <b>Kenyan Time (EAT):</b> {kenyanTime || 'Active'}
          </div>
          <div>
            🔒 <b>3 Attempts Only</b>
          </div>
        </div>
      </div>
    </div>
  );
};
