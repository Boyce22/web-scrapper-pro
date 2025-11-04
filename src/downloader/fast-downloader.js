import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import axios from 'axios';
import https from 'https';
import http from 'http';

import logger from '../utils/logger.js';
import { safeFilename, ensureDir, sanitizeFolderName } from '../utils/common.js';

export class FastImageDownloader {
  constructor(maxConcurrent = 50) {
    this.maxConcurrent = maxConcurrent;
    this.limit = pLimit(maxConcurrent);
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      startTime: null,
      endTime: null,
    };
    this.downloaded = new Set();

    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: maxConcurrent * 2,
      maxFreeSockets: maxConcurrent,
      timeout: 10000,
    });

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: maxConcurrent * 2,
      maxFreeSockets: maxConcurrent,
      rejectUnauthorized: false,
      timeout: 10000,
    });

    this.client = axios.create({
      timeout: 15000,
      maxRedirects: 5,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*',
        'Accept-Encoding': 'identity',
      },
    });
  }

  async downloadAll(urls, outputDir, targetUrl) {
    this.stats.startTime = Date.now();
    this.stats.total = urls.length;

    const folderName = sanitizeFolderName(targetUrl);
    const finalDir = path.join(outputDir, folderName);
    await ensureDir(finalDir);

    logger.info(`🚀 Iniciando download com ${this.maxConcurrent} conexões concorrentes`);
    logger.info(`📊 Total de imagens: ${urls.length}`);

    const promises = urls.map((url, index) => this.limit(() => this.downloadSingle(url, finalDir, index)));

    const results = await Promise.allSettled(promises);

    this.stats.endTime = Date.now();
    this.printFinalStats();

    return this.stats;
  }

  async downloadSingle(url, outputDir, index) {
    const fileName = safeFilename(url, index);
    const filePath = path.join(outputDir, fileName);

    if (fs.existsSync(filePath)) {
      this.updateStats('skipped');
      return { type: 'skipped', url, filePath };
    }

    try {
      const response = await this.client.get(url, {
        responseType: 'stream',
        validateStatus: (status) => status === 200,
      });

      const writer = fs.createWriteStream(filePath);

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error = null;

        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);
        });

        writer.on('close', () => {
          if (!error) resolve();
        });
      });

      this.updateStats('success');
      return { type: 'success', url, filePath };
    } catch (error) {
      try {
        fs.unlinkSync(filePath);
      } catch {}

      this.updateStats('failed');
      logger.warn({ url, error: error.message }, 'Falha no download');
      return { type: 'error', url, error: error.message };
    }
  }

  updateStats(type) {
    this.stats[type]++;

    const totalProcessed = this.stats.success + this.stats.failed + this.stats.skipped;

    if (totalProcessed % 10 === 0 || totalProcessed === this.stats.total) {
      const percentage = ((totalProcessed / this.stats.total) * 100).toFixed(1);
      const speed = this.calculateSpeed();

      logger.info(
        { percentage, success: this.stats.success, failed: this.stats.failed, skipped: this.stats.skipped, speed },
        'Progresso'
      );
    }
  }

  calculateSpeed() {
    const elapsedSeconds = (Date.now() - this.stats.startTime) / 1000;
    if (elapsedSeconds === 0) return '0/s';

    const processed = this.stats.success + this.stats.failed;
    return `${(processed / elapsedSeconds).toFixed(1)} img/s`;
  }

  printFinalStats() {
    const totalTime = (this.stats.endTime - this.stats.startTime) / 1000;
    const speed = this.stats.success / totalTime;

    logger.info('📊 RELATÓRIO FINAL', {
      success: this.stats.success,
      failed: this.stats.failed,
      skipped: this.stats.skipped,
      totalTime: `${totalTime.toFixed(2)}s`,
      speed: `${speed.toFixed(2)} img/s`,
      concurrent: this.maxConcurrent,
    });
  }
}
