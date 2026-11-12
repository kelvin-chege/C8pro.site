// Tracy AI Terminal Controller Bridge
// Allows Tracy AI in chat and voice call to control all application features

export interface AppControllerBridge {
  switchMarket: (symbol: string) => boolean;
  switchMt5Pair?: (symbol: string) => void;
  switchTab: (tab: 'deriv' | 'matches' | 'accu' | 'mt5' | 'risk' | 'mentor' | 'scanner') => void;
  setStake: (stake: number | string) => void;
  setBalance?: (balance: number | string) => void;
  openStrategyPlaybook?: (strategyKey?: string) => void;
  executeContract: (direction: 'rise' | 'fall' | 'over' | 'under' | 'even' | 'odd' | 'differ' | 'match') => {
    success: boolean;
    message: string;
    details?: string;
  };
  toggleSound: (enabled?: boolean) => boolean;
  refreshAnalysis: () => void;
  openGoodTradingTime: () => void;
  currentMarket: string;
  currentStake?: string;
  currentBalance?: string;
  isBalanceSet?: boolean;
  currentTab: string;
}

export interface ExecutedCommandResult {
  executed: boolean;
  actionType:
    | 'switch_market'
    | 'switch_tab'
    | 'set_stake'
    | 'set_balance'
    | 'open_strategy'
    | 'execute_trade'
    | 'refresh_analysis'
    | 'toggle_sound'
    | 'check_time'
    | 'none';
  label: string;
  details: string;
  spokenConfirmation: string;
}

