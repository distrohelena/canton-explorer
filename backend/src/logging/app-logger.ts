import { createLogger, format, transports } from 'winston';

export const appLogger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(
      ({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`,
    ),
  ),
  transports: [new transports.Console()],
});

export function truncateForLog(value: string, maxLength = 160): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength)}…`
    : collapsed;
}
