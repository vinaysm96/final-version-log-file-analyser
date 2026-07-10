
export interface BotInfo {
    name: string;
    type: 'search_engine' | 'seo_tool' | 'monitoring' | 'ai_bot' | 'social' | 'user' | 'unknown';
}

const BOTS: Record<string, BotInfo> = {
    // === Google ===
    'googlebot': { name: 'Googlebot', type: 'search_engine' },
    'googlebot-image': { name: 'Googlebot Image', type: 'search_engine' },
    'googlebot-news': { name: 'Googlebot News', type: 'search_engine' },
    'googlebot-video': { name: 'Googlebot Video', type: 'search_engine' },
    'storebot-google': { name: 'Google StoreBot', type: 'search_engine' },
    'adsbot-google': { name: 'AdsBot Google', type: 'search_engine' },
    'mediapartners-google': { name: 'Google AdSense', type: 'search_engine' },
    'apis-google': { name: 'Google APIs', type: 'search_engine' },
    'google-inspectiontool': { name: 'Google Inspection Tool', type: 'search_engine' },
    'google-read-aloud': { name: 'Google Read Aloud', type: 'search_engine' },
    'google-safety': { name: 'Google Safety', type: 'search_engine' },
    'google-site-verification': { name: 'Google Site Verification', type: 'search_engine' },
    'googleother': { name: 'GoogleOther', type: 'search_engine' },

    // === Bing / Microsoft ===
    'bingbot': { name: 'Bingbot', type: 'search_engine' },
    'bingpreview': { name: 'Bing Preview', type: 'search_engine' },
    'msnbot': { name: 'MSNbot', type: 'search_engine' },
    'adidxbot': { name: 'Bing AdIndex', type: 'search_engine' },
    'petalbot': { name: 'PetalBot (Huawei)', type: 'search_engine' },

    // === Other Search Engines ===
    'yandexbot': { name: 'YandexBot', type: 'search_engine' },
    'yandex': { name: 'Yandex', type: 'search_engine' },
    'baiduspider': { name: 'Baidu Spider', type: 'search_engine' },
    'baiduspider-image': { name: 'Baidu Image Spider', type: 'search_engine' },
    'duckduckbot': { name: 'DuckDuckBot', type: 'search_engine' },
    'duckduckgo-favicons': { name: 'DuckDuckGo Favicons', type: 'search_engine' },
    'applebot': { name: 'Applebot', type: 'search_engine' },
    'ia_archiver': { name: 'Alexa Crawler', type: 'search_engine' },
    'naverbot': { name: 'NaverBot', type: 'search_engine' },
    'yeti': { name: 'Naver Yeti', type: 'search_engine' },
    'seznam': { name: 'Seznam Bot', type: 'search_engine' },
    'sogou': { name: 'Sogou Spider', type: 'search_engine' },
    'exabot': { name: 'Exabot', type: 'search_engine' },
    'mail.ru_bot': { name: 'Mail.ru Bot', type: 'search_engine' },
    'qwantify': { name: 'Qwant Bot', type: 'search_engine' },
    'mojeekbot': { name: 'Mojeek Bot', type: 'search_engine' },
    'ecosia': { name: 'Ecosia Bot', type: 'search_engine' },

    // === AI Bots & Crawlers ===
    'gptbot': { name: 'GPTBot (OpenAI)', type: 'ai_bot' },
    'chatgpt-user': { name: 'ChatGPT User', type: 'ai_bot' },
    'oai-searchbot': { name: 'OAI SearchBot', type: 'ai_bot' },
    'anthropic-ai': { name: 'Anthropic AI', type: 'ai_bot' },
    'claude-web': { name: 'Claude Web', type: 'ai_bot' },
    'claudebot': { name: 'ClaudeBot', type: 'ai_bot' },
    'claude-user': { name: 'Claude User', type: 'ai_bot' },
    'google-extended': { name: 'Google Extended (Gemini)', type: 'ai_bot' },
    'applebot-extended': { name: 'Applebot-Extended', type: 'ai_bot' },
    'perplexitybot': { name: 'PerplexityBot', type: 'ai_bot' },
    'meta-externalagent': { name: 'Meta ExternalAgent', type: 'ai_bot' },
    'amazonbot': { name: 'Amazonbot (Alexa AI)', type: 'ai_bot' },
    'ccbot': { name: 'Common Crawl (CCBot)', type: 'ai_bot' },
    'bytespider': { name: 'ByteSpider (TikTok)', type: 'ai_bot' },
    'omgilibot': { name: 'OmgiliBot', type: 'ai_bot' },
    'diffbot': { name: 'Diffbot', type: 'ai_bot' },
    'cohere-ai': { name: 'Cohere AI', type: 'ai_bot' },
    'ai2bot': { name: 'AI2Bot (AllenAI)', type: 'ai_bot' },
    'youbot': { name: 'YouBot', type: 'ai_bot' },
    'webzio-extended': { name: 'Webzio', type: 'ai_bot' },
    'iaskspider': { name: 'iAsk Spider', type: 'ai_bot' },
    'timpibot': { name: 'Timpi Bot', type: 'ai_bot' },
    'img2dataset': { name: 'img2dataset', type: 'ai_bot' },
    'isearchbot': { name: 'iSearchBot', type: 'ai_bot' },
    'magpie-crawler': { name: 'Magpie Crawler', type: 'ai_bot' },
    'dataforseocrawler': { name: 'DataForSEO Crawler', type: 'ai_bot' },
    'brightbot': { name: 'BrightBot', type: 'ai_bot' },
    'facebookexternalhit': { name: 'Facebook External Hit', type: 'social' },
    'twitterbot': { name: 'Twitterbot', type: 'social' },
    'linkedinbot': { name: 'LinkedInBot', type: 'social' },
    'pinterestbot': { name: 'Pinterest Bot', type: 'social' },
    'slackbot': { name: 'Slackbot', type: 'social' },
    'whatsapp': { name: 'WhatsApp', type: 'social' },
    'telegrambot': { name: 'Telegram Bot', type: 'social' },
    'redditbot': { name: 'RedditBot', type: 'social' },

    // === SEO Tools ===
    'ahrefsbot': { name: 'Ahrefs Bot', type: 'seo_tool' },
    'ahrefs': { name: 'Ahrefs', type: 'seo_tool' },
    'semrushbot': { name: 'SemrushBot', type: 'seo_tool' },
    'semrush': { name: 'Semrush', type: 'seo_tool' },
    'dotbot': { name: 'Moz DotBot', type: 'seo_tool' },
    'mj12bot': { name: 'Majestic MJ12', type: 'seo_tool' },
    'screaming frog': { name: 'Screaming Frog', type: 'seo_tool' },
    'screamingfrog': { name: 'Screaming Frog', type: 'seo_tool' },
    'rogerbot': { name: 'Moz Rogerbot', type: 'seo_tool' },
    'seokicks': { name: 'SEOkicks', type: 'seo_tool' },
    'linkdexbot': { name: 'Linkdex Bot', type: 'seo_tool' },
    'babbar': { name: 'Babbar Bot', type: 'seo_tool' },
    'seostar': { name: 'SEOstar', type: 'seo_tool' },
    'neevabot': { name: 'Neeva Bot', type: 'seo_tool' },
    'sistrix': { name: 'Sistrix Crawler', type: 'seo_tool' },
    'deepcrawl': { name: 'DeepCrawl', type: 'seo_tool' },
    'oncrawl': { name: 'OnCrawl', type: 'seo_tool' },
    'botify': { name: 'Botify', type: 'seo_tool' },
    'majestic': { name: 'Majestic Crawler', type: 'seo_tool' },
    'netcraft': { name: 'Netcraft Survey Bot', type: 'seo_tool' },
    'serpstatbot': { name: 'SerpstatBot', type: 'seo_tool' },
    'seobilitybot': { name: 'Seobility Bot', type: 'seo_tool' },

    // === Monitoring / Infrastructure ===
    'apif-google': { name: 'APIF Google', type: 'monitoring' },
    'pingdom': { name: 'Pingdom', type: 'monitoring' },
    'uptimerobot': { name: 'UptimeRobot', type: 'monitoring' },
    'statuscake': { name: 'StatusCake', type: 'monitoring' },
    'newrelic': { name: 'New Relic', type: 'monitoring' },
    'datadog': { name: 'Datadog', type: 'monitoring' },
    'zabbix': { name: 'Zabbix', type: 'monitoring' },
    'nagios': { name: 'Nagios', type: 'monitoring' },
    'curl': { name: 'cURL', type: 'monitoring' },
    'wget': { name: 'Wget', type: 'monitoring' },
    'python-requests': { name: 'Python Requests', type: 'monitoring' },
    'python-urllib': { name: 'Python urllib', type: 'monitoring' },
    'go-http-client': { name: 'Go HTTP Client', type: 'monitoring' },
    'java': { name: 'Java HTTP', type: 'monitoring' },
    'http_simple': { name: 'HTTP Simple', type: 'monitoring' },
    'libwww-perl': { name: 'libwww Perl', type: 'monitoring' },
    'guzzlehttp': { name: 'Guzzle HTTP', type: 'monitoring' },
};

// Pre-compute sorted keys by length descending for longest-match priority
const botKeys = Object.keys(BOTS).sort((a, b) => b.length - a.length);

// Escape special regex chars and build combined pattern
const escapedKeys = botKeys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
const BOT_REGEX = new RegExp(`(${escapedKeys.join('|')})`, 'i');
const FALLBACK_BOT_REGEX = /(bot|spider|crawl|scan|fetch|scraper|checker|monitor|watchdog|validator|verif)/i;

export const detectBot = (userAgent: string): BotInfo => {
    if (!userAgent) return { name: 'User', type: 'user' };

    const ua = userAgent.toLowerCase();

    const match = ua.match(BOT_REGEX);
    if (match) {
        const found = BOTS[match[1].toLowerCase()];
        if (found) return found;
    }

    if (FALLBACK_BOT_REGEX.test(ua)) {
        return { name: 'Unknown Bot', type: 'unknown' };
    }

    return { name: 'User', type: 'user' };
};
