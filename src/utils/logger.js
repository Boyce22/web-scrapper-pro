import fs from 'fs';
import path from 'path';
import bunyan from 'bunyan';

const projectRoot = process.cwd();

const logsDir = path.join(projectRoot, 'logs');

if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logger = bunyan.createLogger({
  name: 'scrapper',
  level: 'info',
  streams: [
    { stream: process.stdout, level: 'info' },
    {
      type: 'rotating-file',
      path: path.join(logsDir, 'scrapper.log'),
      level: 'debug',
      period: '1d',
      count: 3,
    },
  ],
});

export default logger;
