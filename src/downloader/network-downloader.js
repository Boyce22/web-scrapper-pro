import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class NetworkImageDownloader {
  constructor() {
    this.networkImages = new Map();
    this.stats = {
      totalCaptured: 0,
      totalSaved: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  setupNetworkMonitoring(page) {
    this.stats.startTime = Date.now();
    
    page.on('response', async (response) => {
      try {
        const request = response.request();
        const resourceType = request.resourceType();
        const headers = response.headers() || {};
        const contentType = (headers['content-type'] || '').toLowerCase();

        if (this.isImageResponse(resourceType, contentType)) {
          await this.captureImage(response);
        }
      } catch (error) {
        logger.debug('Erro ao processar response de rede', { 
          error: error.message,
          url: response.url() 
        });
      }
    });

    logger.debug('Monitoramento de rede configurado');
  }

  isImageResponse(resourceType, contentType) {
    return resourceType === 'image' || contentType.startsWith('image/');
  }

  async captureImage(response) {
    try {
      const buffer = await response.buffer();
      const url = new URL(response.url());
      const filename = this.generateFilename(url, response);
      
      this.networkImages.set(filename, {
        buffer,
        url: response.url(),
        timestamp: Date.now(),
        size: buffer.length
      });

      this.stats.totalCaptured++;
      
      logger.debug('Imagem capturada via network', { 
        filename, 
        url: response.url(),
        size: this.formatFileSize(buffer.length)
      });

    } catch (error) {
      logger.debug('Falha ao capturar imagem da rede', { 
        error: error.message,
        url: response.url() 
      });
    }
  }

  generateFilename(url, response) {
    let filename = path.basename(url.pathname);
    
    // Se não houver extensão ou nome válido, criar um
    if (!filename || filename === '/' || !path.extname(filename)) {
      const extension = this.getFileExtension(response);
      filename = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`;
    }

    return this.sanitizeFilename(filename);
  }

  getFileExtension(response) {
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff'
    };

    return extensionMap[contentType] || '.jpg';
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 255);
  }

  createSafeFolderName(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      let pathname = urlObj.pathname;
      
      // Remover barras e caracteres inválidos
      pathname = pathname.replace(/^\/+|\/+$/g, '');
      pathname = pathname.replace(/[<>:"/\\|?*]/g, '-');
      
      let folderName = `${hostname}${pathname ? '-' + pathname : ''}`;
      
      return folderName
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100) || `network-images-${Date.now()}`;
        
    } catch (error) {
      logger.warn('Erro ao criar nome de pasta da URL, usando fallback', { 
        url, 
        error: error.message 
      });
      return `network-images-${Date.now()}`;
    }
  }

  async saveAllImages(targetUrl, baseOutputDir = './downloads') {
    const folderName = this.createSafeFolderName(targetUrl);
    const outputDir = path.join(baseOutputDir, folderName);
    
    logger.debug('Preparando diretório de output', { path: outputDir });
    fs.mkdirSync(outputDir, { recursive: true });

    if (this.networkImages.size === 0) {
      logger.warn('Nenhuma imagem disponível para salvamento');
      return this.stats;
    }

    logger.info('Iniciando salvamento de imagens capturadas', { 
      total: this.networkImages.size,
      outputDir 
    });

    const results = await this.saveImagesToDisk(outputDir);
    this.stats.endTime = Date.now();
    
    this.printFinalStats(results);
    return this.stats;
  }

  async saveImagesToDisk(outputDir) {
    const results = {
      success: 0,
      failed: 0,
      duplicates: 0
    };

    const writtenFiles = new Set();

    for (const [filename, imageData] of this.networkImages.entries()) {
      try {
        const finalFilename = this.ensureUniqueFilename(filename, writtenFiles);
        const filePath = path.join(outputDir, finalFilename);

        if (fs.existsSync(filePath)) {
          results.duplicates++;
          logger.debug('Arquivo já existe, pulando', { filePath });
          continue;
        }

        fs.writeFileSync(filePath, imageData.buffer);
        writtenFiles.add(finalFilename);
        results.success++;
        
        logger.debug('Imagem salva com sucesso', { 
          filename: finalFilename,
          size: this.formatFileSize(imageData.buffer.length),
          path: filePath 
        });

      } catch (error) {
        results.failed++;
        logger.error('Falha ao salvar imagem', { 
          filename, 
          error: error.message 
        });
      }
    }

    this.stats.totalSaved = results.success;
    this.stats.totalErrors = results.failed;

    return results;
  }

  ensureUniqueFilename(filename, writtenFiles) {
    if (!writtenFiles.has(filename)) {
      return filename;
    }

    const parsed = path.parse(filename);
    let counter = 1;
    let newFilename = '';

    do {
      newFilename = `${parsed.name}-${counter}${parsed.ext}`;
      counter++;
    } while (writtenFiles.has(newFilename) && counter < 1000);

    return newFilename;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  printFinalStats(results) {
    const totalTime = (this.stats.endTime - this.stats.startTime) / 1000;
    
    logger.info('Relatório final - Network Downloader', {
      capturadas: this.stats.totalCaptured,
      salvas: this.stats.totalSaved,
      erros: this.stats.totalErrors,
      duplicatas: results.duplicates,
      tempoTotal: `${totalTime.toFixed(2)}s`,
      eficiencia: `${((this.stats.totalSaved / this.stats.totalCaptured) * 100).toFixed(1)}%`
    });
  }

  getStats() {
    return {
      ...this.stats,
      currentCount: this.networkImages.size
    };
  }

  clear() {
    this.networkImages.clear();
    this.stats = {
      totalCaptured: 0,
      totalSaved: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null
    };
  }
}