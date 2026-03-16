import pino from 'pino';
import { loadConfig } from '../config/loader.js';

let _logger: pino.Logger | null = null;

export function getLogger(name?: string): pino.Logger {
  if (!_logger) {
    const cfg = loadConfig();
    const level = cfg.logging?.level ?? 'info';
    const format = cfg.logging?.format ?? 'pretty';

    _logger = pino({
      level,
      ...(format === 'pretty'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    });
  }

  return name ? _logger.child({ name }) : _logger;
}
