import { useEffect, useState } from 'react';
import { getInconsistentStats, getOrphanStats, getErrorStats, getSitemapURLs, getRobotsSuggestions } from '../../lib/db/seoQueries';
import { AlertCircle, FileWarning, GitFork, CheckCircle2, Download, Bot } from 'lucide-react';
import clsx from 'clsx';

export function SEOReports() {
    const [issues, setIssues] = useState<{
        caseIssues: any[];
        slashIssues: any[];
        orphans: any[];
        errors: any[];
        sitemapUrls: any[];
        robotsSuggestions: any[];
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [domain, setDomain] = useState("https://www.jainuniversity.ac.in");

    const generateSitemap = () => {
        if (!issues || issues.sitemapUrls.length === 0) return;
        
        const cleanDomain = domain.replace(/\/+$/, ''); // Prevent double slashes
        
        const xmlBody = issues.sitemapUrls.map(u => {
            const date = u.lastmod ? new Date(u.lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const cleanUrl = u.clean_url.startsWith('/') ? u.clean_url : `/${u.clean_url}`;
            return `  <url>\n    <loc>${cleanDomain}${cleanUrl}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlBody}\n</urlset>`;

            
        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "sitemap.xml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const generateRobotsTxt = () => {
        if (!issues || issues.robotsSuggestions.length === 0) return;
        const txt = issues.robotsSuggestions.map(row => `Disallow: /*?${row.param_name}=`).join('\n');
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "robots.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportPanelCSV = (title: string, data: any[], format: 'flat' | 'nested' = 'flat') => {
        if (!data || data.length === 0) return;
        let csv = '';
        if (format === 'flat') {
            const headers = Object.keys(data[0]);
            csv = headers.join(',') + '\n';
            csv += data.map(row => headers.map(h => `"${(row[h]||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
        } else if (format === 'nested') {
            csv = 'Base URL,Variants\n';
            csv += data.map(row => `"${row.clean_url}","${(row.variants || []).join(' | ')}"`).join('\n');
        }
        
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

    useEffect(() => {
        const load = async () => {
            try {
                const [inconsistent, orphans, errors, sitemapUrls, robotsSuggestions] = await Promise.all([
                    getInconsistentStats(),
                    getOrphanStats(),
                    getErrorStats(),
                    getSitemapURLs(),
                    getRobotsSuggestions()
                ]);
                
                // Ensure array types for variants to prevent map() crashes
                const safeVariants = (v: any) => Array.isArray(v) ? v : (v && typeof v.forEach === 'function' ? Array.from(v) : (typeof v === 'string' ? [v] : []));
                
                setIssues({
                    caseIssues: inconsistent.caseIssues.map(i => ({...i, variants: safeVariants(i.variants)})),
                    slashIssues: inconsistent.slashIssues.map(i => ({...i, variants: safeVariants(i.variants)})),
                    orphans,
                    errors,
                    sitemapUrls,
                    robotsSuggestions
                });
            } catch (e: any) {
                console.error("Audit DB Error:", e);
                setErrorMsg(e.message || String(e));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="p-8 text-center animate-pulse">Running SEO Audits...</div>;
    if (errorMsg) return <div className="p-8 text-center text-red-500 max-w-2xl mx-auto"><h3 className="font-bold text-xl mb-4">SEO Audit Query Failed</h3><div className="p-4 bg-muted font-mono text-sm text-left whitespace-pre-wrap">{errorMsg}</div></div>;
    if (!issues) return <div className="p-8 text-center">No audit data</div>;

    const hasIssues = issues.caseIssues.length > 0 || issues.slashIssues.length > 0 || issues.errors.length > 0;

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
                            <h3 className="font-semibold">Top Errors (4xx/5xx)</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{issues.errors.length} URLs</span>
                            <button onClick={() => exportPanelCSV("top_errors", issues.errors)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
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
                                {issues.errors.map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={row.url}>{row.url}</td>
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

                {/* 2. Slash Inconsistencies */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <GitFork className="w-4 h-4 text-amber-500" />
                            <h3 className="font-semibold">Slash Consistency</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">{issues.slashIssues.length} groups</span>
                            <button onClick={() => exportPanelCSV("slash_consistency", issues.slashIssues, "nested")} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                        </div>
                    </div>
                    <div className="p-4 text-sm text-muted-foreground bg-amber-50/50 border-b border-amber-100 dark:bg-transparent dark:border-border">
                        URLs accessed both with and without trailing slashes. This causes duplicate content issues.
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <ul className="divide-y divide-border">
                            {issues.slashIssues.map((row, i) => (
                                <li key={i} className="p-4 hover:bg-muted/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono text-xs text-muted-foreground mb-1">Base: {row.clean_url}</div>
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
                            <button onClick={() => exportPanelCSV("case_sensitivity", issues.caseIssues, "nested")} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <ul className="divide-y divide-border">
                            {issues.caseIssues.map((row, i) => (
                                <li key={i} className="p-4 hover:bg-muted/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono text-xs text-muted-foreground mb-1">Normalized: {row.clean_url}</div>
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
                        <button onClick={() => exportPanelCSV("orphaned_pages", issues.orphans)} className="text-muted-foreground hover:text-white" title="Export CSV"><Download className="w-4 h-4"/></button>
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
                                {issues.orphans.map((row, i) => (
                                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                                        <td className="px-4 py-2 truncate max-w-[200px]" title={row.url}>{row.url}</td>
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
                                {issues.robotsSuggestions.map((row, i) => (
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

                {/* 6. Sitemap Generator */}
                <div className="bg-card border border-border rounded-xl flex flex-col items-start p-6 shadow-sm justify-center text-center space-y-4 col-span-1 xl:col-span-2">
                    <div className="mx-auto bg-blue-500/10 p-4 rounded-full text-blue-500 mb-2">
                        <Download className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold w-full">XML Sitemap Generator</h3>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        Generate a pristine sitemap XML file extracted exclusively from 200 OK HTML responses in your logs. UTM parameters and error pages strictly removed.
                    </p>
                    
                    <div className="flex items-center justify-center gap-3 w-full max-w-md mx-auto pt-4">
                        <div className="flex-1 flex items-center border border-border rounded-lg px-3 overflow-hidden">
                            <span className="text-muted-foreground text-sm select-none">Domain</span>
                            <input
                                type="text"
                                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-2"
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                                placeholder="https://www.jainuniversity.ac.in"
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
