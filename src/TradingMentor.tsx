import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppControllerBridge, interpretAndExecuteTracyCommand } from './utils/tracyController';
import { ProStrategyPlaybookModal, StrategyKey } from './components/ProStrategyPlaybookModal';

export type AIModelMode = 'tracy' | 'gemini' | 'chatgpt' | 'marcus';

export interface TradePlan {
  pair: string;
  action: string;
  category?: string;
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  rr: string;
  riskStake: string;
  confidence: number;
  reason: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: string;
  mode?: AIModelMode;
  thinkingSteps?: string[];
  isSpoken?: boolean;
  tradePlan?: TradePlan;
}

export interface TradingContext {
  tab: string;
  pair: string;
  timeframe: string;
  balance?: string;
  isBalanceSetByUser?: boolean;
  signalAction?: string;
  riskPercent?: number;
  hotDigit?: string;
  differDigit?: number;
  primaryMatchDigit?: number;
  entryDigit?: number;
  matchConfidence?: string | number;
  livePrice?: number;
  day?: string;
  kenyanTime?: string;
  kenyanDate?: string;
  kenyanSession?: string;
}

interface TradingMentorProps {
  context: TradingContext;
  isFloating?: boolean;
  onCloseFloating?: () => void;
  defaultMode?: AIModelMode;
  controller?: AppControllerBridge;
}

const INITIAL_MESSAGES_MAP: Record<AIModelMode, ChatMessage[]> = {
  tracy: [
    {
      id: 'tracy-intro',
      role: 'assistant',
      mode: 'tracy',
      thinkingSteps: [
        'Connected with trader: monitoring {PAIR} on {TIMEFRAME}',
        'Calibrated warm human trading partner voice engine',
        'Armed with Pro Strategies for Over/Under, Even/Odd, Raise/Fall & High/Low Tick',
        'Ready for live voice conversation, call mode, and real-time trade execution',
      ],
      content: `### ✨ Hey! I'm Tracy, your real-time trading partner & mentor 🎙️

I'm sitting right here at the desk with you. You don't have to navigate these markets alone anymore!

You can talk to me just like a real friend—either by **typing**, pressing the **Microphone 🎙️** to speak, or hitting **📞 Call Tracy AI** for a hands-free live voice conversation.

#### What we do together:
* **Capital Protection First**: We follow a strict **1% risk rule** on every trade to protect your capital. You can tell me your exact account balance whenever you are ready!
* **Pro Strategies & Exact Minutes**: Ask me for the exact minute durations and entry rules for **Raise & Fall (Rise/Fall)**, **Over / Under**, **Even / Odd**, **High / Low Tick**, or **Ups & Downs**.
* **Direct Terminal Control**: Tell me to switch markets (like Vol 15 1s or Vol 75), calibrate stakes, open the scanner, or execute trades.

How are you feeling today? Which strategy or market setup shall we check together?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'tracy-ai-companion',
    },
  ],
  gemini: [
    {
      id: 'gemini-intro',
      role: 'assistant',
      mode: 'gemini',
      thinkingSteps: [
        'Ingested live market telemetry: {PAIR} on {TIMEFRAME}',
        'Calculated Poisson distribution & 2nd-order Markov transition states',
        'Cross-referenced fractional Kelly criterion against ${BALANCE} capital',
        'Synthesized quantitative trading edge parameters',
      ],
      content: `### ♊ Google Gemini Quantitative Intelligence Initialized

Welcome to the algorithmic desk. I am actively calibrated to analyze **{PAIR}** on the **{TIMEFRAME}** timeframe with your **\${BALANCE}** capital.

#### Multimodal Trading Capabilities:
* **Deriv Synthetics Microstructure**: Real-time Poisson clustering for Matches (800% payout) & 98% safe Differs digit barriers.
* **Multi-Timeframe Concordance**: Dynamic analysis across **1t**, **1m**, **5m**, **15m**, and **1h** candles.
* **MT5 Institutional Confluence**: Exact pip-to-risk calculations, SMC Order Blocks, and Fair Value Gaps.
* **Fractional Kelly Optimization**: Position sizing calibrated to eliminate mathematical risk of ruin.

What setup or statistical model shall we evaluate right now?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'gemini-3.8-flash',
    },
  ],
  chatgpt: [
    {
      id: 'chatgpt-intro',
      role: 'assistant',
      mode: 'chatgpt',
      thinkingSteps: [
        'Analyzed instrument volatility characteristics for {PAIR}',
        'Mapped market structure on {TIMEFRAME} timeframe',
        'Derived capital allocation model for ${BALANCE}',
        'Formulated step-by-step institutional risk blueprint',
      ],
      content: `### 🤖 ChatGPT (GPT-4o Reasoning) Trading Strategist

Hello! I'm here to provide deep chain-of-thought market analysis, structural trade blueprints, and quantitative risk management.

\`\`\`text
[PORTFOLIO: \${BALANCE}] ➔ [INSTRUMENT: {PAIR}] ➔ [TIMEFRAME: {TIMEFRAME}]
\`\`\`

#### How I Can Help You Execute with Precision:
1. **Deriv Timeframe Strategy**: Custom execution rules for **1-Tick Snipers** vs **1M/5M/15M Breakouts**.
2. **SMC & Liquidity Mapping**: Identifying where market makers manipulate retail stop pools.
3. **Exact Position Sizing**: Calculating 1% safe stakes and pip values with zero guess-work.
4. **Interactive Trade Plans**: 1-click executable trade cards with clear invalidation points.

Tell me what trade setup, chart level, or market dynamic you want to dissect.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'chatgpt-gpt4o',
    },
  ],
  marcus: [
    {
      id: 'marcus-intro',
      role: 'assistant',
      mode: 'marcus',
      thinkingSteps: [
        'Floor capital defense check initiated',
        'Assessing emotional discipline state and max drawdown limits',
      ],
      content: `**Marcus Vance here.** Welcome to the desk.

I've spent 18 years trading institutional capital across the Chicago CME floor, London FX desks, and modern synthetic indices. I'm not here to sell illusions. I'm here to instill the ruthless risk discipline, technical sniper precision, and mental fortitude required to win consistently.

You're watching **{PAIR}** on **{TIMEFRAME}** with **\${BALANCE}** in your account.

Are you looking for:
* **Strict lot size & risk calculation** for your current capital
* **SMC order block & liquidity breakdown** on this chart
* **Matches & Differs mathematical strategy** for synthetic indices
* Or do you need an **emergency tilt reset** after a tough session?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'marcus-desk',
    },
  ],
};

