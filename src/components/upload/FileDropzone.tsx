import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Zap } from 'lucide-react';
import clsx from 'clsx';

interface FileDropzoneProps {
    onFilesSelected: (files: File[]) => void;
    isProcessing?: boolean;
}

function makeLine(ip: string, date: string, method: string, url: string, status: number, size: number, ref: string, ua: string) {
    return `${ip} - - [${date}] "${method} ${url} HTTP/1.1" ${status} ${size} "${ref}" "${ua}"`;
}

function generateDemoLogs(): string {
    const now = new Date();
    const lines: string[] = [];

    const bots: [string, string, string][] = [
        ['66.249.66.1', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'search_engine'],
        ['66.249.66.2', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'search_engine'],
        ['157.55.39.1', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'search_engine'],
        ['77.88.5.1',  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'search_engine'],
        ['180.76.15.1', 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', 'search_engine'],
        ['54.36.148.1', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'seo_tool'],
        ['185.191.171.1', 'SemrushBot/7~bl; +http://www.semrush.com/bot.html', 'seo_tool'],
        ['13.66.139.1', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)', 'search_engine'],
        ['20.165.25.1', 'GPTBot/1.0 (+https://openai.com/gptbot)', 'ai_bot'],
        ['23.102.140.1', 'ClaudeBot/1.0; +https://www.anthropic.com/product', 'ai_bot'],
        ['34.127.22.1', 'PerplexityBot/1.0; +https://www.perplexity.ai/perplexitybot', 'ai_bot'],
        ['57.151.118.1', 'CCBot/2.0 (https://commoncrawl.org/faq/)', 'ai_bot'],
        ['192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'user'],
        ['192.168.1.2', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36', 'user'],
        ['192.168.1.3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 'user'],
        ['10.0.0.5', 'python-requests/2.31.0', 'monitoring'],
        ['10.0.0.6', 'curl/8.1.2', 'monitoring'],
        ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'facebookexternalhit', 'social'],
    ];

    const urls = [
        ['/', 200, 18000],
        ['/about', 200, 12000],
        ['/contact', 200, 9000],
        ['/products', 200, 22000],
        ['/products/laptop', 200, 15000],
        ['/products/phone', 200, 14000],
        ['/blog', 200, 18000],
        ['/blog/seo-tips', 200, 11000],
        ['/blog/marketing', 200, 9500],
        ['/services', 200, 16000],
        ['/pricing', 200, 13000],
        ['/login', 200, 8000],
        ['/sitemap.xml', 200, 5000],
        ['/robots.txt', 200, 500],
        ['/old-page', 301, 0],
        ['/deprecated', 301, 0],
        ['/redirect-me', 302, 0],
        ['/missing-page', 404, 0],
        ['/deleted-article', 404, 0],
        ['/broken-link', 404, 0],
        ['/wp-admin', 403, 0],
        ['/admin', 403, 0],
        ['/api/internal', 403, 0],
        ['/products?sort=price&page=1', 200, 15000],
        ['/products?sort=price&page=2', 200, 15000],
        ['/products?sort=name&page=1', 200, 15000],
        ['/Products', 200, 15000],  // case sensitivity issue
        ['/PRODUCTS', 200, 15000],  // case sensitivity issue
        ['/products/', 200, 15000], // trailing slash issue
        ['/Blog', 200, 18000],      // case issue
        ['/server-error', 500, 0],
        ['/api/timeout', 503, 0],
    ];

    let d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Generate 5 days of data, spreading requests
    for (let day = 0; day < 30; day++) {
        const dayDate = new Date(d.getTime() + day * 24 * 60 * 60 * 1000);
        for (let hour = 0; hour < 24; hour++) {
            const n = 4 + Math.floor(Math.random() * 8);
            for (let k = 0; k < n; k++) {
                const bot = bots[Math.floor(Math.random() * bots.length)];
                const urlEntry = urls[Math.floor(Math.random() * urls.length)];
                const dt = new Date(dayDate.getTime() + hour * 3600000 + Math.floor(Math.random() * 3600000));
                const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') +
                    `:${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')} +0000`;
                lines.push(makeLine(
                    bot[0],
                    dateStr,
                    urlEntry[1] === 0 ? 'GET' : (Math.random() < 0.05 ? 'HEAD' : 'GET'),
                    urlEntry[0] as string,
                    urlEntry[1] as number,
                    urlEntry[2] as number,
                    Math.random() < 0.3 ? 'https://www.google.com/' : '-',
                    bot[1]
                ));
            }
        }
    }

    return lines.join('\n');
}

export const FileDropzone = ({ onFilesSelected, isProcessing = false }: FileDropzoneProps) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFilesSelected(acceptedFiles);
        }
    }, [onFilesSelected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled: isProcessing,
    });

    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={clsx(
                    "relative group cursor-pointer flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl transition-all duration-300",
                    isDragActive
                        ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                        : "border-border hover:border-blue-500/60 hover:bg-muted/40",
                    isProcessing && "opacity-60 cursor-not-allowed pointer-events-none"
                )}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center p-6 text-center space-y-3">
                    <div className={clsx(
                        "p-4 rounded-2xl transition-all duration-300",
                        isDragActive ? "bg-blue-500/20 text-blue-400 scale-110" : "bg-muted text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-400"
                    )}>
                        {isProcessing ? (
                            <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <UploadCloud className="w-8 h-8" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <p className="text-lg font-semibold">
                            {isProcessing ? "Processing..." : isDragActive ? "Drop logs here" : "Drag & drop log files"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Apache, Nginx, IIS, JSON, CSV, Excel, .gz — any format
                        </p>
                    </div>

                    {!isProcessing && (
                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                            {['Apache', 'Nginx', 'IIS', 'JSON Logs', '.gz', 'CSV', 'Excel'].map(f => (
                                <span key={f} className="text-[10px] bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground">{f}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const content = generateDemoLogs();
                        const file = new File([content], "demo_data.log", { type: "text/plain" });
                        onFilesSelected([file]);
                    }}
                    disabled={isProcessing}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-500/10 transition-all disabled:opacity-50"
                >
                    <Zap className="w-4 h-4" />
                    Load Demo Data (30 days · all bot types)
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Generate a second set with different patterns for comparison testing
                        const content = generateDemoLogs();
                        const file = new File([content], "demo_data_v2.log", { type: "text/plain" });
                        onFilesSelected([file]);
                    }}
                    disabled={isProcessing}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50"
                >
                    <FileText className="w-4 h-4" />
                    Load Comparison Log
                </button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50">
                🔒 All processing happens locally. No data is sent to any server.
            </p>
        </div>
    );
};
