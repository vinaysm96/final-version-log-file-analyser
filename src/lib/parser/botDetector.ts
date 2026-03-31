
export interface BotInfo {
    name: string;
    type: 'search_engine' | 'seo_tool' | 'monitoring' | 'ai_bot' | 'user' | 'unknown';
}

const BOTS: Record<string, BotInfo> = {
    // Search Engines
    'googlebot': { name: 'Googlebot', type: 'search_engine' },
    'googlebot-image': { name: 'Googlebot Image', type: 'search_engine' },
    'googlebot-news': { name: 'Googlebot News', type: 'search_engine' },
    'googlebot-video': { name: 'Googlebot Video', type: 'search_engine' },
    'storebot-google': { name: 'Google StoreBot', type: 'search_engine' },
    'adsbot-google': { name: 'AdsBot Google', type: 'search_engine' },
    'bingbot': { name: 'Bingbot', type: 'search_engine' },
    'bingpreview': { name: 'Bing Preview', type: 'search_engine' },
    'yandex': { name: 'Yandex', type: 'search_engine' },
    'yandexbot': { name: 'YandexBot', type: 'search_engine' },
    'baiduspider': { name: 'Baidu', type: 'search_engine' },
    'duckduckbot': { name: 'DuckDuckGo', type: 'search_engine' },
    'petalbot': { name: 'PetalBot', type: 'search_engine' },
    
    // AI Bots & Crawlers
    'gptbot': { name: 'GPTBot (OpenAI)', type: 'ai_bot' },
    'chatgpt-user': { name: 'ChatGPT-User', type: 'ai_bot' },
    'anthropic-ai': { name: 'Anthropic AI', type: 'ai_bot' },
    'claude-web': { name: 'Claude-Web', type: 'ai_bot' },
    'claudebot': { name: 'ClaudeBot', type: 'ai_bot' },
    'google-extended': { name: 'Google-Extended (Bard/Gemini)', type: 'ai_bot' },
    'applebot-extended': { name: 'Applebot-Extended', type: 'ai_bot' },
    'perplexitybot': { name: 'PerplexityBot', type: 'ai_bot' },
    'meta-externalagent': { name: 'Meta-ExternalAgent', type: 'ai_bot' },
    'amazonbot': { name: 'Amazonbot', type: 'ai_bot' },
    'ccbot': { name: 'Common Crawl (CCBot)', type: 'ai_bot' },
    'bytespider': { name: 'ByteSpider (ByteDance)', type: 'ai_bot' },
    'omgilibot': { name: 'OmgiliBot', type: 'ai_bot' },
    'diffbot': { name: 'Diffbot', type: 'ai_bot' },
    'cohere-ai': { name: 'Cohere AI', type: 'ai_bot' },
    
    // SEO Tools
    'ahrefsbot': { name: 'Ahrefs', type: 'seo_tool' },
    'semrushbot': { name: 'Semrush', type: 'seo_tool' },
    'dotbot': { name: 'Moz Dotbot', type: 'seo_tool' },
    'mj12bot': { name: 'Majestic', type: 'seo_tool' },
    'screaming frog': { name: 'Screaming Frog', type: 'seo_tool' },
    
    // Monitoring
    'apif-google': { name: 'APIF Google', type: 'monitoring' },
};

const botKeys = Object.keys(BOTS);
const BOT_REGEX = new RegExp(`(${botKeys.join('|')})`, 'i');
const FALLBACK_BOT_REGEX = /(bot|spider|crawl)/i;

export const detectBot = (userAgent: string): BotInfo => {
    if (!userAgent) return { name: 'User', type: 'user' };

    const match = userAgent.match(BOT_REGEX);
    if (match) {
        return BOTS[match[1].toLowerCase()];
    }

    if (FALLBACK_BOT_REGEX.test(userAgent)) {
        return { name: 'Unknown Bot', type: 'unknown' };
    }

    return { name: 'User', type: 'user' };
};
