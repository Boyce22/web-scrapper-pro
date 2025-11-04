# WebScrapper Pro

**Web Image Scraper & Bulk Downloader**

Ferramenta CLI profissional para extração e download em massa de imagens de páginas web. Combina scraping avançado com Puppeteer e downloads paralelos otimizados com connection pooling.

## 🚀 Características

- **Dual Approach**: Modo automático e manual para diferentes tipos de proteção
- **High Performance**: Downloads concorrentes com controle de paralelismo
- **Cloudflare Support**: Navegação manual para bypass de proteções
- **Network Monitoring**: Captura de imagens em tempo real via traffic analysis
- **Professional Logging**: Sistema de logs estruturado para debugging e monitoramento

## 📦 Instalação

```bash
npm install
```

## 🛠 Uso

```bash
npm start
```

### Fluxo de Interação

1. **Selecionar Abordagem**:

   - `Automática`: Para sites sem proteção (scraping tradicional)
   - `Manual`: Para Cloudflare e sites com proteção avançada

2. **Configurar Parâmetros**:

   - URL alvo
   - Modo headless (com/sem interface)
   - Número de downloads simultâneos

3. **Execução**:
   - Modo automático: Extrai e baixa imagens automaticamente
   - Modo manual: Permite interação humana para resolver CAPTCHAs

## 🏗 Arquitetura

### Estrutura de Projeto

```
src/
├── downloader/
│   ├── fast-downloader.js      # Download concorrente de URLs
│   ├── network-downloader.js   # Captura via network monitoring
│   └── image-extractor.js      # Extração de URLs de imagens
├── utils/
│   ├── logger.js               # Sistema de logging
│   ├── config.js               # Configurações
│   ├── scroll.js               # Utilidades de scroll
│   └── common.js               # Funções utilitárias
└── scraper.js                  # Classe principal
```

### Componentes Principais

#### WebScraper

Classe principal que orquestra o processo de scraping

#### FastImageDownloader

- Downloads concorrentes com `p-limit`
- Controle de rate limiting
- Retry automático e tratamento de erros
- Estatísticas de performance

#### NetworkImageDownloader

- Monitoramento de responses HTTP em tempo real
- Captura de imagens via network traffic
- Geração de nomes de arquivo únicos
- Salvamento em lote

## ⚙️ Configuração

### Variáveis de Ambiente

```javascript
// utils/config.js
export const CONFIG = {
  OUTPUT_DIR: './downloads',
  TIMEOUT: 30000,
  MAX_CONCURRENT: 100,
  REQUEST_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
};
```

### Parâmetros de Performance

- **Concurrent Downloads**: 1-200 (default: CPU cores × 25)
- **Timeout**: 30 segundos
- **Retry Attempts**: Automático via Axios
- **Keep-Alive**: Conexões HTTP reutilizáveis

## 📊 Logging

Sistema estruturado com múltiplos níveis:

```javascript
logger.info('Iniciando scraping', { url, approach });
logger.debug('Configurando interceptação');
logger.warn('Nenhuma imagem encontrada');
logger.error('Falha no processo', { error: message });
```

## 🛡 Tratamento de Erros

- **Unhandled Rejections**: Captura e log de promises não tratadas
- **Uncaught Exceptions**: Tratamento global de exceções
- **Network Errors**: Retry automático e fallback
- **File System**: Validação de permissões e espaço

## 🚨 Casos de Uso

### Sites com Cloudflare

```
Approach: Manual
Headless: false
Interação: Resolver CAPTCHA manualmente
```

### Sites Sem Proteção

```
Approach: Automática
Headless: true
Downloads: 50-100 concorrentes
```

### Performance Crítica

```
Approach: Automática
Headless: true
Downloads: 200 concorrentes
```

## 🔧 Desenvolvimento

### Adicionar Novo Extrator

```javascript
// downloader/custom-extractor.js
export class CustomImageExtractor {
  async extract(page, url) {
    // Implementar lógica customizada
    return imageUrls;
  }
}
```

### Extender Logging

```javascript
import logger from './utils/logger.js';

logger.addContext({ module: 'custom-module' });
```

## 📈 Performance

- **Velocidade**: Até 200 downloads simultâneos
- **Memória**: Otimizado com stream processing
- **Rede**: Connection pooling e keep-alive
- **Disco**: Escrita assíncrona e batch operations

## 🤝 Contribuição

1. Fork do projeto
2. Branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## ⚠️ Disclaimer

Esta ferramenta é destinada para:

- Aprendizado e pesquisa
- Download de conteúdo público
- Automação de workflows legítimos

Respeite:

- Termos de serviço de websites
- Direitos autorais
- Rate limiting e politeness policies

## 📄 Licença

Distribuído sob licença MIT. Veja `LICENSE` para mais informações.

---

**Nota**: Sempre verifique a legalidade do scraping em cada website antes de usar esta ferramenta.
