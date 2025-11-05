/**
 * Logger utility for structured logging
 */

export interface Logger {
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export function createLogger(level: 'error' | 'warn' | 'info' | 'debug' = 'info'): Logger {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const currentLevel = levels[level];

  const formatMessage = (level: string, message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  };

  return {
    error: (message: string, ...args: any[]) => {
      if (currentLevel >= 0) {
        console.error(formatMessage('error', message, ...args));
      }
    },
    warn: (message: string, ...args: any[]) => {
      if (currentLevel >= 1) {
        console.warn(formatMessage('warn', message, ...args));
      }
    },
    info: (message: string, ...args: any[]) => {
      if (currentLevel >= 2) {
        console.log(formatMessage('info', message, ...args));
      }
    },
    debug: (message: string, ...args: any[]) => {
      if (currentLevel >= 3) {
        console.log(formatMessage('debug', message, ...args));
      }
    }
  };
}