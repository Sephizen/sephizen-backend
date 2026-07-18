import { env } from '../config/env.js';

const levels = ['error', 'warn', 'info', 'debug'];
const levelIndex = levels.indexOf(env.LOG_LEVEL);

function shouldLog(level) {
  return levels.indexOf(level) <= levelIndex;
}

function serialize(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  return value;
}

function write(level, payload) {
  if (!shouldLog(level)) return;
  const line = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...serialize(payload)
  });
  console.log(line);
}

export const logger = {
  error: (payload) => write('error', payload),
  warn: (payload) => write('warn', payload),
  info: (payload) => write('info', payload),
  debug: (payload) => write('debug', payload)
};