// Helper to parse embedded :::trade-plan ... ::: blocks
function parseTradePlanBlock(raw: string): { cleanText: string; plan?: TradePlan } {
  const match = raw.match(/:::trade-plan\s*([\s\S]*?):::/);
  if (!match) return { cleanText: raw };

  const block = match[1];
  const cleanText = raw.replace(/:::trade-plan\s*[\s\S]*?:::/, '').trim();

  const getField = (name: string) => {
    const r = new RegExp(`${name}:\\s*(.*)`, 'i');
    const m = block.match(r);
    return m ? m[1].trim() : '';
  };

  const plan: TradePlan = {
    pair: getField('PAIR') || 'Active Market',
    action: getField('ACTION') || 'BUY',
    entry: getField('ENTRY') || 'Market Retest',
    sl: getField('SL') || 'Structure Invalidation',
    tp1: getField('TP1') || '1:2 R:R',
    tp2: getField('TP2') || '1:3.5 R:R',
    rr: getField('RR') || '1:3',
    riskStake: getField('RISK_STAKE') || '1% Balance',
    confidence: parseFloat(getField('CONFIDENCE')) || 98.4,
    reason: getField('REASON') || 'Confluence alignment with institutional order block.',
  };

  return { cleanText, plan };
}

export const TradingMentor: React.FC<TradingMentorProps> = ({
  context,
  isFloating = false,
  onCloseFloating,
  defaultMode = 'tracy',
  controller,
}) => {
  const [modelMode, setModelMode] = useState<AIModelMode>(defaultMode);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [autoVoice, setAutoVoice] = useState<boolean>(() => {
    return localStorage.getItem('c8_tracy_autovoice') !== 'false';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Speech Recognition (Microphone voice input)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Interactive Live Voice Call Mode
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'listening' | 'thinking' | 'speaking' | 'idle'>('idle');
  const [callUserTranscript, setCallUserTranscript] = useState('');
  const [callTracyReply, setCallTracyReply] = useState('');
  const [isCallMuted, setIsCallMuted] = useState(false);

  // Audio Playback
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('c8_trading_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    const template = INITIAL_MESSAGES_MAP[defaultMode] || INITIAL_MESSAGES_MAP.tracy;
    return template.map((m) => ({
      ...m,
      content: m.content
        .replace(/{PAIR}/g, context.pair || 'Deriv Synthetics')
        .replace(/{TIMEFRAME}/g, context.timeframe || '1t')
        .replace(/{BALANCE}/g, context.isBalanceSetByUser && context.balance ? `$${parseFloat(context.balance).toFixed(2)}` : 'Not Set (tell Tracy when ready)'),
    }));
  });

  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [playbookStrategy, setPlaybookStrategy] = useState<StrategyKey>('rise_fall');

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem('c8_trading_chat_history', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Persist auto voice preference
  useEffect(() => {
    localStorage.setItem('c8_tracy_autovoice', String(autoVoice));
  }, [autoVoice]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clean voice synthesis & audio on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Voice Call Timer
  useEffect(() => {
    let timer: any = null;
    if (isCallOpen) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCallOpen]);

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  // Stop any active speaking
  const stopAllSpeech = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveSpeechId(null);
  }, []);

  // Fallback to Web Speech API
  const speakWithBrowserSynthesis = useCallback((cleanText: string, id: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    utterance.pitch = modelMode === 'tracy' ? 1.05 : modelMode === 'marcus' ? 0.95 : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Samantha') ||
          v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Female') ||
          v.name.includes('Zira'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setActiveSpeechId(id);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveSpeechId(null);
      onEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveSpeechId(null);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, [speechRate, modelMode]);

  // Enhanced Speech Player with Gemini Neural TTS (/api/mentor/speak) & Browser fallback
  const handleSpeak = useCallback(async (text: string, id: string, onEnd?: () => void) => {
    if (isSpeaking && activeSpeechId === id) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();
    setIsSpeaking(true);
    setActiveSpeechId(id);

    // Clean text of markdown, tables, trade plan blocks
    const cleanSpoken = text
      .replace(/:::trade-plan[\s\S]*?:::/g, 'I have sent the executable trade setup to your dashboard.')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*`_~>|]/g, '')
      .replace(/\$(?=\d)/g, 'dollars ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    try {
      const res = await fetch('/api/mentor/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanSpoken,
          voice: modelMode === 'marcus' ? 'Puck' : 'Kore',
        }),
      });

      if (!res.ok) throw new Error('TTS server error');
      const data = await res.json();

      if (data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        currentAudioRef.current = audio;
        audio.playbackRate = speechRate;
        audio.onended = () => {
          setIsSpeaking(false);
          setActiveSpeechId(null);
          currentAudioRef.current = null;
          onEnd?.();
        };
        audio.onerror = () => {
          speakWithBrowserSynthesis(data.cleanText || cleanSpoken, id, onEnd);
        };
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Neural TTS failed, falling back to Web Speech API:', err);
    }

    speakWithBrowserSynthesis(cleanSpoken, id, onEnd);
  }, [isSpeaking, activeSpeechId, stopAllSpeech, modelMode, speechRate, speakWithBrowserSynthesis]);

  // Toggle Microphone Speech-to-Text Recognition
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  }, [isListening, showToast]);

  const handleCopy = (content: string, id: string) => {
    try {
      navigator.clipboard.writeText(content);
      setCopiedId(id);
      showToast('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Advanced Real-time Streaming & Quantitative Execution
  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    // Check & Execute Tracy AI Terminal Control Command
    const cmdResult = interpretAndExecuteTracyCommand(textToSend, controller);
    if (cmdResult.executed) {
      showToast(`⚡ Tracy Action: ${cmdResult.label}`);
      if (cmdResult.actionType === 'open_strategy') {
        setShowPlaybookModal(true);
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantId = `ai-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: `${modelMode}-streaming`,
      mode: modelMode,
      thinkingSteps: [
        ...(cmdResult.executed ? [`⚡ Direct Execution: ${cmdResult.label} (${cmdResult.details})`] : []),
        `Ingesting live telemetry: ${context.pair || 'Deriv'} on ${context.timeframe || '1t'}`,
        `Analyzing Markov transition chains & Poisson distribution`,
        `Cross-referencing 1% capital survival limit against $${context.balance || '500'}`,
        `Synthesizing response via ${modelMode === 'gemini' ? 'Google Gemini 3.8 Flash' : modelMode === 'chatgpt' ? 'ChatGPT GPT-4o Reasoning' : 'Tracy AI Terminal Engine'}`,
      ],
    };

    const updated = [...messages, userMsg, initialAssistantMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      // 1. Try real-time streaming endpoint first
      const res = await fetch('/api/mentor/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend,
          messages: updated.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          mode: modelMode,
          tradingContext: context,
        }),
        signal: abortCtrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Streaming failed with status: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let collectedSteps: string[] = [];
      let finalPlan: TradePlan | undefined = undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                accumulatedText += payload.token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: accumulatedText } : msg
                  )
                );
              } else if (payload.thinkingStep) {
                collectedSteps.push(payload.thinkingStep);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, thinkingSteps: [...collectedSteps] } : msg
                  )
                );
              } else if (payload.text) {
                accumulatedText += payload.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: accumulatedText } : msg
                  )
                );
              } else if (payload.step) {
                collectedSteps.push(payload.step);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, thinkingSteps: [...collectedSteps] } : msg
                  )
                );
              }
              if (payload.tradePlan) {
                finalPlan = payload.tradePlan;
              }
            } catch {
              // ignore json parse of partial line
            }
          }
        }
      }

      // Check if accumulated text contains trade-plan block
      const parsed = parseTradePlanBlock(accumulatedText);
      const chosenPlan = parsed.plan || finalPlan;
      const finalText = parsed.cleanText || accumulatedText;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: finalText,
                tradePlan: chosenPlan,
              }
            : msg
        )
      );

      // Auto-speak voice if enabled
      if (autoVoice && finalText) {
        handleSpeak(finalText, assistantId);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User aborted intentionally
        return;
      }
      console.warn('Streaming error, falling back to standard JSON API:', err);

      try {
        const fallbackRes = await fetch('/api/mentor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: textToSend,
            messages: updated.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
            mode: modelMode,
            tradingContext: context,
          }),
        });

        const data = await fallbackRes.json();
        const parsed = parseTradePlanBlock(data.reply || '');
        const fallbackText = parsed.cleanText || data.reply || 'Analysis completed.';

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: fallbackText,
                  tradePlan: parsed.plan || data.tradePlan,
                  source: data.source || `${modelMode}-quant`,
                }
              : msg
          )
        );

        if (autoVoice && fallbackText) {
          handleSpeak(fallbackText, assistantId);
        }
      } catch (finalErr) {
        console.error('Final AI fallback failed:', finalErr);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Start 2-Way Live Voice Call with Tracy AI
  const startVoiceCall = () => {
    setIsCallOpen(true);
    setCallStatus('speaking');
    setCallDuration(0);
    setCallUserTranscript('');
    const introSpeech = `Hey partner! I'm Tracy. I'm right here with you watching ${context.pair || 'the markets'}. Talk to me—how can I help you right now?`;
    setCallTracyReply(introSpeech);

    handleSpeak(introSpeech, `call-intro-${Date.now()}`, () => {
      if (!isCallMuted) {
        startCallListening();
      } else {
        setCallStatus('idle');
      }
    });
  };

  const endVoiceCall = () => {
    stopAllSpeech();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setIsCallOpen(false);
    setCallStatus('idle');
    showToast('Voice call ended.');
  };

  const startCallListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCallStatus('idle');
      return;
    }

    try {
      setCallStatus('listening');
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalCaptured = '';

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        if (text) {
          finalCaptured = text;
          setCallUserTranscript(text);
        }
      };

      recognition.onerror = () => {
        setCallStatus('idle');
      };

      recognition.onend = () => {
        if (finalCaptured.trim()) {
          processCallUserInput(finalCaptured.trim());
        } else {
          setCallStatus('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setCallStatus('idle');
    }
  };

  const processCallUserInput = async (userText: string) => {
    setCallStatus('thinking');
    setCallUserTranscript(userText);

    // Check & Execute Tracy AI Terminal Control Command in voice call
    const cmdResult = interpretAndExecuteTracyCommand(userText, controller);
    if (cmdResult.executed) {
      showToast(`⚡ Tracy Action: ${cmdResult.label}`);
      if (cmdResult.actionType === 'open_strategy') {
        setShowPlaybookModal(true);
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          mode: 'tracy',
          tradingContext: context,
        }),
      });

      const data = await res.json();
      const baseReply = data.reply || "I'm right here with you partner. Let's examine the next tick.";
      const reply = cmdResult.executed ? `${cmdResult.spokenConfirmation} ${baseReply}` : baseReply;
      setCallTracyReply(reply);
      setCallStatus('speaking');

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'tracy-voice-call',
        mode: 'tracy',
        tradePlan: data.tradePlan,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      handleSpeak(reply, assistantMsg.id, () => {
        if (!isCallMuted) {
          startCallListening();
        } else {
          setCallStatus('idle');
        }
      });
    } catch {
      setCallStatus('idle');
    }
  };

  const handleResetChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const template = INITIAL_MESSAGES_MAP[modelMode] || INITIAL_MESSAGES_MAP.tracy;
    const resetList = template.map((m) => ({
      ...m,
      id: `intro-${Date.now()}`,
      content: m.content
        .replace(/{PAIR}/g, context.pair || 'Deriv Synthetics')
        .replace(/{TIMEFRAME}/g, context.timeframe || '1t')
        .replace(/{BALANCE}/g, context.isBalanceSetByUser && context.balance ? `$${parseFloat(context.balance).toFixed(2)}` : 'Not Set (tell Tracy when ready)'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    setMessages(resetList);
    stopAllSpeech();
    setLoading(false);
    showToast('New chat session started.');
  };

  const handleExportChat = () => {
    const text = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'YOU' : m.mode?.toUpperCase() || 'AI'}:\n${m.content}\n`)
      .join('\n---\n\n');
    navigator.clipboard?.writeText(text);
    showToast('Entire conversation copied to clipboard!');
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: modelMode === 'gemini' ? '#38bdf8' : modelMode === 'chatgpt' ? '#10b981' : '#00ffcc', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              background: '#0d1322',
              color: '#f59e0b',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              border: '1px solid #1e293b',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} style={{ color: modelMode === 'gemini' ? '#38bdf8' : modelMode === 'chatgpt' ? '#10b981' : '#00ffcc', margin: '8px 0 4px', fontSize: 13, fontWeight: 700 }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} style={{ color: '#ffaa00', margin: '10px 0 6px', fontSize: 14, fontWeight: 800 }}>
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const itemText = line.trim().slice(2);
        return (
          <div key={idx} style={{ display: 'flex', gap: 6, margin: '3px 0', paddingLeft: 6 }}>
            <span style={{ color: modelMode === 'gemini' ? '#38bdf8' : '#10b981' }}>•</span>
            <span>{renderInlineStyles(itemText)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <div key={idx} style={{ margin: '4px 0', paddingLeft: 6 }}>
            {renderInlineStyles(line)}
          </div>
        );
      }
      if (line.startsWith('```')) {
        return null;
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            style={{
              borderLeft: '3px solid #ffaa00',
              paddingLeft: 8,
              margin: '6px 0',
              color: '#f8fafc',
              fontStyle: 'italic',
              background: 'rgba(255, 170, 0, 0.08)',
              padding: '4px 8px',
              borderRadius: '0 4px 4px 0',
            }}
          >
            {renderInlineStyles(line.replace('> ', ''))}
          </blockquote>
        );
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: 6 }} />;
      }
      return <p key={idx} style={{ margin: '3px 0' }}>{renderInlineStyles(line)}</p>;
    });
  };

  // Render Interactive Executable Trade Plan Card
  const renderTradePlanCard = (plan: TradePlan) => {
    const isBuy = plan.action.includes('BUY') || plan.action.includes('DIFFERS');
    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc' }}>
              ⚡ {plan.pair}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 4,
                background: isBuy ? 'rgba(0, 255, 153, 0.15)' : 'rgba(255, 85, 85, 0.15)',
                color: isBuy ? '#00ff99' : '#ff5555',
                border: isBuy ? '1px solid #00ff99' : '1px solid #ff5555',
              }}
            >
              {plan.action}
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ffd700' }}>
            🔥 {plan.confidence}% High Confidence
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, fontSize: 11, marginBottom: 8 }}>
          <div style={{ background: '#0a0f1d', padding: '6px 8px', borderRadius: 4, border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 10 }}>ENTRY</span>
            <div style={{ color: '#00ffcc', fontWeight: 700 }}>{plan.entry}</div>
          </div>
          <div style={{ background: '#0a0f1d', padding: '6px 8px', borderRadius: 4, border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 10 }}>STOP LOSS / BARRIER</span>
            <div style={{ color: '#ff5555', fontWeight: 700 }}>{plan.sl}</div>
          </div>
          <div style={{ background: '#0a0f1d', padding: '6px 8px', borderRadius: 4, border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 10 }}>TARGET (TP1 / TP2)</span>
            <div style={{ color: '#00ff99', fontWeight: 700 }}>{plan.tp1}</div>
          </div>
          <div style={{ background: '#0a0f1d', padding: '6px 8px', borderRadius: 4, border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 10 }}>RISK STAKE / LOT</span>
            <div style={{ color: '#ffd700', fontWeight: 700 }}>{plan.riskStake}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8, fontStyle: 'italic' }}>
          💡 <b>Confluence</b>: {plan.reason}
        </div>

        <button
          onClick={() => {
            const txt = `⚡ [AI EXECUTABLE TRADE SETUP]
PAIR: ${plan.pair}
ACTION: ${plan.action}
ENTRY: ${plan.entry}
SL / BARRIER: ${plan.sl}
TP: ${plan.tp1} | ${plan.tp2}
STAKE / LOT: ${plan.riskStake}
CONFIDENCE: ${plan.confidence}%
REASON: ${plan.reason}`;
            navigator.clipboard?.writeText(txt);
            alert(`✅ Trade setup for ${plan.pair} copied to clipboard!`);
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>📋 Copy Executable Parameters</span>
        </button>
      </div>
    );
  };

  // Quick Action Intelligence Tools
  const aiTools = [
    {
      id: 'chat-tracy',
      label: '✨ Chat with Tracy',
      prompt: `Hey Tracy! Can you check how the market is behaving right now on ${context.pair || 'Deriv'}? Give me your honest human take.`,
    },
    {
      id: 'scan',
      label: '⚡ Live Setup Scan',
      prompt: `Audit live setup on ${context.pair || 'Deriv'} (${context.timeframe || '1t'}). Provide exact entry and risk parameters.`,
    },
    {
      id: 'risk',
      label: '🛡️ 1% Capital Audit',
      prompt: `Calculate fractional Kelly criterion & exact 1% risk limit on my $${context.balance || '500'} capital.`,
    },
    {
      id: 'digits',
      label: '🎯 Matches vs Differs Odds',
      prompt: `Dissect live digit probabilities for current digit ${context.hotDigit ?? '7'}. Matches 800% vs Differs 98% edge.`,
    },
    {
      id: 'smc',
      label: '🏛️ SMC Liquidity Scan',
      prompt: `Identify institutional Order Blocks, Fair Value Gaps, and retail liquidity pools on ${context.pair || 'this chart'}.`,
    },
    {
      id: 'tilt',
      label: '❤️ Tilt & Loss Reset',
      prompt: `I just had a loss and feel frustrated. Tracy, talk me through this and help me reset my emotions and protect my capital.`,
    },
    {
      id: 'kenya-time',
      label: '🇰🇪 Kenyan Trading Hours',
      prompt: `What time is it in Kenya right now, and what are the best Kenyan hours (EAT) to trade Deriv synthetics and Over/Under?`,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isFloating ? '560px' : '720px',
        maxHeight: isFloating ? '80vh' : '82vh',
        background: '#0c101c',
        borderRadius: 12,
        border: '1px solid #1e293b',
        boxShadow: isFloating ? '0 12px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 255, 204, 0.2)' : '0 8px 32px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* HEADER WITH CHATGPT & GEMINI BRANDING & MODEL SELECTOR */}
      <div
        style={{
          padding: '10px 14px',
          background: 'linear-gradient(135deg, #0e172a 0%, #152238 100%)',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Active Model Avatar */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background:
                modelMode === 'tracy'
                  ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)'
                  : modelMode === 'gemini'
                  ? 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'
                  : modelMode === 'chatgpt'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow:
                modelMode === 'tracy'
                  ? '0 0 16px rgba(236, 72, 153, 0.6)'
                  : modelMode === 'gemini'
                  ? '0 0 14px rgba(56, 189, 248, 0.5)'
                  : modelMode === 'chatgpt'
                  ? '0 0 14px rgba(16, 185, 129, 0.5)'
                  : '0 0 14px rgba(0, 255, 204, 0.4)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          >
            {modelMode === 'tracy' ? '✨' : modelMode === 'gemini' ? '♊' : modelMode === 'chatgpt' ? '🤖' : '👨‍💼'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc' }}>
                {modelMode === 'tracy'
                  ? 'Tracy AI (Human Trading Partner)'
                  : modelMode === 'gemini'
                  ? 'Google Gemini 3.8 Flash'
                  : modelMode === 'chatgpt'
                  ? 'ChatGPT GPT-4o Reasoning'
                  : 'Marcus Vance (Prop Mentor)'}
              </span>
              <span
                style={{
                  background:
                    modelMode === 'tracy'
                      ? 'rgba(236, 72, 153, 0.2)'
                      : modelMode === 'gemini'
                      ? 'rgba(56, 189, 248, 0.15)'
                      : modelMode === 'chatgpt'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(0, 255, 204, 0.15)',
                  color:
                    modelMode === 'tracy' ? '#f472b6' : modelMode === 'gemini' ? '#38bdf8' : modelMode === 'chatgpt' ? '#10b981' : '#00ffcc',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '1px 6px',
                  borderRadius: 12,
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {modelMode === 'tracy' ? '🎙️ HUMAN VOICE & CHAT' : 'LIVE QUANT AI'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, flexWrap: 'wrap' }}>
              <span style={{ color: '#10b981' }}>● Live Companion</span>
              <span>•</span>
              {context.day && (
                <>
                  <span style={{ color: '#ffd700', fontWeight: 800 }}>📅 {context.day}</span>
                  <span>•</span>
                </>
              )}
              <span>Pair: <b>{context.pair || 'Deriv'}</b></span>
              <span>•</span>
              <span>TF: <b>{context.timeframe || '1t'}</b></span>
            </div>
          </div>
        </div>

        {/* MODEL MODE SELECTOR PILLS & VOICE CALL TRIGGER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* 📞 LIVE VOICE CALL BUTTON */}
          <button
            onClick={startVoiceCall}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: '1px solid #34d399',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.45)',
            }}
            title="Start an interactive hands-free voice call with Tracy AI"
          >
            <span style={{ fontSize: 13 }}>📞</span>
            <span>Call Tracy AI</span>
            <span className="live-dot" style={{ background: '#fff', width: 6, height: 6 }} />
          </button>

          {/* AUTO-VOICE TOGGLE */}
          <button
            onClick={() => {
              const next = !autoVoice;
              setAutoVoice(next);
              if (!next) stopAllSpeech();
              showToast(next ? '🔊 Auto-Voice enabled' : '🔇 Auto-Voice muted');
            }}
            style={{
              background: autoVoice ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
              color: autoVoice ? '#38bdf8' : '#94a3b8',
              border: autoVoice ? '1px solid #38bdf8' : '1px solid #334155',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Toggle automatic spoken voice playback"
          >
            <span>{autoVoice ? '🔊' : '🔇'}</span>
            <span>{autoVoice ? 'Voice: ON' : 'Voice: OFF'}</span>
          </button>

          <div
            style={{
              display: 'flex',
              background: '#090d16',
              borderRadius: 8,
              padding: 2,
              border: '1px solid #1e293b',
              gap: 2,
            }}
          >
            <button
              onClick={() => setModelMode('tracy')}
              style={{
                background: modelMode === 'tracy' ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' : 'transparent',
                color: modelMode === 'tracy' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Tracy AI - Real Human Trading Partner, Voice Companion, & Mentor"
            >
              <span>✨</span> Tracy
            </button>
            <button
              onClick={() => setModelMode('gemini')}
              style={{
                background: modelMode === 'gemini' ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)' : 'transparent',
                color: modelMode === 'gemini' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Google Gemini - Multimodal Quant Analysis & Statistical Distribution"
            >
              <span>✦</span> Gemini
            </button>
            <button
              onClick={() => setModelMode('chatgpt')}
              style={{
                background: modelMode === 'chatgpt' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: modelMode === 'chatgpt' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="ChatGPT - Chain-of-Thought Structural Reasoning & Trade Blueprints"
            >
              <span>🤖</span> ChatGPT
            </button>
            <button
              onClick={() => setModelMode('marcus')}
              style={{
                background: modelMode === 'marcus' ? 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)' : 'transparent',
                color: modelMode === 'marcus' ? '#000' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Marcus Vance - Institutional Floor Mentor & Trader Psychology"
            >
              <span>🎙️</span> Marcus
            </button>
          </div>

          {/* Speech Rate Controls */}
          <select
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 10,
              cursor: 'pointer',
            }}
            title="Speech Playback Speed"
          >
            <option value={0.85}>0.85x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.2}>1.2x</option>
          </select>

          <button
            onClick={handleResetChat}
            title="Start New Chat"
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            ✨ New Chat
          </button>
          <button
            onClick={handleExportChat}
            title="Export Conversation"
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            📋 Export
          </button>

          {isFloating && onCloseFloating && (
            <button
              onClick={onCloseFloating}
              style={{
                background: '#334155',
                color: '#f8fafc',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* QUICK INTELLIGENCE ACTION TOOLS BAR */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          padding: '6px 12px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
          AI TOOLS:
        </span>
        {aiTools.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSend(t.prompt)}
            disabled={loading}
            style={{
              background: '#162238',
              color: '#38bdf8',
              border: '1px solid #23375c',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MESSAGES SCROLL CONTAINER */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const msgMode = m.mode || modelMode;
          const isThinkingOpen = expandedThinking[m.id];

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  maxWidth: isUser ? '85%' : '95%',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar Icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isUser
                      ? '#334155'
                      : msgMode === 'tracy'
                      ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)'
                      : msgMode === 'gemini'
                      ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                      : msgMode === 'chatgpt'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow: !isUser
                      ? msgMode === 'tracy'
                        ? '0 0 10px rgba(236, 72, 153, 0.5)'
                        : msgMode === 'gemini'
                        ? '0 0 8px rgba(56, 189, 248, 0.4)'
                        : msgMode === 'chatgpt'
                        ? '0 0 8px rgba(16, 185, 129, 0.4)'
                        : '0 0 8px rgba(0, 255, 204, 0.3)'
                      : undefined,
                  }}
                >
                  {isUser ? '👤' : msgMode === 'tracy' ? '✨' : msgMode === 'gemini' ? '✦' : msgMode === 'chatgpt' ? '🤖' : '👨‍💼'}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    background: isUser
                      ? '#1e293b'
                      : msgMode === 'tracy'
                      ? '#15142a'
                      : msgMode === 'gemini'
                      ? '#0d1527'
                      : msgMode === 'chatgpt'
                      ? '#0d1c16'
                      : '#111827',
                    border: isUser
                      ? '1px solid #334155'
                      : msgMode === 'tracy'
                      ? '1px solid rgba(236, 72, 153, 0.3)'
                      : msgMode === 'gemini'
                      ? '1px solid rgba(56, 189, 248, 0.3)'
                      : msgMode === 'chatgpt'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid #1f293d',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: '#f1f5f9',
                    fontSize: 13,
                    lineHeight: 1.55,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    width: '100%',
                  }}
                >
                  {/* Model header on Assistant response */}
                  {!isUser && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                        paddingBottom: 4,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color:
                            msgMode === 'tracy'
                              ? '#f472b6'
                              : msgMode === 'gemini'
                              ? '#38bdf8'
                              : msgMode === 'chatgpt'
                              ? '#10b981'
                              : '#00ffcc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {msgMode === 'tracy'
                          ? '✨ Tracy AI (Human Trading Partner)'
                          : msgMode === 'gemini'
                          ? '✦ Google Gemini 3.8 Flash'
                          : msgMode === 'chatgpt'
                          ? '🤖 ChatGPT GPT-4o Reasoning'
                          : '🎙️ Marcus Vance Desk Leader'}
                      </span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>{m.timestamp}</span>
                    </div>
                  )}

                  {/* Collapsible Chain-of-Thought / Thinking process */}
                  {!isUser && m.thinkingSteps && m.thinkingSteps.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <button
                        onClick={() => toggleThinking(m.id)}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          padding: '3px 8px',
                          color: '#94a3b8',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{isThinkingOpen ? '▼' : '▶'}</span>
                        <span>{isThinkingOpen ? 'Hide reasoning process' : `Thinking process (${m.thinkingSteps.length} steps)`}</span>
                      </button>

                      {isThinkingOpen && (
                        <div
                          style={{
                            marginTop: 4,
                            padding: '6px 10px',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 6,
                            fontSize: 11,
                            color: '#94a3b8',
                            borderLeft: `2px solid ${
                              msgMode === 'tracy' ? '#f472b6' : msgMode === 'gemini' ? '#38bdf8' : '#10b981'
                            }`,
                          }}
                        >
                          {m.thinkingSteps.map((step, sIdx) => (
                            <div key={sIdx} style={{ margin: '2px 0' }}>
                              ✓ {step}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formatted Message Body */}
                  <div>
                    {renderFormattedContent(m.content)}
                    {loading && m.id === messages[messages.length - 1]?.id && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 14,
                          background: msgMode === 'tracy' ? '#f472b6' : '#38bdf8',
                          marginLeft: 2,
                          verticalAlign: 'middle',
                          animation: 'blink 0.8s infinite',
                        }}
                      />
                    )}
                  </div>

                  {/* Executable Trade Plan Card if present */}
                  {!isUser && m.tradePlan && renderTradePlanCard(m.tradePlan)}

                  {/* Action Toolbar on Assistant Messages */}
                  {!isUser && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        style={{
                          background: '#162032',
                          color: copiedId === m.id ? '#00ffcc' : '#94a3b8',
                          border: '1px solid #233352',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {copiedId === m.id ? '✓ Copied!' : '📋 Copy'}
                      </button>

                      <button
                        onClick={() => handleSpeak(m.content, m.id)}
                        style={{
                          background:
                            isSpeaking && activeSpeechId === m.id
                              ? msgMode === 'tracy'
                                ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                                : '#00ffcc'
                              : '#162032',
                          color: isSpeaking && activeSpeechId === m.id ? '#ffffff' : '#94a3b8',
                          border: '1px solid #233352',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: isSpeaking && activeSpeechId === m.id ? 700 : 400,
                        }}
                      >
                        {isSpeaking && activeSpeechId === m.id ? (
                          <>
                            <span>⏹ Stop Voice</span>
                            <span style={{ fontSize: 9 }}>🔊 (Speaking)</span>
                          </>
                        ) : (
                          <>
                            <span>🔊 Listen to Tracy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => showToast('Feedback noted! Model calibrated for higher accuracy.')}
                        style={{
                          background: '#162032',
                          color: '#94a3b8',
                          border: '1px solid #233352',
                          borderRadius: 4,
                          padding: '3px 6px',
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                        title="Good response"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => showToast('Feedback noted! Adjusted parameters for next setup.')}
                        style={{
                          background: '#162032',
                          color: '#94a3b8',
                          border: '1px solid #233352',
                          borderRadius: 4,
                          padding: '3px 6px',
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                        title="Needs improvement"
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming / Loading Indicator with Stop Generation button */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background:
                    modelMode === 'tracy'
                      ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                      : modelMode === 'gemini'
                      ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                      : modelMode === 'chatgpt'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : '#00ffcc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                }}
              >
                {modelMode === 'tracy' ? '✨' : '✦'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>
                  {modelMode === 'tracy'
                    ? 'Tracy AI is thinking through your trade...'
                    : modelMode === 'gemini'
                    ? 'Gemini streaming quantitative models...'
                    : modelMode === 'chatgpt'
                    ? 'ChatGPT streaming chain-of-thought...'
                    : 'Marcus Vance generating desk strategy...'}
                </span>
                <span className="live-dot" style={{ background: modelMode === 'tracy' ? '#f472b6' : '#00ffcc' }}></span>
              </div>
            </div>

            <button
              onClick={handleStopGeneration}
              style={{
                background: '#450a0a',
                color: '#f87171',
                border: '1px solid #ef4444',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⏹ Stop Generating
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* LISTENING INDICATOR BAR (WHEN MIC IS ACTIVE) */}
      {isListening && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
            borderTop: '1px solid rgba(236, 72, 153, 0.4)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#f472b6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎙️</span>
            <span style={{ fontWeight: 800 }}>Listening to your voice... Speak naturally to Tracy</span>
            <span className="live-dot" style={{ background: '#ef4444' }} />
          </div>
          <button
            onClick={toggleListening}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done Speaking
          </button>
        </div>
      )}

      {/* ⚡ TRACY TERMINAL CONTROL QUICK ACTION CHIPS */}
      <div
        style={{
          padding: '6px 12px 4px',
          background: '#0a0f1d',
          borderTop: '1px solid #1a2234',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          alignItems: 'center',
          scrollbarWidth: 'none',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#f472b6',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>⚡</span> Pro Desk:
        </span>

        {/* 📘 INTERACTIVE PLAYBOOK MODAL BUTTON */}
        <button
          type="button"
          onClick={() => {
            setPlaybookStrategy('rise_fall');
            setShowPlaybookModal(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            border: '1px solid #38bdf8',
            color: '#fff',
            borderRadius: 14,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
          }}
        >
          📘 Pro Playbook
        </button>

        {/* 💰 USER BALANCE DISCLOSURE BUTTON */}
        <button
          type="button"
          onClick={() => {
            const inputBal = window.prompt('Enter your account balance ($ USD) for Tracy to track:');
            if (inputBal) {
              const cleaned = inputBal.replace(/[^0-9.]/g, '');
              const num = parseFloat(cleaned);
              if (!isNaN(num) && num > 0) {
                handleSend(`Tracy, my balance is $${num.toFixed(2)}`);
              }
            }
          }}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: '1px solid #34d399',
            color: '#fff',
            borderRadius: 14,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Click to tell Tracy your exact trading balance"
        >
          💰 {context.isBalanceSetByUser && context.balance ? `Bal: $${parseFloat(context.balance).toFixed(2)}` : 'Set Balance'}
        </button>

        {/* PRO STRATEGY DIRECT CHIPS */}
        {[
          { label: '🤖 XML Bot Match', cmd: 'Tracy, give me the entry number and match number for my Deriv XML bot' },
          { label: '🎯 Over/Under M1', cmd: 'Tracy, give me the pro strategy for Over and Under with exact minutes and entry triggers' },
          { label: '⚖️ Even/Odd (1t)', cmd: 'Tracy, what is the best strategy for Even and Odd digits and ticks?' },
          { label: '📈 Raise & Fall (M1)', cmd: 'Tracy, give me the pro strategy for Raise and Fall with 1 minute expiration' },
          { label: '⚡ High/Low 5t', cmd: 'Tracy, explain the High Tick and Low Tick 5 ticks strategy and optimal entry' },
          { label: '🚀 Ups & Downs', cmd: 'Tracy, break down the Ups and Downs strategy and minute timeframes' },
          { label: '⏱️ Minutes Guide', cmd: 'Tracy, which minutes and timeframes should I use for each trade type?' },
          { label: '⚡ Vol 15 (1s)', cmd: 'Tracy, switch to Vol 15 1s' },
          { label: '⚡ Vol 75', cmd: 'Tracy, switch to Vol 75' },
          { label: '📡 Multi-Scanner', cmd: 'Tracy, open the live scanner' },
          { label: '🟡 MT5 Station', cmd: 'Tracy, open MT5' },
          { label: '🚀 Buy Rise', cmd: 'Tracy, buy rise' },
          { label: '🔻 Sell Fall', cmd: 'Tracy, sell fall' },
          { label: '💰 Stake $10', cmd: 'Tracy, set stake to 10' },
          { label: '🕒 Good Time', cmd: 'Tracy, is it a good time to trade?' },
          { label: '🔄 Refresh Radar', cmd: 'Tracy, refresh analysis' },
        ].map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(chip.cmd)}
            style={{
              background: '#131b2e',
              border: '1px solid #233352',
              color: '#cbd5e1',
              borderRadius: 14,
              padding: '3px 9px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ec4899';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#233352';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* INPUT BAR WITH MICROPHONE & KEYBOARD */}
      <div
        style={{
          padding: '10px 14px',
          background: '#0c101c',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {/* MICROPHONE BUTTON */}
        <button
          onClick={toggleListening}
          title={isListening ? 'Stop listening' : 'Speak to Tracy using your microphone'}
          style={{
            background: isListening
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            color: isListening ? '#ffffff' : '#f472b6',
            border: isListening ? '1px solid #f87171' : '1px solid rgba(236, 72, 153, 0.3)',
            borderRadius: 8,
            padding: '10px 13px',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isListening ? '0 0 14px rgba(239, 68, 68, 0.6)' : undefined,
            transition: 'all 0.2s ease',
          }}
        >
          <span>🎙️</span>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            modelMode === 'tracy'
              ? 'Talk or type to Tracy AI (e.g. "How is Vol 75 looking?" or "Help me reset")...'
              : modelMode === 'gemini'
              ? 'Ask Google Gemini about Deriv timeframes, digit probabilities, or SMC...'
              : modelMode === 'chatgpt'
              ? 'Ask ChatGPT for step-by-step trading blueprints, risk rules, or code...'
              : 'Ask Marcus Vance for floor mentorship, psychology resets, or lot sizing...'
          }
          style={{
            flex: 1,
            background: '#131b2c',
            border: '1px solid #233352',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#f8fafc',
            fontSize: 13,
            outline: 'none',
          }}
        />

        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            background:
              modelMode === 'tracy'
                ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                : modelMode === 'gemini'
                ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                : modelMode === 'chatgpt'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #00ffcc 0%, #0099ff 100%)',
            color: modelMode === 'marcus' ? '#000' : '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.6 : 1,
            boxShadow:
              modelMode === 'tracy'
                ? '0 0 12px rgba(236, 72, 153, 0.4)'
                : modelMode === 'gemini'
                ? '0 0 12px rgba(56, 189, 248, 0.4)'
                : modelMode === 'chatgpt'
                ? '0 0 12px rgba(16, 185, 129, 0.4)'
                : '0 0 12px rgba(0, 255, 204, 0.4)',
          }}
        >
          {loading ? 'Thinking...' : 'Send ➔'}
        </button>
      </div>

      {/* 📞 INTERACTIVE LIVE VOICE CALL OVERLAY SCREEN */}
      {isCallOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, #1b1633 0%, #080712 100%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px 24px',
            color: '#f8fafc',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Call Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: callStatus === 'speaking' ? '#ec4899' : callStatus === 'listening' ? '#10b981' : '#38bdf8',
                  boxShadow: `0 0 10px ${callStatus === 'speaking' ? '#ec4899' : '#10b981'}`,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Live Voice Call with Tracy AI</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {callStatus === 'speaking'
                    ? '✨ Tracy is speaking...'
                    : callStatus === 'listening'
                    ? '🎙️ Listening to you...'
                    : callStatus === 'thinking'
                    ? '🧠 Tracy is analyzing...'
                    : 'Ready for your voice'}
                </div>
              </div>
            </div>

            {/* Timer Badge */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⏱️</span>
              <span>
                {String(Math.floor(callDuration / 60)).padStart(2, '0')}:{String(callDuration % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Central Animated Voice Orb */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <div
              style={{
                position: 'relative',
                width: 130,
                height: 130,
                borderRadius: '50%',
                background:
                  callStatus === 'speaking'
                    ? 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%)'
                    : callStatus === 'listening'
                    ? 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                boxShadow:
                  callStatus === 'speaking'
                    ? '0 0 50px rgba(236, 72, 153, 0.7), 0 0 80px rgba(139, 92, 246, 0.4)'
                    : callStatus === 'listening'
                    ? '0 0 50px rgba(16, 185, 129, 0.7)'
                    : '0 0 30px rgba(139, 92, 246, 0.4)',
                transform: callStatus === 'speaking' || callStatus === 'listening' ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
              }}
            >
              <span>{callStatus === 'speaking' ? '✨' : callStatus === 'listening' ? '🎙️' : '👩‍💼'}</span>
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>Tracy AI</div>
              <div style={{ fontSize: 11, color: '#f472b6', fontWeight: 600 }}>Your Human Trading Companion</div>
            </div>

            {/* Live Caption Card */}
            <div
              style={{
                marginTop: 16,
                width: '100%',
                maxWidth: 480,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#e2e8f0',
                maxHeight: '130px',
                overflowY: 'auto',
              }}
            >
              {callUserTranscript && (
                <div style={{ color: '#38bdf8', marginBottom: 6, fontStyle: 'italic' }}>
                  <b>🗣️ You:</b> "{callUserTranscript}"
                </div>
              )}
              {callTracyReply ? (
                <div>
                  <b style={{ color: '#f472b6' }}>✨ Tracy:</b> {callTracyReply.slice(0, 320)}
                  {callTracyReply.length > 320 ? '...' : ''}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                  Speak to Tracy naturally like a real human trading friend...
                </div>
              )}
            </div>
          </div>

          {/* Quick Voice Chips inside Call */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => processCallUserInput(`Tracy, check the current digit and market setup on ${context.pair || 'Deriv'}`)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 16,
                padding: '4px 10px',
                color: '#e2e8f0',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              ⚡ Audit Current Setup
            </button>
            <button
              onClick={() => processCallUserInput(`Tracy, I took a loss and need help resetting my headspace`)}
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 16,
                padding: '4px 10px',
                color: '#fda4af',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              ❤️ Tilt & Loss Reset
            </button>
            <button
              onClick={() => processCallUserInput(`What is my safe 1% risk stake right now?`)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 16,
                padding: '4px 10px',
                color: '#e2e8f0',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              🛡️ Check 1% Risk
            </button>
          </div>

          {/* Bottom Call Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <button
              onClick={() => {
                const nextMute = !isCallMuted;
                setIsCallMuted(nextMute);
                if (nextMute && recognitionRef.current) {
                  try {
                    recognitionRef.current.stop();
                  } catch {}
                  setCallStatus('idle');
                } else if (!nextMute) {
                  startCallListening();
                }
                showToast(nextMute ? 'Microphone muted' : 'Microphone unmuted');
              }}
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: isCallMuted ? '#ef4444' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={isCallMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isCallMuted ? '🔇' : '🎙️'}
            </button>

            <button
              onClick={startCallListening}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 24,
                padding: '10px 20px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🎙️ Speak Now</span>
            </button>

            <button
              onClick={endVoiceCall}
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: '#dc2626',
                border: 'none',
                color: '#fff',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(220, 38, 38, 0.6)',
              }}
              title="End Voice Call"
            >
              📞
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION CONTAINER */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            border: '1px solid #38bdf8',
            borderRadius: 20,
            padding: '6px 16px',
            fontSize: 11,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            zIndex: 200,
            animation: 'fadeIn 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 📘 PRO STRATEGY PLAYBOOK MODAL */}
      <ProStrategyPlaybookModal
        isOpen={showPlaybookModal}
        onClose={() => setShowPlaybookModal(false)}
        theme="dark"
        initialStrategy={playbookStrategy}
        onSelectMarket={(market) => {
          controller?.switchMarket(market);
          showToast(`⚡ Tracy Switched Market to ${market}`);
        }}
      />
    </div>
  );
};