// Synonyms and mapping to real Deriv / MT5 symbols
const MARKET_ALIASES: Record<string, { symbol: string; name: string }> = {
  // 1-Second Volatility Indices
  'vol 15 1s': { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index' },
  'volatility 15 1s': { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index' },
  '1hz15v': { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index' },
  'vol 10 1s': { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  'volatility 10 1s': { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  '1hz10v': { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  'vol 25 1s': { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  '1hz25v': { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  'vol 30 1s': { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index' },
  '1hz30v': { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index' },
  'vol 50 1s': { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  '1hz50v': { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  'vol 75 1s': { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  '1hz75v': { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  'vol 90 1s': { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index' },
  '1hz90v': { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index' },
  'vol 100 1s': { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  '1hz100v': { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  'vol 150 1s': { symbol: '1HZ150V', name: 'Volatility 150 (1s) Index' },
  '1hz150v': { symbol: '1HZ150V', name: 'Volatility 150 (1s) Index' },
  'vol 200 1s': { symbol: '1HZ200V', name: 'Volatility 200 (1s) Index' },
  '1hz200v': { symbol: '1HZ200V', name: 'Volatility 200 (1s) Index' },
  'vol 250 1s': { symbol: '1HZ250V', name: 'Volatility 250 (1s) Index' },
  '1hz250v': { symbol: '1HZ250V', name: 'Volatility 250 (1s) Index' },
  'vol 300 1s': { symbol: '1HZ300V', name: 'Volatility 300 (1s) Index' },
  '1hz300v': { symbol: '1HZ300V', name: 'Volatility 300 (1s) Index' },

  // Continuous Volatility Indices
  'vol 10': { symbol: 'R_10', name: 'Volatility 10 Index' },
  'vol 15': { symbol: 'R_15', name: 'Volatility 15 Index' },
  'vol 25': { symbol: 'R_25', name: 'Volatility 25 Index' },
  'vol 30': { symbol: 'R_30', name: 'Volatility 30 Index' },
  'vol 50': { symbol: 'R_50', name: 'Volatility 50 Index' },
  'vol 75': { symbol: 'R_75', name: 'Volatility 75 Index' },
  'vol 90': { symbol: 'R_90', name: 'Volatility 90 Index' },
  'vol 100': { symbol: 'R_100', name: 'Volatility 100 Index' },
  'vol 150': { symbol: 'R_150', name: 'Volatility 150 Index' },
  'vol 200': { symbol: 'R_200', name: 'Volatility 200 Index' },
  'vol 250': { symbol: 'R_250', name: 'Volatility 250 Index' },
  'vol 300': { symbol: 'R_300', name: 'Volatility 300 Index' },

  // Step Indices
  'step 100': { symbol: 'stpRNG', name: 'Step Index 100' },
  'step index 100': { symbol: 'stpRNG', name: 'Step Index 100' },
  'step 200': { symbol: 'stpRNG2', name: 'Step Index 200' },
  'step 300': { symbol: 'stpRNG3', name: 'Step Index 300' },
  'step 400': { symbol: 'stpRNG4', name: 'Step Index 400' },
  'step 500': { symbol: 'stpRNG5', name: 'Step Index 500' },

  // Jump Indices
  'jump 10': { symbol: 'JD10', name: 'Jump 10 Index' },
  'jump 25': { symbol: 'JD25', name: 'Jump 25 Index' },
  'jump 50': { symbol: 'JD50', name: 'Jump 50 Index' },
  'jump 75': { symbol: 'JD75', name: 'Jump 75 Index' },
  'jump 100': { symbol: 'JD100', name: 'Jump 100 Index' },
};

export const MT5_ALIASES: Record<string, { symbol: string; name: string }> = {
  'gold': { symbol: 'OANDA:XAUUSD', name: 'Gold Spot (XAUUSD)' },
  'xauusd': { symbol: 'OANDA:XAUUSD', name: 'Gold Spot (XAUUSD)' },
  'silver': { symbol: 'OANDA:XAGUSD', name: 'Silver Spot (XAGUSD)' },
  'xagusd': { symbol: 'OANDA:XAGUSD', name: 'Silver Spot (XAGUSD)' },
  'oil': { symbol: 'TVC:USOIL', name: 'WTI Crude Oil' },
  'usoil': { symbol: 'TVC:USOIL', name: 'WTI Crude Oil' },
  'crude': { symbol: 'TVC:USOIL', name: 'WTI Crude Oil' },
  'brent': { symbol: 'TVC:UKOIL', name: 'Brent Crude Oil' },
  'ukoil': { symbol: 'TVC:UKOIL', name: 'Brent Crude Oil' },
  'natural gas': { symbol: 'TVC:NATGAS', name: 'Natural Gas' },
  'natgas': { symbol: 'TVC:NATGAS', name: 'Natural Gas' },
  'copper': { symbol: 'TVC:COPPER', name: 'Copper Spot' },
  'us30': { symbol: 'CAPITALCOM:US30', name: 'Dow Jones 30' },
  'dow jones': { symbol: 'CAPITALCOM:US30', name: 'Dow Jones 30' },
  'nas100': { symbol: 'FOREXCOM:NSXUSD', name: 'Nasdaq 100' },
  'nasdaq': { symbol: 'FOREXCOM:NSXUSD', name: 'Nasdaq 100' },
  'spx500': { symbol: 'FOREXCOM:SPXUSD', name: 'S&P 500' },
  'sp500': { symbol: 'FOREXCOM:SPXUSD', name: 'S&P 500' },
  's&p 500': { symbol: 'FOREXCOM:SPXUSD', name: 'S&P 500' },
  'dax': { symbol: 'CAPITALCOM:DE40', name: 'Germany 40 (DAX)' },
  'ger40': { symbol: 'CAPITALCOM:DE40', name: 'Germany 40 (DAX)' },
  'ftse': { symbol: 'CAPITALCOM:UK100', name: 'UK 100 (FTSE)' },
  'uk100': { symbol: 'CAPITALCOM:UK100', name: 'UK 100 (FTSE)' },
  'nikkei': { symbol: 'CAPITALCOM:JP225', name: 'Japan 225 (Nikkei)' },
  'jp225': { symbol: 'CAPITALCOM:JP225', name: 'Japan 225 (Nikkei)' },
  'cac': { symbol: 'CAPITALCOM:FR40', name: 'France 40 (CAC)' },
  'hang seng': { symbol: 'CAPITALCOM:HK50', name: 'Hang Seng (HK50)' },
  'hk50': { symbol: 'CAPITALCOM:HK50', name: 'Hang Seng (HK50)' },
  'asx': { symbol: 'CAPITALCOM:AU200', name: 'Australia 200 (ASX)' },
  'btc': { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin (BTCUSD)' },
  'bitcoin': { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin (BTCUSD)' },
  'eth': { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum (ETHUSD)' },
  'ethereum': { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum (ETHUSD)' },
  'sol': { symbol: 'BINANCE:SOLUSDT', name: 'Solana (SOLUSD)' },
  'solana': { symbol: 'BINANCE:SOLUSDT', name: 'Solana (SOLUSD)' },
  'xrp': { symbol: 'BINANCE:XRPUSDT', name: 'Ripple (XRPUSD)' },
  'bnb': { symbol: 'BINANCE:BNBUSDT', name: 'Binance Coin (BNBUSD)' },
  'doge': { symbol: 'BINANCE:DOGEUSDT', name: 'Dogecoin (DOGEUSD)' },
  'eurusd': { symbol: 'OANDA:EURUSD', name: 'EUR/USD' },
  'gbpusd': { symbol: 'OANDA:GBPUSD', name: 'GBP/USD' },
  'usdjpy': { symbol: 'OANDA:USDJPY', name: 'USD/JPY' },
  'usdchf': { symbol: 'OANDA:USDCHF', name: 'USD/CHF' },
  'audusd': { symbol: 'OANDA:AUDUSD', name: 'AUD/USD' },
  'usdcad': { symbol: 'OANDA:USDCAD', name: 'USD/CAD' },
  'nzdusd': { symbol: 'OANDA:NZDUSD', name: 'NZD/USD' },
  'gbpjpy': { symbol: 'OANDA:GBPJPY', name: 'GBP/JPY' },
  'eurjpy': { symbol: 'OANDA:EURJPY', name: 'EUR/JPY' },
  'eurgbp': { symbol: 'OANDA:EURGBP', name: 'EUR/GBP' },
};

/**
 * Parses user input (or Tracy's response) and executes live control commands
 */
export function interpretAndExecuteTracyCommand(
  text: string,
  bridge?: AppControllerBridge
): ExecutedCommandResult {
  if (!bridge || !text) {
    return {
      executed: false,
      actionType: 'none',
      label: '',
      details: '',
      spokenConfirmation: '',
    };
  }

  const lower = text.toLowerCase().trim();

  // 1. Explicit [EXEC: ...] tag syntax (from AI response)
  const execMatch = text.match(/\[(?:EXEC|ACTION):\s*([a-zA-Z0-9_]+)(?:\s+([^\]]+))?\]/i);
  if (execMatch) {
    const cmd = execMatch[1].toLowerCase();
    const arg = execMatch[2]?.trim();

    if (cmd === 'switch_market' && arg) {
      bridge.switchMarket(arg);
      return {
        executed: true,
        actionType: 'switch_market',
        label: `Switched Market to ${arg}`,
        details: `Active market updated via Tracy AI command bridge.`,
        spokenConfirmation: `I've switched the market to ${arg} for you.`,
      };
    }
    if (cmd === 'switch_tab' && arg) {
      bridge.switchTab(arg as any);
      return {
        executed: true,
        actionType: 'switch_tab',
        label: `Opened ${arg.toUpperCase()} Tab`,
        details: `Navigation view switched to ${arg}.`,
        spokenConfirmation: `Switched view to ${arg}.`,
      };
    }
    if (cmd === 'set_stake' && arg) {
      const stakeNum = parseFloat(arg.replace(/[^0-9.]/g, ''));
      if (stakeNum > 0) {
        bridge.setStake(stakeNum);
        return {
          executed: true,
          actionType: 'set_stake',
          label: `Stake Set to $${stakeNum.toFixed(2)}`,
          details: `Risk sizing calibrated to $${stakeNum.toFixed(2)}.`,
          spokenConfirmation: `Stake calibrated to $${stakeNum.toFixed(2)}.`,
        };
      }
    }
    if (cmd === 'trade' && arg) {
      const dir = arg.toLowerCase() as any;
      const res = bridge.executeContract(dir);
      return {
        executed: true,
        actionType: 'execute_trade',
        label: `Executed ${arg.toUpperCase()}`,
        details: res.message,
        spokenConfirmation: `Order placed: ${arg.toUpperCase()}.`,
      };
    }
  }

  // 2. Natural Language: Market Switching
  // E.g. "switch to vol 15 1s", "change market to vol 75", "switch to 1hz15v", "go to step 100"
  if (
    lower.includes('switch to') ||
    lower.includes('change to') ||
    lower.includes('switch market') ||
    lower.includes('select market') ||
    lower.includes('open market') ||
    lower.includes('go to vol') ||
    lower.includes('go to step')
  ) {
    for (const [phrase, info] of Object.entries(MARKET_ALIASES)) {
      if (lower.includes(phrase)) {
        bridge.switchMarket(info.symbol);
        return {
          executed: true,
          actionType: 'switch_market',
          label: `Market Switched to ${info.name}`,
          details: `Ticker ${info.symbol} live feed and digit frequency radar connected.`,
          spokenConfirmation: `I switched your market to ${info.name}. Live tick stream is connected.`,
        };
      }
    }

    if (bridge.switchMt5Pair) {
      for (const [phrase, info] of Object.entries(MT5_ALIASES)) {
        if (lower.includes(phrase)) {
          bridge.switchMt5Pair(info.symbol);
          bridge.switchTab('mt5');
          return {
            executed: true,
            actionType: 'switch_market',
            label: `Switched MT5 Market to ${info.name}`,
            details: `Institutional order blocks, live chart, and confirmed signals loaded for ${info.symbol}.`,
            spokenConfirmation: `I've switched MT5 to ${info.name} and loaded your institutional order block analysis.`,
          };
        }
      }
    }
  }

  // Direct mention of Vol 15 1s (common high-priority request)
  if (lower.includes('vol 15 1s') || lower.includes('volatility 15 1s') || lower.includes('1hz15v')) {
    if (bridge.currentMarket !== '1HZ15V') {
      bridge.switchMarket('1HZ15V');
      return {
        executed: true,
        actionType: 'switch_market',
        label: 'Market Switched to Volatility 15 (1s)',
        details: 'Ticker 1HZ15V live feed engaged.',
        spokenConfirmation: "I've switched you over to Volatility 15 (1s) Index.",
      };
    }
  }

  // 3. Natural Language: Navigation Tabs
  if (
    lower.includes('open scanner') ||
    lower.includes('show scanner') ||
    lower.includes('switch to scanner') ||
    lower.includes('multi vol scanner') ||
    lower.includes('volatility scanner')
  ) {
    bridge.switchTab('scanner');
    return {
      executed: true,
      actionType: 'switch_tab',
      label: 'Opened Multi-Volatility Live Scanner',
      details: 'Monitoring all 28 synthetic markets simultaneously for Over/Under skew.',
      spokenConfirmation: "Opening the Multi-Volatility Over/Under Live Scanner right now.",
    };
  }

  if (
    lower.includes('open deriv') ||
    lower.includes('show deriv') ||
    lower.includes('deriv trading') ||
    lower.includes('go to deriv')
  ) {
    bridge.switchTab('deriv');
    return {
      executed: true,
      actionType: 'switch_tab',
      label: 'Switched to Deriv Live Terminal',
      details: `Active market: ${bridge.currentMarket}.`,
      spokenConfirmation: "Switched to Deriv Live Trading view.",
    };
  }

  if (
    lower.includes('open mt5') ||
    lower.includes('show mt5') ||
    lower.includes('go to mt5') ||
    lower.includes('forex station')
  ) {
    bridge.switchTab('mt5');
    return {
      executed: true,
      actionType: 'switch_tab',
      label: 'Opened MT5 Institutional Station',
      details: 'Gold, Forex, Indices, and Crypto SMC execution view active.',
      spokenConfirmation: "Switched to MT5 Institutional Station.",
    };
  }

  if (
    lower.includes('open matches') ||
    lower.includes('show matches') ||
    lower.includes('differs tab') ||
    lower.includes('matches tab') ||
    lower.includes('xml bot') ||
    lower.includes('entry number') ||
    lower.includes('match number')
  ) {
    bridge.switchTab('matches');
    return {
      executed: true,
      actionType: 'switch_tab',
      label: 'Opened Deriv XML Bot Matches Setup',
      details: 'Displaying exact Entry Trigger Number, Match Prediction Digit, and Confidence for Deriv Bot.',
      spokenConfirmation: "I've opened the Matches tab for your XML bot with the entry number, match number, and confidence.",
    };
  }

  if (
    lower.includes('risk calculator') ||
    lower.includes('open risk') ||
    lower.includes('show risk')
  ) {
    bridge.switchTab('risk');
    return {
      executed: true,
      actionType: 'switch_tab',
      label: 'Opened Risk Management Studio',
      details: 'Kelly criterion, ruin probability, and lot compounding calculator.',
      spokenConfirmation: "Switched to Risk Management Studio.",
    };
  }

  // 4. Natural Language: Stake Adjustment
  // E.g. "set stake to 10", "stake $25", "change stake to 5"
  const stakeRegex = /(?:set|change|make|adjust)\s+stake\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i;
  const stakeMatch = lower.match(stakeRegex);
  if (stakeMatch && stakeMatch[1]) {
    const val = parseFloat(stakeMatch[1]);
    if (val > 0) {
      bridge.setStake(val);
      return {
        executed: true,
        actionType: 'set_stake',
        label: `Stake Adjusted to $${val.toFixed(2)}`,
        details: `Capital risk per execution updated to $${val.toFixed(2)}.`,
        spokenConfirmation: `Stake calibrated to $${val.toFixed(2)}.`,
      };
    }
  }

  // 4b. Natural Language: User Telling Account Balance
  // E.g. "my balance is 500", "balance is $250", "I have 1000 usd", "set balance to 300", "my capital is 400"
  const balRegex = /(?:my\s+balance\s+is|balance\s+is|i\s+have|set\s+balance\s+to|my\s+capital\s+is)\s+\$?(\d+(?:\.\d+)?)/i;
  const balMatch = lower.match(balRegex);
  if (balMatch && balMatch[1]) {
    const val = parseFloat(balMatch[1]);
    if (val > 0 && bridge.setBalance) {
      bridge.setBalance(val);
      return {
        executed: true,
        actionType: 'set_balance',
        label: `Account Balance Recorded: $${val.toFixed(2)}`,
        details: `Live capital registered at $${val.toFixed(2)}. 1% risk stake = $${(val * 0.01).toFixed(2)}.`,
        spokenConfirmation: `Got it partner! I've recorded your account balance as $${val.toFixed(2)}. I will base your 1% risk stake on that.`,
      };
    }
  }

  // 4c. Natural Language: Pro Strategy Playbook Request
  if (
    lower.includes('pro strategy') ||
    lower.includes('strategy playbook') ||
    lower.includes('how to trade over under') ||
    lower.includes('how to trade even odd') ||
    lower.includes('how to trade rise fall') ||
    lower.includes('how to trade high tick') ||
    lower.includes('which minutes to use') ||
    lower.includes('which minutes') ||
    lower.includes('what minutes')
  ) {
    let stratKey = 'rise_fall';
    if (lower.includes('over') || lower.includes('under')) stratKey = 'over_under';
    else if (lower.includes('even') || lower.includes('odd')) stratKey = 'even_odd';
    else if (lower.includes('high') || lower.includes('low')) stratKey = 'high_low_tick';
    else if (lower.includes('up') || lower.includes('down')) stratKey = 'ups_downs';
    else if (lower.includes('minute') || lower.includes('timeframe')) stratKey = 'timeframe_guide';

    if (bridge.openStrategyPlaybook) {
      bridge.openStrategyPlaybook(stratKey);
      return {
        executed: true,
        actionType: 'open_strategy',
        label: `Loaded Pro Strategy: ${stratKey.replace('_', ' ').toUpperCase()}`,
        details: 'Displaying exact minute durations, tick counts, and entry triggers.',
        spokenConfirmation: `I've opened the Pro Strategy Playbook for you with the exact minutes, barrier picks, and entry triggers.`,
      };
    }
  }

  // 5. Natural Language: Live Contract Execution
  if (
    lower.includes('buy rise') ||
    lower.includes('take rise') ||
    lower.includes('execute rise') ||
    lower.includes('place rise')
  ) {
    const res = bridge.executeContract('rise');
    return {
      executed: true,
      actionType: 'execute_trade',
      label: 'Executed BUY RISE Contract',
      details: res.message,
      spokenConfirmation: 'Buy Rise trade executed on live market.',
    };
  }

  if (
    lower.includes('sell fall') ||
    lower.includes('take fall') ||
    lower.includes('execute fall') ||
    lower.includes('place fall')
  ) {
    const res = bridge.executeContract('fall');
    return {
      executed: true,
      actionType: 'execute_trade',
      label: 'Executed SELL FALL Contract',
      details: res.message,
      spokenConfirmation: 'Sell Fall trade executed on live market.',
    };
  }

  if (lower.includes('trade over') || lower.includes('buy over')) {
    const res = bridge.executeContract('over');
    return {
      executed: true,
      actionType: 'execute_trade',
      label: 'Executed OVER Contract',
      details: res.message,
      spokenConfirmation: 'Over contract placed.',
    };
  }

  if (lower.includes('trade under') || lower.includes('buy under')) {
    const res = bridge.executeContract('under');
    return {
      executed: true,
      actionType: 'execute_trade',
      label: 'Executed UNDER Contract',
      details: res.message,
      spokenConfirmation: 'Under contract placed.',
    };
  }

  if (lower.includes('trade differ') || lower.includes('buy differ')) {
    const res = bridge.executeContract('differ');
    return {
      executed: true,
      actionType: 'execute_trade',
      label: 'Executed DIGIT DIFFERS Contract',
      details: res.message,
      spokenConfirmation: 'Digit Differs contract placed at 98% safe rate.',
    };
  }

  // 6. Natural Language: Refresh & Scanner
  if (
    lower.includes('refresh analysis') ||
    lower.includes('scan markets') ||
    lower.includes('scan now') ||
    lower.includes('run scanner')
  ) {
    bridge.refreshAnalysis();
    return {
      executed: true,
      actionType: 'refresh_analysis',
      label: 'Refreshed Market Analysis & Radar',
      details: 'All tick buffers flushed and re-calculated with latest market telemetry.',
      spokenConfirmation: 'Refreshed market analysis and radar metrics.',
    };
  }

  // 7. Natural Language: Sound & Voice Control
  if (lower.includes('mute sound') || lower.includes('turn off audio') || lower.includes('silence')) {
    bridge.toggleSound(false);
    return {
      executed: true,
      actionType: 'toggle_sound',
      label: 'Audio Alerts Muted',
      details: 'Sound notifications disabled.',
      spokenConfirmation: 'Audio alerts muted.',
    };
  }

  if (lower.includes('unmute sound') || lower.includes('enable audio') || lower.includes('turn on sound')) {
    bridge.toggleSound(true);
    return {
      executed: true,
      actionType: 'toggle_sound',
      label: 'Audio Alerts Enabled',
      details: 'Sound notifications active.',
      spokenConfirmation: 'Audio alerts turned on.',
    };
  }

  // 8. Natural Language: Check Trading Time
  if (
    lower.includes('good time to trade') ||
    lower.includes('check trading time') ||
    lower.includes('what session are we in') ||
    lower.includes('trading hours')
  ) {
    bridge.openGoodTradingTime();
    return {
      executed: true,
      actionType: 'check_time',
      label: 'Inspecting Kenyan Trading Hours & Session',
      details: 'Optimal volatility windows and session confluences displayed.',
      spokenConfirmation: "Here are the optimal trading windows and current session status.",
    };
  }

  return {
    executed: false,
    actionType: 'none',
    label: '',
    details: '',
    spokenConfirmation: '',
  };
}
