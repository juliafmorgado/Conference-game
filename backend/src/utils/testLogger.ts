/**
 * Simple logger for testing
 */

export const testLogger = {
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(message, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.debug(message, ...args);
    }
  }
};