import React, { useEffect, useState } from 'react';
import { getInconsistentStats, getOrphanStats, getErrorStats, getServerErrors, getSitemapURLs, getRobotsSuggestions, getRedirectionChains, getTopCrawledPages, getCrawlBudgetWastage, getCrawlBudgetLinks } from '../../lib/db/seoQueries';
import { AlertCircle, FileWarning, GitFork, CheckCircle2, Download, Bot, Link2, TrendingUp, FolderTree, FileSpreadsheet, ChevronRight, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

export function SEOReports({ domain = "" }: { domain?: string }) {
    const [issues, setIssues] = useState<{
        caseIssues: any[];
        slashIssues: any[];
        orphans: any[];
        errors: any[];
        serverErrors: any[];
        sitemapUrls: any[];
        robotsSuggestions: any[];
        redirectionChains: any[];
        topCrawled: any[];
        crawlBudget: any[];
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [limits] = useState<Record<string, number>>({
        errors: 100, serverErrors: 100, slashIssues: 100, caseIssues: 100, 
        orphans: 100, robotsSuggestions: 100, topCrawled: 100, crawlBudget: 100, redirectionChains: 100
    });
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [expandedDir, setExpandedDir] = useState<string | null>(null);
    const [dirLinks, setDirLinks] = useState<any[]>([]);
    const [dirLinksLoading, setDirLinksLoading] = useState(false);

    const toggleDir = async (directory: string) => {
        if (expandedDir === directory) { setExpandedDir(null); return; }
        setExpandedDir(directory);
        setDirLinks([]);
        setDirLinksLoading(true);
        try {
            const links = await getCrawlBudgetLinks(directory);
            setDirLinks(links);
        } catch (e) {
            console.error('dirLinks failed', e);
        } finally {
            setDirLinksLoading(false);
        }
    };


    const exportPanelExcel = (title: string, data: any[]) => {
        if (!data || data.length === 0) return;
        
        try {
            // Flatten nested data for Excel and safely convert BigInt to Number
            const rawData = JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? Number(v) : v));
            const flattened = rawData.map((row: any) => {
                const newRow = { ...row };
                Object.keys(newRow).forEach(key => {
                    if (Array.isArray(newRow[key])) {
                        newRow[key] = newRow[key].join(', ');
                    }
                });
                return newRow;
            });

            const worksheet = XLSX.utils.json_to_sheet(flattened);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            
            const dateStr = new Date().toISOString().split('T')[0];
            const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const fileName = `${safeTitle}_${dateStr}.xlsx`;
            
            // Generate Base64 for maximum OS/Browser filename reliability
            const b64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            const a = document.createElement('a');
            a.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + b64;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
        } catch (err) {
            console.error("Excel Export Error:", err);
            alert("Export failed. Detail: " + (err as Error).message);
        }
    };

    const generateSitemap = () => {
        if (!issues || issues.sitemapUrls.length === 0) return;
        
        const cleanDomain = domain.replace(/\/+$/, ''); // Prevent double slashes
        
        const xmlBody = issues.sitemapUrls.map(u => {
            const date = u.lastmod ? new Date(u.lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const cleanUrl = u.clean_url.startsWith('/') ? u.clean_url : `/${u.clean_url}`;
            return `  <url>\n    <loc>${cleanDomain}${cleanUrl}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlBody}\n</urlset>`;

        const a = document.createElement('a');
        a.href = "data:application/xml;base64," + btoa(unescape(encodeURIComponent(xml)));
        a.download = "sitemap.xml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const generateRobotsTxt = () => {
        if (!issues || issues.robotsSuggestions.length === 0) return;
        const txt = issues.robotsSuggestions.map(row => `Disallow: /*?${row.param_name}=`).join('\n');
        const a = document.createElement('a');
        a.href = "data:text/plain;base64," + btoa(unescape(encodeURIComponent(txt)));
        a.download = "robots.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const safeVariants = (v: any) => Array.isArray(v) ? v : (v && typeof v.forEach === 'function' ? Array.from(v) : (typeof v === 'string' ? [v] : []));
                
                // Initialize empty but non-null state to allow early rendering of the grid structure
                const defaultState: NonNullable<typeof issues> = {
                    caseIssues: [] as any[], slashIssues: [] as any[], orphans: [] as any[], errors: [] as any[], serverErrors: [] as any[],
                    sitemapUrls: [] as any[], robotsSuggestions: [] as any[], redirectionChains: [] as any[], 
                    topCrawled: [] as any[], crawlBudget: [] as any[]
                };
                
                setIssues(defaultState);
                setLoading(false); // Drop global loading mask to reveal structure instantly

                const patch = (update: Partial<typeof defaultState>) => {
                    if (isMounted) setIssues(prev => prev ? { ...prev, ...update } : defaultState);
                };

                // Sequential but isolated calls to keep the UI alive even if one fails
                const runSafe = async (fn: () => Promise<any>, key: keyof typeof defaultState) => {
                    try {
                        const res = await fn();
                        patch({ [key]: res });
                    } catch (e) {
                        console.error(`Panel ${key} failed:`, e);
                    }
                };

                await runSafe(() => getErrorStats(), 'errors');
                await runSafe(() => getServerErrors(), 'serverErrors');
                await runSafe(() => getTopCrawledPages(), 'topCrawled');
                await runSafe(() => getCrawlBudgetWastage(), 'crawlBudget');
                await runSafe(async () => {
                    const inc = await getInconsistentStats();
                    return inc.caseIssues.map(i => ({...i, variants: safeVariants(i.variants)}));
                }, 'caseIssues');
                await runSafe(async () => {
                    const inc = await getInconsistentStats();
                    return inc.slashIssues.map(i => ({...i, variants: safeVariants(i.variants)}));
                }, 'slashIssues');
                await runSafe(() => getOrphanStats(), 'orphans');
                await runSafe(() => getRobotsSuggestions(), 'robotsSuggestions');
                await runSafe(() => getRedirectionChains(), 'redirectionChains');
                await runSafe(() => getSitemapURLs(), 'sitemapUrls');

            } catch (e: any) {
                if (!isMounted) return;
                console.error("Audit Main Error:", e);
                setErrorMsg(e.message || String(e));
            }
        };
        load();
        return () => { isMounted = false; };
    }, []);

    if (errorMsg) return (
        <div className="p-8 text-center text-red-500 max-w-2xl mx-auto space-y-6">
            <h3 className="font-bold text-2xl">SEO Audit Failed</h3>
            <div className="p-4 bg-muted border border-border rounded-xl font-mono text-sm text-left text-foreground whitespace-pre-wrap">{errorMsg}</div>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-left">
                <strong>Memory limit exceeded.</strong> Clear the database files below to unbrick the app.
            </div>

            <button 
                onClick={async () => {
                    if (confirm("Are you sure you want to delete all parsed logs to unbrick the app? This cannot be undone.")) {
                        try {
                            const { db, conn } = await import('../../lib/db');
                            if (conn) { try { await conn.close(); } catch {} }
                            if (db) { try { await db.terminate(); } catch {} }
                        } catch {}
                        try {
                            const dir = await navigator.storage.getDirectory();
                            await dir.removeEntry('seologanalyzer.db', { recursive: true });
                        } catch {}
                        window.location.reload();
                    }
                }}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-md transition-colors text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
                Clear Database & Restart App
            </button>
        </div>
    );
    if (!issues && loading) return <div className="p-8 text-center animate-pulse">Running SEO Audits...</div>;
    if (!issues) return <div className="p-8 text-center">No audit data</div>;

    const hasIssues = issues.caseIssues.length > 0 || issues.slashIssues.length > 0 || issues.errors.length > 0 || issues.redirectionChains.length > 0;
    const cleanDomain = domain.replace(/\/+$/, '');

    return (
        <div className="space-y-8 animate-in fade-in">
            <header>
                <h2 className="text-2xl font-bold">SEO Audit Reports</h2>
                <p className="text-muted-foreground">Automated detection of common crawler traps and inefficiencies.</p>
            </header>

            {!hasIssues && (
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex items-center text-green-700">
                    <CheckCircle2 className="w-5 h-5 mr-3" />
                    <span>Clean logs! No major inconsistency issues detected.</span>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* 1. Status Codes Errors */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <h3 className="font-semibold">Client Errors (4xx)</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{issues.errors.length} URLs</span>
                            <button onClick={() => exportPanelExcel("top_errors", issues.errors)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left">URL</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-right">Status</th>
                                    <th className="px-4 py-2 text-right">Hits</th>
                                    <th className="px-4 py-2 text-right">Freq</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.errors.slice(0, limits.errors).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={cleanDomain + row.url}>
                                            <span className="text-[10px] text-muted-foreground block truncate">{cleanDomain}</span>
                                            {row.url}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{row.file_type}</td>
                                        <td className="px-4 py-2 text-right ">
                                            <span className={clsx("px-1.5 py-0.5 rounded text-xs font-mono", row.status >= 500 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">{Number(row.hits).toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-xs whitespace-nowrap text-muted-foreground">{row.crawl_frequency}</td>
                                    </tr>
                                ))}
                                {issues.errors.length === 0 && (
                                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No errors found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 1.5. Server Errors (5xx) */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <h3 className="font-semibold">Server Errors (5xx)</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{issues.serverErrors.length} URLs</span>
                            <button onClick={() => exportPanelExcel("server_errors", issues.serverErrors)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left">URL</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-right">Status</th>
                                    <th className="px-4 py-2 text-right">Hits</th>
                                    <th className="px-4 py-2 text-right">Freq</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.serverErrors.slice(0, limits.serverErrors).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={cleanDomain + row.url}>
                                            <span className="text-[10px] text-muted-foreground block truncate">{cleanDomain}</span>
                                            {row.url}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{row.file_type}</td>
                                        <td className="px-4 py-2 text-right ">
                                            <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-red-100 text-red-700">
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">{Number(row.hits).toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-xs whitespace-nowrap text-muted-foreground">{row.crawl_frequency}</td>
                                    </tr>
                                ))}
                                {issues.serverErrors.length === 0 && (
                                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No 5xx server errors found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Slash Inconsistencies */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <GitFork className="w-4 h-4 text-amber-500" />
                            <h3 className="font-semibold">Slash Consistency</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">{issues.slashIssues.length} groups</span>
                            <button onClick={() => exportPanelExcel("slash_consistency", issues.slashIssues)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                        </div>
                    </div>
                    <div className="p-4 text-sm text-muted-foreground bg-amber-50/50 border-b border-amber-100 dark:bg-transparent dark:border-border">
                        URLs accessed both with and without trailing slashes. This causes duplicate content issues.
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <ul className="divide-y divide-border">
                            {issues.slashIssues.slice(0, limits.slashIssues).map((row, i) => (
                                <li key={i} className="p-4 hover:bg-muted/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono text-xs text-muted-foreground mb-1">Base: {cleanDomain}{row.clean_url}</div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded">{row.file_type}</span>
                                            <span className="text-[10px] text-muted-foreground">{row.crawl_frequency}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {row.variants.map((v: string) => (
                                            <span key={v} className="bg-background border border-border px-2 py-1 rounded text-xs font-mono">
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                            {issues.slashIssues.length === 0 && (
                                <li className="p-4 text-center text-muted-foreground">No slash inconsistencies parsing found.</li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* 3. Case Sensitivity */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FileWarning className="w-4 h-4 text-purple-500" />
                            <h3 className="font-semibold">Case Sensitivity</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">{issues.caseIssues.length} groups</span>
                            <button onClick={() => exportPanelExcel("case_sensitivity", issues.caseIssues)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <ul className="divide-y divide-border">
                            {issues.caseIssues.slice(0, limits.caseIssues).map((row, i) => (
                                <li key={i} className="p-4 hover:bg-muted/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono text-xs text-muted-foreground mb-1">Normalized: {cleanDomain}{row.clean_url}</div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded">{row.file_type}</span>
                                            <span className="text-[10px] text-muted-foreground">{row.crawl_frequency}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {row.variants.map((v: string) => (
                                            <span key={v} className="bg-background border border-border px-2 py-1 rounded text-xs font-mono">
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                            {issues.caseIssues.length === 0 && (
                                <li className="p-4 text-center text-muted-foreground">No case variants found.</li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* 4. Low Hit Pages (Orphans) */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-500" />
                            <h3 className="font-semibold">Low Traffic / Orphans</h3>
                        </div>
                        <button onClick={() => exportPanelExcel("orphaned_pages", issues.orphans)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left">URL</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-right">Hits</th>
                                    <th className="px-4 py-2 text-right">Freq</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.orphans.slice(0, limits.orphans).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={cleanDomain + row.url}>
                                            <span className="text-[10px] text-muted-foreground block truncate">{cleanDomain}</span>
                                            {row.url}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{row.file_type}</td>
                                        <td className="px-4 py-2 text-right font-mono">{Number(row.hits).toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-xs whitespace-nowrap text-muted-foreground">{row.crawl_frequency}</td>
                                    </tr>
                                ))}
                                {issues.orphans.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No low traffic pages found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 5. Robots.txt Parameter Suggestions */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-emerald-500" />
                            <h3 className="font-semibold">Robots.txt Parameter Blocks</h3>
                        </div>
                        <button onClick={generateRobotsTxt} className="text-muted-foreground hover:text-white" title="Download robots.txt"><Download className="w-4 h-4"/></button>
                    </div>
                    <div className="p-4 text-sm text-muted-foreground bg-emerald-50/50 border-b border-emerald-100 dark:bg-transparent dark:border-border">
                        These dynamic URL parameters create duplicate content. Consider blocking them in your robots.txt or Google Search Console.
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left">URL Parameter</th>
                                    <th className="px-4 py-2 text-right">Duplicate Hits</th>
                                    <th className="px-4 py-2 text-right">Freq</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.robotsSuggestions.slice(0, limits.robotsSuggestions).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 font-mono font-medium">Disallow: /*?{row.param_name}=</td>
                                        <td className="px-4 py-2 text-right text-muted-foreground">{Number(row.hits).toLocaleString()} hits</td>
                                        <td className="px-4 py-2 text-right text-xs whitespace-nowrap text-muted-foreground">{row.crawl_frequency}</td>
                                    </tr>
                                ))}
                                {issues.robotsSuggestions.length === 0 && (
                                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No parameters eating crawl budget found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 6. Top Crawled Pages */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <h3 className="font-semibold">Top Crawled Pages (200 OK)</h3>
                        </div>
                        <button onClick={() => exportPanelExcel("top_crawled", issues.topCrawled)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left">URL</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-right">Hits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.topCrawled.slice(0, limits.topCrawled).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={cleanDomain + row.url}>
                                            <span className="text-[10px] text-muted-foreground block truncate">{cleanDomain}</span>
                                            {row.url}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{row.file_type}</td>
                                        <td className="px-4 py-2 text-right font-mono text-blue-400">{Number(row.hits).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {issues.topCrawled.length === 0 && (
                                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No top crawled pages found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 7. Crawl Budget Wastage */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FolderTree className="w-4 h-4 text-orange-400" />
                            <h3 className="font-semibold">Crawl Budget by Directory</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Click a row to expand links</span>
                            <button onClick={() => exportPanelExcel("crawl_budget", issues.crawlBudget)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                        </div>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 text-left">Directory</th>
                                    <th className="px-4 py-2 text-right">Unique URLs</th>
                                    <th className="px-4 py-2 text-right">Total Hits</th>
                                    <th className="px-4 py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {issues.crawlBudget.slice(0, limits.crawlBudget).map((row, i) => (
                                    <React.Fragment key={i}>
                                        <tr
                                            onClick={() => toggleDir(row.directory)}
                                            className="border-t border-border hover:bg-muted/40 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-4 py-2 font-mono flex items-center gap-1.5">
                                                <FolderTree className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                                {row.directory}/
                                            </td>
                                            <td className="px-4 py-2 text-right text-muted-foreground">{Number(row.unique_urls_in_dir).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono text-orange-400">{Number(row.hits).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right">
                                                {expandedDir === row.directory
                                                    ? <ChevronUp className="w-4 h-4 inline text-muted-foreground" />
                                                    : <ChevronDown className="w-4 h-4 inline text-muted-foreground group-hover:text-foreground" />}
                                            </td>
                                        </tr>
                                        {expandedDir === row.directory && (
                                            <tr className="bg-muted/10">
                                                <td colSpan={4} className="p-0">
                                                    <div className="px-6 py-4 bg-black/5 dark:bg-white/3 shadow-inner">
                                                        <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                                                            <ExternalLink className="w-4 h-4 text-orange-400" />
                                                            URLs in <span className="font-mono">{row.directory}/</span>
                                                        </h4>
                                                        {dirLinksLoading ? (
                                                            <div className="text-sm text-muted-foreground py-2 animate-pulse">Loading...</div>
                                                        ) : dirLinks.length === 0 ? (
                                                            <div className="text-sm text-muted-foreground py-2">No URLs found in this directory.</div>
                                                        ) : (
                                                            <ul className="divide-y divide-border/40 border border-border/40 rounded-lg bg-background max-h-64 overflow-y-auto text-sm">
                                                                {dirLinks.map((link, li) => (
                                                                    <li key={li} className="px-4 py-2 flex items-center gap-3 hover:bg-muted/20">
                                                                        <span className={clsx(
                                                                            'flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                                                                            link.status >= 500 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                                                            link.status >= 400 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                                                                            link.status >= 300 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                                            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                                        )}>{link.status}</span>
                                                                        <a
                                                                            href={`${cleanDomain}${(link.url || '').startsWith('/') ? '' : '/'}${link.url || ''}`}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="hover:text-orange-400 hover:underline truncate flex-1 font-mono text-xs"
                                                                        >
                                                                            {cleanDomain}{(link.url || '').startsWith('/') ? '' : '/'}{link.url || ''}
                                                                        </a>
                                                                        <span className="flex-shrink-0 text-muted-foreground tabular-nums text-xs">
                                                                            {Number(link.hits).toLocaleString()} hits
                                                                            {link.last_crawled && (
                                                                                <span className="ml-2 opacity-50">· {new Date(link.last_crawled).toLocaleDateString()}</span>
                                                                            )}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {issues.crawlBudget.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No directory data found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 8. Redirection Chains */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm col-span-1 xl:col-span-2">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-rose-500" />
                            <h3 className="font-semibold">Redirection Chains</h3>
                        </div>
                        <button onClick={() => exportPanelExcel("redirect_chains", issues.redirectionChains)} className="text-muted-foreground hover:text-white" title="Export Excel"><FileSpreadsheet className="w-4 h-4 text-green-500"/></button>
                    </div>
                        These URLs are returning redirect status codes (301, 302). Having too many frequent redirects wastes crawl budget.
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Start URL</th>
                                    <th className="px-4 py-2">Path / Chain Steps</th>
                                    <th className="px-4 py-2 text-right">Frequency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.redirectionChains.slice(0, limits.redirectionChains).map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                                    <span className={clsx("px-1 py-0.5 rounded text-[10px] font-bold", 
                                                        row.start_status >= 300 && row.start_status < 400 ? "bg-amber-100 text-amber-900" : "bg-muted text-foreground")}>
                                                        {row.start_status}
                                                    </span>
                                                    <span className="truncate max-w-[200px]" title={cleanDomain + row.start_url}>
                                                        {cleanDomain}{row.start_url}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="space-y-3">
                                                {row.hop1_url && (
                                                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground pl-4 border-l-2 border-dashed border-border ml-2">
                                                        <ChevronRight className="w-3 h-3 text-rose-400" />
                                                        <span className={clsx("px-1 py-0.5 rounded text-[10px] font-bold", 
                                                            row.hop1_status >= 300 && row.hop1_status < 400 ? "bg-amber-100 text-amber-900" : (row.hop1_status === 200 ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"))}>
                                                            {row.hop1_status}
                                                        </span>
                                                        <span className="truncate max-w-[250px]" title={cleanDomain + row.hop1_url}>
                                                            {cleanDomain}{row.hop1_url}
                                                        </span>
                                                    </div>
                                                )}
                                                {row.hop2_url && (
                                                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground pl-4 border-l-2 border-dashed border-border ml-2">
                                                        <ChevronRight className="w-3 h-3 text-rose-500" />
                                                        <span className={clsx("px-1 py-0.5 rounded text-[10px] font-bold", 
                                                            row.hop2_status === 200 ? "bg-green-100 text-green-900" : (row.hop2_status >= 300 && row.hop2_status < 400 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"))}>
                                                            {row.hop2_status}
                                                        </span>
                                                        <span className="truncate max-w-[250px]" title={cleanDomain + row.hop2_url}>
                                                            {cleanDomain}{row.hop2_url}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold align-top">
                                            {Number(row.frequency).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {issues.redirectionChains.length === 0 && (
                                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No redirects detected!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 9. Sitemap Generator */}
                <div className="bg-card border border-border rounded-xl flex flex-col items-start p-6 shadow-sm justify-center text-center space-y-4 col-span-1 xl:col-span-2">
                    <div className="mx-auto bg-blue-500/10 p-4 rounded-full text-blue-500 mb-2">
                        <Download className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold w-full">XML Sitemap Generator</h3>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        Generate a pristine sitemap XML file extracted exclusively from 200 OK HTML responses in your logs. UTM parameters and error pages strictly removed.
                    </p>
                    
                    <div className="flex items-center justify-center gap-3 w-full max-w-md mx-auto pt-4">
                        <div className="flex-1 flex items-center border border-border rounded-lg px-3 overflow-hidden bg-muted/30">
                            <span className="text-muted-foreground text-sm select-none">Domain</span>
                            <input
                                type="text"
                                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-muted-foreground"
                                value={domain}
                                readOnly
                                disabled
                                title="Change the global domain from the top bar"
                                placeholder="https://www.example.com"
                            />
                        </div>
                        <button onClick={generateSitemap} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 whitespace-nowrap">
                            <Download className="w-4 h-4" /> Download XML ({issues.sitemapUrls.length})
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
