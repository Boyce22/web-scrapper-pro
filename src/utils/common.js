import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { URL } from 'url';
import { CONFIG } from './config.js';
import logger from './logger.js';

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export function createSafeFolderName(url) {
  try {
    const decodedUrl = decodeURIComponent(url);
    const urlObj = new URL(decodedUrl);

    return `${urlObj.hostname}${urlObj.pathname}`
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/^\/+|\/+$/g, '')
      .replace(/-+/g, '-')
      .substring(0, 100);
      
  } catch (error) {
    return `scraped-images-${Date.now()}`;
  }
}

export function sanitizeFolderName(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .slice(0, 100);
}

export async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export function safeFilename(url) {
  try {
    const base = path.basename(new URL(url).pathname);
    return base.replace(/[^a-zA-Z0-9.\-_]/g, '') || `img-${Date.now()}.jpg`;
  } catch {
    return `img-${Date.now()}.jpg`;
  }
}

export function downloadFile(url, dest, retries = CONFIG.RETRIES) {
  const protocol = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const req = protocol.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(new URL(res.headers.location, url).href, dest, retries));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    req.on('error', async (err) => {
      if (retries > 0) {
        logger.warn('Erro no download, tentando novamente...', { url, retries });
        await sleep(CONFIG.RETRY_DELAY);
        return resolve(downloadFile(url, dest, retries - 1));
      }
      reject(err);
    });

    req.setTimeout(CONFIG.TIMEOUT, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}
