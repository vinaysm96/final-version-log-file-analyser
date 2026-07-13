
import { read, utils } from 'xlsx';
import type { LogEntry } from './logParser';
import { detectBot } from './botDetector';

export const parseExcel = async (file: File): Promise<LogEntry[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const wb = read(arrayBuffer);
    const ws = wb.Sheets[wb.SheetNames[0]]; // Read first sheet
    const data = utils.sheet_to_json(ws, { header: 1 }) as any[][];

    if (data.length < 2) return [];

    // Find header row or assume first row
    const headers = data[0].map(h => String(h).toLowerCase().trim());

    // Map columns
    const map = {
        url: headers.findIndex(h => h.includes('url') || h.includes('uri') || h.includes('path') || h.includes('slug') || h === 'page'),
        status: headers.findIndex(h => h.includes('status') || h.includes('code') || h === 'sc-status'),
        method: headers.findIndex(h => h.includes('method') || h.includes('verb')),
        ip: headers.findIndex(h => h.includes('ip') || h === 'client' || h === 'remote_addr'),
        date: headers.findIndex(h => h.includes('time') || h.includes('date')),
        ua: headers.findIndex(h => h.includes('agent') || h.includes('browser') || h.includes('ua')),
        referrer: headers.findIndex(h => h.includes('referrer') || h.includes('referer')),
        size: headers.findIndex(h => h.includes('size') || h.includes('bytes'))
    };

    // If "url" column not found, fail early
    if (map.url === -1) {
        console.warn("Could not find 'URL' column in Excel file");
        return [];
    }

    const entries: LogEntry[] = [];

    // Start from row 1 (skipping header)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const url = row[map.url] ? String(row[map.url]) : '';
        if (!url) continue;

        const ua = map.ua !== -1 && row[map.ua] ? String(row[map.ua]) : 'Unknown';
        const botInfo = detectBot(ua);

        // Filter out static assets for user traffic, and optionally filter all user traffic to save memory
        const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|mp3|pdf|zip|tar|gz|map)$/i.test(url.split('?')[0]);
        const skipUserAll = typeof localStorage !== 'undefined' && localStorage.getItem('skip_user_traffic') !== 'false';
        if (botInfo.type === 'user' && (skipUserAll || isStaticAsset)) {
            continue;
        }

        // Fallbacks
        const method = map.method !== -1 ? String(row[map.method]).toUpperCase() : 'GET';
        const status = map.status !== -1 ? parseInt(row[map.status]) : 200;
        const size = map.size !== -1 ? parseInt(row[map.size]) : 0;
        const ip = map.ip !== -1 ? String(row[map.ip]) : '0.0.0.0';

        // Date parsing is tricky in Excel. 
        // If it's a number (Excel serial date), convert. If text, parse.
        let timestamp = new Date().toISOString();
        if (map.date !== -1 && row[map.date]) {
            const d = row[map.date];
            if (typeof d === 'number') {
                // Excel date
                const dateObj = new Date(Math.round((d - 25569) * 86400 * 1000));
                timestamp = dateObj.toISOString();
            } else {
                try {
                    timestamp = new Date(String(d)).toISOString();
                } catch (e) { }
            }
        }

        entries.push({
            ip,
            timestamp,
            method,
            url,
            status: isNaN(status) ? 0 : status,
            size: isNaN(size) ? 0 : size, // TODO: Size not always available
            referrer: map.referrer !== -1 ? String(row[map.referrer]) : '',
            user_agent: ua,
            bot_name: botInfo.name,
            bot_type: botInfo.type,
            response_time: 0
        });
    }

    return entries;
};
