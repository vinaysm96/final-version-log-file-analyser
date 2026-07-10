import { useState, useEffect } from 'react';
import { conn } from '../../lib/db';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, FileDiff, Download } from 'lucide-react';
import clsx from 'clsx';

export const LogComparison = ({ domain = "" }: { domain?: string }) => {
    const cleanDomain = domain.replace(/\/+$/, '');
    const [files, setFiles] = useState<string[]>([]);
    const [fileA, setFileA] = useState<string>('');
    const [fileB, setFileB] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const [stats, setStats] = useState<any>(null);
    const [increasedCrawl, setIncreasedCrawl] = useState<any[]>([]);
    const [decreasedCrawl, setDecreasedCrawl] = useState<any[]>([]);
    const [solvedErrors, setSolvedErrors] = useState<any[]>([]);
    const [newErrors, setNewErrors] = useState<any[]>([]);
    const [unresolvedErrors, setUnresolvedErrors] = useState<any[]>([]);

    useEffect(() => {
        const fetchFiles = async () => {
            if (!conn) return;
            try {
                const res = await conn.query(`SELECT DISTINCT file_name FROM logs WHERE file_name IS NOT NULL;`);
                const f = res.toArray().map((r: any) => r.toJSON().file_name);
                setFiles(f);
                if (f.length >= 2) {
                    setFileA(f[0]);
                    setFileB(f[1]);
                } else if (f.length === 1) {
                    setFileA(f[0]);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchFiles();
    }, []);

    const exportPanelCSV = (title: string, data: any[]) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]);
        let csv = headers.join(',') + '\n';
        csv += data.map(row => headers.map(h => `"${(row[h]||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const runComparison = async () => {
        if (!conn || !fileA || !fileB) return;
        setLoading(true);
        try {
            // General Stats
            const statsQuery = await conn.query(`
                SELECT 
                    SUM(CASE WHEN file_name = '${fileA}' THEN 1 ELSE 0 END) as hits_A,
                    SUM(CASE WHEN file_name = '${fileB}' THEN 1 ELSE 0 END) as hits_B,
                    COUNT(DISTINCT CASE WHEN file_name = '${fileA}' THEN url END) as urls_A,
                    COUNT(DISTINCT CASE WHEN file_name = '${fileB}' THEN url END) as urls_B
                FROM logs
                WHERE file_name IN ('${fileA}', '${fileB}')
            `);
            const statsArray = statsQuery.toArray();
            if (statsArray.length > 0) {
                setStats(statsArray[0].toJSON());
            } else {
                setStats({ hits_A: 0, hits_B: 0, urls_A: 0, urls_B: 0 });
            }

            // Increased Crawl Rate
            const increasedCrawlQuery = await conn.query(`
                WITH CountsA AS (
                    SELECT url, bot_name, COUNT(*) as hits_a FROM logs WHERE file_name = '${fileA}' AND bot_type != 'unknown' GROUP BY url, bot_name
                ),
                CountsB AS (
                    SELECT url, bot_name, COUNT(*) as hits_b FROM logs WHERE file_name = '${fileB}' AND bot_type != 'unknown' GROUP BY url, bot_name
                )
                SELECT COALESCE(a.url, b.url) as url, COALESCE(a.bot_name, b.bot_name) as bot_name, COALESCE(a.hits_a, 0) as hits_a, COALESCE(b.hits_b, 0) as hits_b, 
                (COALESCE(b.hits_b, 0) - COALESCE(a.hits_a, 0)) as diff
                FROM CountsA a FULL OUTER JOIN CountsB b ON a.url = b.url AND a.bot_name = b.bot_name
                WHERE (COALESCE(b.hits_b, 0) - COALESCE(a.hits_a, 0)) > 0
                ORDER BY diff DESC LIMIT 20
            `);
            setIncreasedCrawl(increasedCrawlQuery.toArray().map((r: any) => r.toJSON()));

            // Decreased Crawl Rate
            const decreasedCrawlQuery = await conn.query(`
                WITH CountsA AS (
                    SELECT url, bot_name, COUNT(*) as hits_a FROM logs WHERE file_name = '${fileA}' AND bot_type != 'unknown' GROUP BY url, bot_name
                ),
                CountsB AS (
                    SELECT url, bot_name, COUNT(*) as hits_b FROM logs WHERE file_name = '${fileB}' AND bot_type != 'unknown' GROUP BY url, bot_name
                )
                SELECT COALESCE(a.url, b.url) as url, COALESCE(a.bot_name, b.bot_name) as bot_name, COALESCE(a.hits_a, 0) as hits_a, COALESCE(b.hits_b, 0) as hits_b, 
                (COALESCE(a.hits_a, 0) - COALESCE(b.hits_b, 0)) as diff
                FROM CountsA a FULL OUTER JOIN CountsB b ON a.url = b.url AND a.bot_name = b.bot_name
                WHERE (COALESCE(a.hits_a, 0) - COALESCE(b.hits_b, 0)) > 0
                ORDER BY diff DESC LIMIT 20
            `);
            setDecreasedCrawl(decreasedCrawlQuery.toArray().map((r: any) => r.toJSON()));

            // Solved Errors (Had error in A, no longer has error in B (either not requested, or status 200/301))
            const solvedQuery = await conn.query(`
                WITH ErrorsA AS (
                    SELECT url, MAX(status) as status_a FROM logs WHERE file_name = '${fileA}' AND status >= 400 GROUP BY url
                ),
                ErrorsB AS (
                    SELECT url, MAX(status) as status_b FROM logs WHERE file_name = '${fileB}' AND status >= 400 GROUP BY url
                )
                SELECT a.url, a.status_a, COALESCE(b.status_b, 200) as status_b
                FROM ErrorsA a
                LEFT JOIN ErrorsB b ON a.url = b.url
                WHERE b.url IS NULL
                ORDER BY a.status_a DESC LIMIT 50
            `);
            setSolvedErrors(solvedQuery.toArray().map((r: any) => r.toJSON()));

            // New Errors (Has error in B, did not have error in A)
            const newErrorQuery = await conn.query(`
                WITH ErrorsA AS (
                    SELECT url, MAX(status) as status_a FROM logs WHERE file_name = '${fileA}' AND status >= 400 GROUP BY url
                ),
                ErrorsB AS (
                    SELECT url, MAX(status) as status_b FROM logs WHERE file_name = '${fileB}' AND status >= 400 GROUP BY url
                )
                SELECT b.url, COALESCE(a.status_a, 200) as status_a, b.status_b
                FROM ErrorsB b
                LEFT JOIN ErrorsA a ON a.url = b.url
                WHERE a.url IS NULL
                ORDER BY b.status_b DESC LIMIT 50
            `);
            setNewErrors(newErrorQuery.toArray().map((r: any) => r.toJSON()));

            // Unresolved Errors (Has error in both A and B)
            const unresolvedQuery = await conn.query(`
                WITH ErrorsA AS (
                    SELECT url, MAX(status) as status_a FROM logs WHERE file_name = '${fileA}' AND status >= 400 GROUP BY url
                ),
                ErrorsB AS (
                    SELECT url, MAX(status) as status_b FROM logs WHERE file_name = '${fileB}' AND status >= 400 GROUP BY url
                )
                SELECT a.url, a.status_a, b.status_b
                FROM ErrorsA a
                INNER JOIN ErrorsB b ON a.url = b.url
                ORDER BY b.status_b DESC LIMIT 50
            `);
            setUnresolvedErrors(unresolvedQuery.toArray().map((r: any) => r.toJSON()));

        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <header className="flex justify-between items-end pb-4 border-b border-border">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <FileDiff className="w-8 h-8 text-purple-500" />
                        Log Comparison
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Compare data between two imported log files (e.g., Before and After fixes).
                    </p>
                </div>
            </header>

            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">Log A (Baseline)</label>
                    <select 
                        className="w-full bg-background border border-border rounded p-2 text-sm"
                        value={fileA}
                        onChange={(e) => setFileA(e.target.value)}
                    >
                        <option value="">Select File A</option>
                        {files.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div className="pt-6 font-bold text-muted-foreground">VS</div>
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">Log B (Recent)</label>
                    <select 
                        className="w-full bg-background border border-border rounded p-2 text-sm"
                        value={fileB}
                        onChange={(e) => setFileB(e.target.value)}
                    >
                        <option value="">Select File B</option>
                        {files.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div className="pt-6">
                    <button 
                        onClick={runComparison}
                        disabled={loading || !fileA || !fileB || fileA === fileB}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Comparing...' : 'Compare Logs'}
                    </button>
                </div>
            </div>

            {stats && (() => {
                const hitsA = Number(stats.hits_A || 0);
                const hitsB = Number(stats.hits_B || 0);
                const urlsA = Number(stats.urls_A || 0);
                const urlsB = Number(stats.urls_B || 0);

                const hitsDiffPct = hitsA > 0 ? Math.round((Math.abs(hitsB - hitsA) / hitsA) * 100) : 0;
                const urlsDiffPct = urlsA > 0 ? Math.round((Math.abs(urlsB - urlsA) / urlsA) * 100) : 0;

                return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center">
                            <div className="text-sm text-muted-foreground mb-1">Total Hits (A)</div>
                            <div className="text-2xl font-bold">{hitsA.toLocaleString()}</div>
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center">
                            <div className="text-sm text-muted-foreground mb-1">Total Hits (B)</div>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                {hitsB.toLocaleString()}
                                <span className={clsx("text-sm flex items-center", hitsB >= hitsA ? "text-green-500" : "text-red-500")}>
                                    {hitsB >= hitsA ? <ArrowUpRight className="w-4 h-4"/> : <ArrowDownRight className="w-4 h-4"/>}
                                    {hitsDiffPct}%
                                </span>
                            </div>
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center">
                            <div className="text-sm text-muted-foreground mb-1">Unique URLs (A)</div>
                            <div className="text-2xl font-bold">{urlsA.toLocaleString()}</div>
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center">
                            <div className="text-sm text-muted-foreground mb-1">Unique URLs (B)</div>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                {urlsB.toLocaleString()}
                                <span className={clsx("text-sm flex items-center", urlsB >= urlsA ? "text-green-500" : "text-red-500")}>
                                    {urlsB >= urlsA ? <ArrowUpRight className="w-4 h-4"/> : <ArrowDownRight className="w-4 h-4"/>}
                                    {urlsDiffPct}%
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {stats && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Increased Crawl Rate */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-green-500/10">
                            <h3 className="font-semibold flex items-center gap-2 text-green-500">
                                <ArrowUpRight className="w-5 h-5" /> Increased Bot Crawl Rate
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{increasedCrawl.length} urls</span>
                                <button onClick={() => exportPanelCSV("increased_crawl", increasedCrawl)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 max-h-80">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">URL</th>
                                        <th className="px-4 py-2 font-medium">Bot Name</th>
                                        <th className="px-4 py-2 font-medium text-right">Log A</th>
                                        <th className="px-4 py-2 font-medium text-right">Log B</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {increasedCrawl.map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={row.url || ''}>
                                                <a href={`${cleanDomain}${(row.url || '').startsWith('/') ? '' : '/'}${row.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
                                                    {cleanDomain}{(row.url || '').startsWith('/') ? '' : '/'}{row.url || ''}
                                                </a>
                                            </td>
                                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{row.bot_name}</td>
                                            <td className="px-4 py-2 text-right">{Number(row.hits_a)}</td>
                                            <td className="px-4 py-2 text-right text-green-500 font-medium">+{Number(row.hits_b)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {increasedCrawl.length === 0 && <div className="p-8 text-center text-muted-foreground">No pages with increased crawl rate.</div>}
                        </div>
                    </div>

                    {/* Decreased Crawl Rate */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-red-500/10">
                            <h3 className="font-semibold flex items-center gap-2 text-red-500">
                                <ArrowDownRight className="w-5 h-5" /> Decreased Bot Crawl Rate
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{decreasedCrawl.length} urls</span>
                                <button onClick={() => exportPanelCSV("decreased_crawl", decreasedCrawl)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 max-h-80">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">URL</th>
                                        <th className="px-4 py-2 font-medium">Bot Name</th>
                                        <th className="px-4 py-2 font-medium text-right">Log A</th>
                                        <th className="px-4 py-2 font-medium text-right">Log B</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {decreasedCrawl.map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={row.url || ''}>
                                                <a href={`${cleanDomain}${(row.url || '').startsWith('/') ? '' : '/'}${row.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
                                                    {cleanDomain}{(row.url || '').startsWith('/') ? '' : '/'}{row.url || ''}
                                                </a>
                                            </td>
                                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{row.bot_name}</td>
                                            <td className="px-4 py-2 text-right">{Number(row.hits_a)}</td>
                                            <td className="px-4 py-2 text-right text-red-500 font-medium">-{Number(row.hits_b)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {decreasedCrawl.length === 0 && <div className="p-8 text-center text-muted-foreground">No pages with decreased crawl rate.</div>}
                        </div>
                    </div>

                    {/* Solved Errors */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-emerald-500/10">
                            <h3 className="font-semibold flex items-center gap-2 text-emerald-500">
                                <CheckCircle2 className="w-5 h-5" /> Solved Errors
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{solvedErrors.length} urls</span>
                                <button onClick={() => exportPanelCSV("solved_errors", solvedErrors)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 max-h-80">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">URL</th>
                                        <th className="px-4 py-2 font-medium">Old Status (A)</th>
                                        <th className="px-4 py-2 font-medium">New Status (B)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {solvedErrors.map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={row.url || ''}>
                                                <a href={`${cleanDomain}${(row.url || '').startsWith('/') ? '' : '/'}${row.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
                                                    {cleanDomain}{(row.url || '').startsWith('/') ? '' : '/'}{row.url || ''}
                                                </a>
                                            </td>
                                            <td className="px-4 py-2 text-red-400">{row.status_a}</td>
                                            <td className="px-4 py-2 text-emerald-500">{row.status_b === 200 ? 'OK / Not Error' : row.status_b}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {solvedErrors.length === 0 && <div className="p-8 text-center text-muted-foreground">No solved errors found.</div>}
                        </div>
                    </div>

                    {/* New Errors */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-orange-500/10">
                            <h3 className="font-semibold flex items-center gap-2 text-orange-500">
                                <AlertTriangle className="w-5 h-5" /> New Errors
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{newErrors.length} urls</span>
                                <button onClick={() => exportPanelCSV("new_errors", newErrors)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 max-h-80">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">URL</th>
                                        <th className="px-4 py-2 font-medium">Old Status (A)</th>
                                        <th className="px-4 py-2 font-medium">New Status (B)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {newErrors.map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={row.url || ''}>
                                                <a href={`${cleanDomain}${(row.url || '').startsWith('/') ? '' : '/'}${row.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
                                                    {cleanDomain}{(row.url || '').startsWith('/') ? '' : '/'}{row.url || ''}
                                                </a>
                                            </td>
                                            <td className="px-4 py-2">{row.status_a === 200 ? 'OK / Not Error' : row.status_a}</td>
                                            <td className="px-4 py-2 text-orange-500">{row.status_b}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {newErrors.length === 0 && <div className="p-8 text-center text-muted-foreground">No new errors found.</div>}
                        </div>
                    </div>
                </div>
            )}

            {stats && (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col w-full">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-yellow-500/10">
                        <h3 className="font-semibold flex items-center gap-2 text-yellow-600">
                            <AlertTriangle className="w-5 h-5" /> Unresolved Errors (Pending)
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{unresolvedErrors.length} urls</span>
                            <button onClick={() => exportPanelCSV("unresolved_errors", unresolvedErrors)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                        </div>
                    </div>
                    <div className="overflow-auto max-h-80 w-full">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 font-medium">URL</th>
                                    <th className="px-4 py-2 font-medium">Old Status (A)</th>
                                    <th className="px-4 py-2 font-medium">New Status (B)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {unresolvedErrors.map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                        <td className="px-4 py-2 font-mono text-xs truncate max-w-[400px]" title={row.url || ''}>
                                            <a href={`${cleanDomain}${(row.url || '').startsWith('/') ? '' : '/'}${row.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
                                                {cleanDomain}{(row.url || '').startsWith('/') ? '' : '/'}{row.url || ''}
                                            </a>
                                        </td>
                                        <td className="px-4 py-2 text-red-500">{row.status_a}</td>
                                        <td className="px-4 py-2 text-red-500">{row.status_b}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {unresolvedErrors.length === 0 && <div className="p-8 text-center text-muted-foreground">No unresolved errors found. Everything seems clean!</div>}
                    </div>
                </div>
            )}
        </div>
    );
};
