import { detectBot } from './botDetector';

export interface LogEntry {
    ip: string;
    timestamp: string; // ISO string
    method: string;
    url: string;
    status: number;
    size: number;
    referrer: string;
    user_agent: string;
    bot_name: string;
    bot_type: string;
    response_time?: number;
    file_name?: string;
}


// 1. Permissive Standard Log Format (Nginx/Apache Combined & Common)
// Fast regex: strictly bounds fields to prevent catastrophic backtracking.
const STANDARD_LOG_REGEX = /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\d+|-)(?:\s+"([^"]*)"\s+"?([^"]*))?/;

export const parseDateApache = (dateStr: string): string => {
    try {
        const parts = dateStr.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+) ([\+\-]\d+)/);
        if (!parts) return new Date(dateStr).toISOString(); // Try direct parse first
        const [_, day, month, year, h, m, s, zone] = parts;
        const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12', jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        return new Date(`${year}-${months[month.substring(0,3).charAt(0).toUpperCase() + month.substring(1,3).toLowerCase()] || '01'}-${day}T${h}:${m}:${s}${zone.slice(0, 3)}:${zone.slice(3)}`).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
};

// Heuristic Type Helpers
const isIP = (s: string) => /^(\d{1,3}\.){3}\d{1,3}|([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/.test(s);
const isMethod = (s: string) => ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'].includes(s.toUpperCase().replace(/"/g, ''));
const isStatus = (s: string) => /^[1-5]\d{2}$/.test(s);
const isDate = (s: string) => /\[.+\]/.test(s) || /\d{4}-\d{2}-\d{2}/.test(s) || /\d{2}\/\w{3}\/\d{4}/.test(s);

const tryParseJSON = (line: string, fileName?: string): LogEntry | null => {
    try {
        if (!line.trim().startsWith('{')) return null;
        const json = JSON.parse(line);

        // Flatten simple nested structures common in logs (e.g. req.url -> req_url)
        const find = (obj: any, keys: string[]): any => {
            for (const k of keys) {
                if (obj[k]) return obj[k];
                if (k.includes('.')) {
                    const [p, c] = k.split('.');
                    if (obj[p] && obj[p][c]) return obj[p][c];
                }
            }
            return null;
        };

        const ip = find(json, ['ip', 'remoteAddress', 'remote_addr', 'client_ip', 'req.ip']) || '0.0.0.0';
        const method = find(json, ['method', 'req.method', 'httpMethod']) || 'GET';
        const url = find(json, ['url', 'req.url', 'uri', 'path', 'request_uri']) || '/';
        const status = find(json, ['status', 'statusCode', 'res.statusCode', 'status_code']) || 100;
        const size = find(json, ['size', 'res.size', 'bytes', 'content_length', 'body_bytes_sent']) || 0;
        const referrer = find(json, ['referrer', 'referer', 'req.referrer', 'req.headers.referer']) || '';
        const ua = find(json, ['userAgent', 'user_agent', 'req.headers.user-agent', 'http_user_agent']) || 'Unknown';

        let timestamp = new Date().toISOString();
        const rawTime = find(json, ['time', 'timestamp', '@timestamp', 'date', 'isoTime']);
        if (rawTime) {
            try { timestamp = new Date(rawTime).toISOString(); } catch (e) { }
        }

        const botInfo = detectBot(ua);

        // Filter out static assets for user traffic, and optionally filter all user traffic to save memory
        const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|mp3|pdf|zip|tar|gz|map)$/i.test(url.split('?')[0]);
        const skipUserAll = typeof localStorage !== 'undefined' && localStorage.getItem('skip_user_traffic') !== 'false';
        if (botInfo.type === 'user' && (skipUserAll || isStaticAsset)) {
            return null;
        }

        return {
            ip: String(ip),
            timestamp,
            method: String(method).toUpperCase(),
            url: String(url),
            status: Number(status) || 0,
            size: Number(size) || 0,
            referrer: String(referrer),
            user_agent: String(ua),
            bot_name: botInfo.name,
            bot_type: botInfo.type,
            file_name: fileName || 'default'
        };

    } catch (e) {
        return null; // Not JSON
    }
}

export const parseLine = (line: string, fileName?: string): LogEntry | null => {
    if (line.length === 0 || line.charCodeAt(0) === 35) return null; // '#' is 35

    // 0. Try JSON
    if (line[0] === '{') {
        const jsonEntry = tryParseJSON(line, fileName);
        if (jsonEntry) {
            if (jsonEntry.url !== '/' || jsonEntry.method !== 'GET') {
                return jsonEntry;
            }
        }
    }

    // 1. Try Standard Permissive Regex (Nginx/Apache)
    const match = line.match(STANDARD_LOG_REGEX);
    if (match) {
        const [_, ip, _ident, _auth, dateRaw, requestStr, status, size, referrer, userAgent] = match;
        
        let method = 'GET';
        let url = '/';
        const reqParts = requestStr.trim().split(/\s+/);
        if (reqParts.length >= 2) {
            method = reqParts[0];
            url = reqParts[1];
        } else if (reqParts.length === 1) {
            url = reqParts[0];
        }

        let uaFinal = userAgent || 'Unknown';
        // Remove trailing or leading quotes that were captured loosely
        uaFinal = uaFinal.replace(/^"/, '').replace(/"$/, '');
        const botInfo = detectBot(uaFinal);
        
        // Filter out static assets for user traffic, and optionally filter all user traffic to save memory
        const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|mp3|pdf|zip|tar|gz|map)$/i.test(url.split('?')[0]);
        const skipUserAll = typeof localStorage !== 'undefined' && localStorage.getItem('skip_user_traffic') !== 'false';
        if (botInfo.type === 'user' && (skipUserAll || isStaticAsset)) {
            return null;
        }
        
        return {
            ip,
            timestamp: parseDateApache(dateRaw),
            method,
            url,
            status: parseInt(status, 10),
            size: size === '-' ? 0 : parseInt(size, 10),
            referrer: (referrer || '').replace(/^"/, '').replace(/"$/, ''),
            user_agent: uaFinal,
            bot_name: botInfo.name,
            bot_type: botInfo.type,
            file_name: fileName || 'default'
        };
    }

    // 2. Heuristic Column Detection (The "Magic" Parser fallback)
    // Split by spaces, but respect quotes. 
    // Splitting by spaces is often enough for IP/Method/Status even if quotes break URL/UA.
    const parts = line.split(/\s+/);

    // We map indices to types
    let ip = '0.0.0.0';
    let timestamp = '';
    let method = 'GET';
    let url = '/';
    let status = 0;
    let size = 0;

    // Scan for obvious fields
    let foundMethodIdx = -1;

    for (let i = 0; i < Math.min(parts.length, 15); i++) {
        const p = parts[i];
        if (ip === '0.0.0.0' && isIP(p)) ip = p;
        if (foundMethodIdx === -1 && isMethod(p)) {
            method = p.replace(/"/g, '');
            foundMethodIdx = i;
            // The next field is likely the URL
            if (parts[i + 1]) url = parts[i + 1];
        }
        if (status === 0 && isStatus(p)) status = parseInt(p, 10);
        if (!timestamp && isDate(p)) {
            let dateStr = p.replace(/[\[\]]/g, '');
            // Check for IIS or split date/time formats
            if (parts[i+1] && /^\d{2}:\d{2}:\d{2}/.test(parts[i+1])) {
                dateStr += ' ' + parts[i+1];
                try {
                    timestamp = new Date(dateStr).toISOString();
                } catch { timestamp = parseDateApache(dateStr); }
            } else {
                timestamp = parseDateApache(dateStr);
            }
        }
    }

    if (!timestamp) timestamp = new Date().toISOString();

    // If we found at least a Status and Method, it's probably a log line.
    // Or at least a Status and URL?
    if (status > 0 && (foundMethodIdx !== -1 || url !== '/')) {
        const uaString = line.toLowerCase();
        const botInfo = detectBot(uaString);

        // Filter out static assets for user traffic, and optionally filter all user traffic to save memory
        const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|mp3|pdf|zip|tar|gz|map)$/i.test(url.split('?')[0]);
        const skipUserAll = typeof localStorage !== 'undefined' && localStorage.getItem('skip_user_traffic') !== 'false';
        if (botInfo.type === 'user' && (skipUserAll || isStaticAsset)) {
            return null;
        }

        return {
            ip,
            timestamp,
            method,
            url,
            status,
            size,
            referrer: '',
            user_agent: uaString, // Pass full line as loose UserAgent if we can't parse it exact
            bot_name: botInfo.name,
            bot_type: botInfo.type,
            file_name: fileName || 'default'
        };
    }

    // Checking for 0 rows issue: logging failed lines for debug
    // console.log("Rejected:", line); 

    return null;
};

export const processChunk = (chunk: string, fileName?: string): LogEntry[] => {
    const lines = chunk.split('\n');
    const entries: LogEntry[] = [];
    // Preallocate assuming most lines are valid
    entries.length = 0; 
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0 || line.charCodeAt(0) === 35) continue; // '#'
        
        const entry = parseLine(line, fileName);
        if (entry) entries.push(entry);
    }
    return entries;
};
