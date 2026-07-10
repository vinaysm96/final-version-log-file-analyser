import { useEffect, useState } from 'react';
import { getTopIPs, getSuspiciousIPs } from '../../lib/db/queries';
import { Shield, AlertTriangle, Globe, Activity, Download } from 'lucide-react';
import clsx from 'clsx';

interface IPProps { domain?: string }

export const IPIntelligence = ({ }: IPProps) => {
    const [topIPs, setTopIPs] = useState<any[]>([]);
    const [suspiciousIPs, setSuspiciousIPs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'top' | 'suspicious'>('top');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [top, susp] = await Promise.all([getTopIPs(), getSuspiciousIPs()]);
                setTopIPs(top);
                setSuspiciousIPs(susp);
            } catch (e: any) {
                console.error(e);
                setError(e.message || String(e));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const exportCSV = (data: any[], name: string) => {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${name}.csv` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const getBotTypeBadge = (type: string) => {
        const map: Record<string, string> = {
            search_engine: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
            ai_bot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
            seo_tool: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
            monitoring: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
            social: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
            user: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
            unknown: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        };
        return map[type] || 'bg-gray-100 text-gray-700';
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading IP Intelligence...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-mono">Error loading IP Intelligence: {error}</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            <header>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Globe className="w-6 h-6 text-cyan-500" />
                    IP Intelligence
                </h2>
                <p className="text-muted-foreground mt-1">Identify top requestors, suspicious IPs, and crawl patterns.</p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Total Unique IPs</div>
                    <div className="text-2xl font-bold">{topIPs.length.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Suspicious IPs</div>
                    <div className="text-2xl font-bold text-red-500">{suspiciousIPs.length.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Top IP Hits</div>
                    <div className="text-2xl font-bold text-blue-400">{topIPs[0]?.hits?.toLocaleString() ?? '—'}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Top IP</div>
                    <div className="text-sm font-mono font-bold truncate">{topIPs[0]?.ip ?? '—'}</div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 border-b border-border">
                {[{ id: 'top', label: 'Top IPs', icon: Activity }, { id: 'suspicious', label: 'Suspicious IPs', icon: AlertTriangle }].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as 'top' | 'suspicious')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                            activeTab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                        <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                            {t.id === 'top' ? topIPs.length : suspiciousIPs.length}
                        </span>
                    </button>
                ))}
            </div>

            {activeTab === 'top' && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <h3 className="font-semibold">Top IPs by Request Volume</h3>
                        </div>
                        <button onClick={() => exportCSV(topIPs, 'top_ips')} className="text-muted-foreground hover:text-white" title="Export CSV">
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">IP Address</th>
                                    <th className="px-4 py-3 text-left">Bot</th>
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-right">Hits</th>
                                    <th className="px-4 py-3 text-right">Unique URLs</th>
                                    <th className="px-4 py-3 text-right">Errors</th>
                                    <th className="px-4 py-3 text-right">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {topIPs.map((ip, i) => (
                                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{ip.ip}</td>
                                        <td className="px-4 py-3 text-xs">{ip.bot_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={clsx('px-2 py-0.5 rounded-full text-xs', getBotTypeBadge(ip.bot_type))}>
                                                {ip.bot_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-medium">{Number(ip.hits).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">{Number(ip.unique_urls).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={Number(ip.error_hits) > 0 ? 'text-red-500' : 'text-muted-foreground'}>
                                                {Number(ip.error_hits).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                                            {ip.last_seen ? new Date(ip.last_seen).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {topIPs.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No IP data available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'suspicious' && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-red-500/10">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <h3 className="font-semibold text-red-400">Suspicious IPs</h3>
                        </div>
                        <button onClick={() => exportCSV(suspiciousIPs, 'suspicious_ips')} className="text-muted-foreground hover:text-white" title="Export CSV">
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4 text-sm text-muted-foreground bg-red-50/30 dark:bg-red-900/5 border-b border-border">
                        IPs classified as unknown bots or those generating a high rate of 4xx/5xx errors. Consider blocking in <code className="bg-muted px-1 rounded">robots.txt</code> or server firewall.
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">IP Address</th>
                                    <th className="px-4 py-3 text-left">Bot Fingerprint</th>
                                    <th className="px-4 py-3 text-right">Hits</th>
                                    <th className="px-4 py-3 text-right">URLs Hit</th>
                                    <th className="px-4 py-3 text-right">Error Rate</th>
                                    <th className="px-4 py-3 text-right">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {suspiciousIPs.map((ip, i) => (
                                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-red-400">{ip.ip}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{ip.bot_name}</td>
                                        <td className="px-4 py-3 text-right font-mono">{Number(ip.hits).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">{Number(ip.unique_urls).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={clsx(
                                                'font-mono text-xs px-1.5 py-0.5 rounded',
                                                Number(ip.error_rate) > 50 ? 'bg-red-100 text-red-700' :
                                                Number(ip.error_rate) > 20 ? 'bg-orange-100 text-orange-700' :
                                                'text-muted-foreground'
                                            )}>
                                                {ip.error_rate}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                                            {ip.last_seen ? new Date(ip.last_seen).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {suspiciousIPs.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">✅ No suspicious IPs detected. Your logs look clean!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Block List Generator */}
            {suspiciousIPs.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-500" />
                        Nginx/Apache Block List Generator
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Copy these rules into your Nginx or Apache config to block suspicious IPs.
                    </p>
                    <div className="bg-black rounded-lg p-4 overflow-auto max-h-56 font-mono text-xs text-green-400 space-y-1">
                        <div className="text-gray-500"># Nginx — paste inside server {"{ }"}</div>
                        {suspiciousIPs.slice(0, 20).map((ip, i) => (
                            <div key={i}>deny {ip.ip};</div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            const rules = suspiciousIPs.slice(0, 20).map(ip => `deny ${ip.ip};`).join('\n');
                            navigator.clipboard.writeText(rules);
                        }}
                        className="mt-3 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                    >
                        Copy Block Rules
                    </button>
                </div>
            )}
        </div>
    );
};
