import puppeteer from 'puppeteer';
import inquirer from 'inquirer';
import os from 'os';

import logger from './utils/logger.js';
import { CONFIG } from './utils/config.js';
import { scrollToEnd } from './utils/scroll.js';

import { extractImageUrls } from './downloader/image-extractor.js';
import { FastImageDownloader } from './downloader/fast-downloader.js';
import { NetworkImageDownloader } from './downloader/network-downloader.js';

class WebScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.networkDownloader = null;
  }

  async initialize() {
    console.clear();
    logger.info('Inicializando Web Scraper');
  }

  async promptUser() {
    const { approach } = await inquirer.prompt([
      {
        type: 'list',
        name: 'approach',
        message: 'Selecione a abordagem de scraping:',
        choices: [
          { name: 'Manual (recomendado para sites com Cloudflare)', value: 'manual' },
          { name: 'Automática (para sites sem proteção)', value: 'auto' },
        ],
      },
    ]);

    const { targetUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'targetUrl',
        message: 'Informe a URL para extração de imagens:',
        validate: (input) => {
          const trimmed = input.trim();
          return trimmed.startsWith('http') || 'URL deve iniciar com http/https';
        },
      },
    ]);

    const headlessDefault = approach === 'auto';

    const { headless } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'headless',
        message: 'Executar em modo headless?',
        default: headlessDefault,
      },
    ]);

    const { concurrentDownloads } = await inquirer.prompt([
      {
        type: 'number',
        name: 'concurrentDownloads',
        message: 'Número de downloads simultâneos:',
        default: Math.min(100, os.cpus().length * 25),
        validate: (input) => (input > 0 && input <= 200) || 'Informe um valor entre 1 e 200',
      },
    ]);

    return {
      approach,
      targetUrl: targetUrl.trim(),
      headless,
      concurrentDownloads,
    };
  }

  async launchBrowser(headless, approach) {
    const browserArgs = ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'];

    if (approach === 'manual') {
      browserArgs.push('--disable-blink-features=AutomationControlled');
    }

    logger.info('Iniciando navegador', {
      headless,
      approach,
      args: browserArgs.length,
    });

    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: null,
      args: browserArgs,
    });

    this.page = await this.browser.newPage();

    logger.debug('Navegador inicializado com sucesso');
  }

  async scrape({ targetUrl, headless, concurrentDownloads, approach }) {
    try {
      await this.launchBrowser(headless, approach);

      if (approach === 'auto') {
        await this.automaticScraping({ targetUrl, headless, concurrentDownloads });
      } else {
        await this.manualScraping({ targetUrl, headless });
      }

      logger.info('Processo de scraping concluído');
    } catch (error) {
      logger.error('Falha no processo de scraping', {
        error: error.message,
        url: targetUrl,
      });
      throw error;
    } finally {
      await this.cleanup(headless);
    }
  }

  async automaticScraping({ targetUrl, headless, concurrentDownloads }) {
    logger.info('Iniciando scraping automático', { url: targetUrl });

    await this.configureRequestInterception();
    await this.navigateToUrl(targetUrl);

    if (!headless) {
      await this.waitForUserInteraction('Interaja com a página e pressione ENTER para continuar');
    }

    logger.debug('Otimizando carregamento de conteúdo');
    await scrollToEnd(this.page, 100);

    logger.debug('Extraindo URLs de imagens');
    const imageUrls = await extractImageUrls(this.page, targetUrl);

    if (imageUrls.length === 0) {
      logger.warn('Nenhuma imagem encontrada na página');
      return;
    }

    logger.info('URLs de imagens extraídas', {
      count: imageUrls.length,
      url: targetUrl,
    });

    const downloader = new FastImageDownloader(concurrentDownloads);
    await downloader.downloadAll(imageUrls, CONFIG.OUTPUT_DIR, targetUrl);
  }

  async manualScraping({ targetUrl, headless }) {
    logger.info('Iniciando scraping manual', { url: targetUrl });

    // Inicializar o network downloader
    this.networkDownloader = new NetworkImageDownloader();
    await this.setupNetworkMonitoring();
    await this.configureRequestInterception();

    logger.debug('Navegando para URL alvo');
    await this.navigateToUrl(targetUrl);

    if (!headless) {
      await this.waitForUserInteraction(
        'Interaja com a página (resolva CAPTCHAs se necessário) e pressione ENTER para iniciar download'
      );
    } else {
      logger.debug('Executando scroll para carregamento de conteúdo em modo headless');
      await scrollToEnd(this.page, 100);
    }

    await this.networkDownloader.saveAllImages(targetUrl, CONFIG.OUTPUT_DIR);
  }

  async setupNetworkMonitoring() {
    this.networkDownloader.setupNetworkMonitoring(this.page);
    logger.debug('Monitoramento de rede inicializado');
  }

  async configureRequestInterception() {
    await this.page.setRequestInterception(true);

    this.page.on('request', (request) => {
      const blockedResourceTypes = ['font', 'media', 'websocket', 'manifest'];

      if (blockedResourceTypes.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    logger.debug('Interceptação de requests configurada');
  }

  async navigateToUrl(url) {
    logger.debug('Navegando para URL', { url });

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    logger.debug('Navegação concluída', { url });
  }

  async waitForUserInteraction(message) {
    logger.info('Aguardando interação do usuário');

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message,
      },
    ]);

    logger.debug('Interação do usuário confirmada');
  }

  async cleanup(headless) {
    if (this.browser) {
      if (!headless) {
        logger.info('Aguardando confirmação para fechar navegador');

        await inquirer.prompt([
          {
            type: 'confirm',
            name: 'close',
            message: 'Fechar navegador?',
            default: true,
          },
        ]);
      }

      logger.debug('Fechando navegador');
      await this.browser.close();
      logger.info('Navegador fechado');
    }

    if (this.networkDownloader) {
      this.networkDownloader.clear();
      this.networkDownloader = null;
    }
  }
}

async function main() {
  const scraper = new WebScraper();

  try {
    await scraper.initialize();
    const userInput = await scraper.promptUser();
    await scraper.scrape(userInput);

    logger.info('Web Scraper finalizado com sucesso');
  } catch (error) {
    logger.error('Falha crítica no Web Scraper', { error: error.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejeição não tratada de Promise', {
    reason: reason?.message || reason,
    promise,
  });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada', { error: error.message });
  process.exit(1);
});

export { WebScraper };

main();
