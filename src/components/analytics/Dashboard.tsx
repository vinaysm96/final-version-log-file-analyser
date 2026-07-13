import React, { useEffect, useState } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
    getOverviewStats, getBotStats, getStatusCodeStats, getTimeSeriesData,
    getBotPaths, getBotActivityTimetable, getBotTypeBreakdown, getHourlyHeatmap,
    type OverviewStats
} from '../../lib/db/queries';
import { FileText, Zap, Activity, ChevronDown, ChevronUp, Clock, Link as LinkIcon, Users, Bot, Globe, TrendingUp, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const COLORS = ['#0088FE', '#22c55e', '#FFBB28', '#FF8042', '#a855f7', '#06b6d4', '#f43f5e', '#84cc16'];
const BOT_TYPE_COLORS: Record<string, string> = {
    'User': '#22c55e',
    'Search Engine': '#0088FE',
    'AI Bot': '#a855f7',
    'SEO Tool': '#FFBB28',
    'Social Media': '#f43f5e',
    'Monitoring': '#06b6d4',
    'Unknown': '#6b7280',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const Dashboard = ({ domain = "" }: { domain?: string }) => {
    const cleanDomain = domain.replace(/\/+$/, '');
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [botStats, setBotStats] = useState<any[]>([]);
    const [botTypeBreakdown, setBotTypeBreakdown] = useState<any[]>([]);
    const [statusStats, setStatusStats] = useState<any[]>([]);
    const [timeData, setTimeData] = useState<any[]>([]);
    const [heatmap, setHeatmap] = useState<any[]>([]);
    const [timetable, setTimetable] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedBot, setExpandedBot] = useState<string | null>(null);
    const [botPaths, setBotPaths] = useState<any[]>([]);
    const [timeInterval, setTimeInterval] = useState<'hour' | 'day'>('day');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [overview, bots, typeBreak, status, time, schedule, heat] = await Promise.all([
                    getOverviewStats(),
                    getBotStats(),
                    getBotTypeBreakdown(),
                    getStatusCodeStats(),
                    getTimeSeriesData(timeInterval),
                    getBotActivityTimetable(),
                    getHourlyHeatmap(),
                ]);
                setStats(overview);
                setBotStats(bots);
                setBotTypeBreakdown(typeBreak);
                setStatusStats(status);
                setHeatmap(heat);
                setTimetable(schedule);

                const processedTime = time.reduce((acc: any[], curr: any) => {
                    const date = curr.date.split('T')[0];
                    const existing = acc.find(a => a.date === date);
                    if (existing) {
                        existing[curr.bot_type] = (existing[curr.bot_type] || 0) + curr.hits;
                    } else {
                        const newEntry: any = { date, search_engine: 0, user: 0, seo_tool: 0, ai_bot: 0 };
                        newEntry[curr.bot_type] = curr.hits;
                        acc.push(newEntry);
                    }
                    return acc;
                }, []);
                setTimeData(processedTime);
            } catch (e: any) {
                console.error(e);
                setError(e.message || String(e));
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [timeInterval]);

    const toggleBotRow = async (botName: string) => {
        if (expandedBot === botName) { setExpandedBot(null); return; }
        setExpandedBot(botName);
        setBotPaths([]);
        try {
            const paths = await getBotPaths(botName);
            setBotPaths(paths);
        } catch (e) { console.error(e); }
    };

    // Build heatmap matrix
    const heatmapMatrix = DAYS.map((_, dow) =>
        HOURS.map(hour => heatmap.find(h => h.dow === dow && h.hour === hour)?.hits || 0)
    );
    const maxHeat = Math.max(1, ...heatmap.map(h => h.hits));

    if (loading) return (
        <div className="p-8 text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground animate-pulse">Analyzing logs...</p>
        </div>
    );
    if (error) return (
        <div className="p-8 text-center text-red-500 max-w-2xl mx-auto space-y-6">
            <h3 className="font-bold text-2xl">Dashboard Loading Failed</h3>
            <div className="p-4 bg-muted border border-border rounded-xl font-mono text-sm text-left text-foreground whitespace-pre-wrap">{error}</div>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-left">
                <strong>Memory limit exceeded.</strong> This occurs when importing extremely large logs without filtering, running out of browser RAM. You can clear the database files below to start fresh.
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
    if (!stats) return <div className="p-8 text-center">No data available</div>;

    const kpis = [
        { label: 'Total Requests', value: stats.total_hits.toLocaleString(), icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Unique URLs', value: stats.unique_urls.toLocaleString(), icon: Globe, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { label: 'Unique IPs', value: stats.unique_ips.toLocaleString(), icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
        { label: 'Total Bandwidth', value: `${(stats.total_bandwidth / 1024 / 1024).toFixed(2)} MB`, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { label: 'Avg Response Time', value: `${Math.round(stats.avg_response_time)} ms`, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
        { label: 'Error Rate', value: `${stats.error_rate}%`, icon: AlertCircle, color: stats.error_rate > 10 ? 'text-red-500' : 'text-orange-500', bg: stats.error_rate > 10 ? 'bg-red-500/10' : 'bg-orange-500/10' },
        { label: 'Bot Traffic', value: `${stats.bot_rate}%`, icon: Bot, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Bot Types', value: botTypeBreakdown.length.toString(), icon: TrendingUp, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between pb-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{kpi.label}</h3>
                            <div className={clsx('p-2 rounded-lg', kpi.bg)}>
                                <kpi.icon className={clsx('h-4 w-4', kpi.color)} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts Row 1: Traffic + Bot Type Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold">Traffic Over Time</h3>
                        <div className="flex gap-1 bg-muted rounded-lg p-1">
                            {(['day', 'hour'] as const).map(i => (
                                <button
                                    key={i}
                                    onClick={() => setTimeInterval(i)}
                                    className={clsx('px-3 py-1 text-xs rounded font-medium transition-colors', timeInterval === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                                >
                                    {i === 'day' ? 'Daily' : 'Hourly'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={timeData}>
                            <defs>
                                <linearGradient id="se" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="usr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="ai" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
                            <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }} />
                            <Legend />
                            <Area type="monotone" dataKey="search_engine" stroke="#0088FE" fill="url(#se)" strokeWidth={2} name="Search Bots" />
                            <Area type="monotone" dataKey="user" stroke="#22c55e" fill="url(#usr)" strokeWidth={2} name="Users" />
                            <Area type="monotone" dataKey="ai_bot" stroke="#a855f7" fill="url(#ai)" strokeWidth={2} name="AI Bots" />
                            <Area type="monotone" dataKey="seo_tool" stroke="#FFBB28" fill="none" strokeWidth={2} strokeDasharray="5 3" name="SEO Tools" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Bot Type Donut */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Traffic Source Mix</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={botTypeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="hits" nameKey="label">
                                {botTypeBreakdown.map((entry, index) => (
                                    <Cell key={index} fill={BOT_TYPE_COLORS[entry.label] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: any) => [Number(val).toLocaleString(), 'Hits']} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                        {botTypeBreakdown.map((b, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: BOT_TYPE_COLORS[b.label] || COLORS[i % COLORS.length] }} />
                                    <span className="text-muted-foreground">{b.label}</span>
                                </div>
                                <span className="font-mono">{Number(b.hits).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Status Code Bar + Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Code Bar */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Status Code Distribution</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={statusStats} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} horizontal={false} />
                            <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis dataKey="status" type="category" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={40} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {statusStats.map((entry, i) => (
                                    <Cell key={i} fill={entry.status >= 500 ? '#ef4444' : entry.status >= 400 ? '#f59e0b' : entry.status >= 300 ? '#3b82f6' : '#22c55e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Bot Activity Heatmap */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        Bot Activity Heatmap (Hour × Day)
                    </h3>
                    {heatmap.length === 0 ? (
                        <div className="text-muted-foreground text-sm text-center py-8">Not enough timestamp data for heatmap.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="flex gap-0.5 mb-1">
                                <div className="w-8" />
                                {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                                    <div key={h} className="flex-1 text-[9px] text-muted-foreground text-center">{h}h</div>
                                ))}
                            </div>
                            {DAYS.map((day, dow) => (
                                <div key={dow} className="flex gap-0.5 mb-0.5 items-center">
                                    <div className="w-8 text-[10px] text-muted-foreground text-right pr-1">{day}</div>
                                    {HOURS.map(hour => {
                                        const val = heatmapMatrix[dow][hour];
                                        const intensity = val / maxHeat;
                                        return (
                                            <div
                                                key={hour}
                                                title={`${day} ${hour}:00 — ${val} hits`}
                                                className="flex-1 aspect-square rounded-sm transition-all hover:ring-1 hover:ring-primary"
                                                style={{
                                                    backgroundColor: val === 0 ? 'hsl(var(--muted))' :
                                                        `rgba(139, 92, 246, ${0.1 + intensity * 0.85})`
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                            <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                                <span>Low</span>
                                {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                                    <div key={v} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(139, 92, 246, ${v})` }} />
                                ))}
                                <span>High</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bot Breakdown Table */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-blue-500" />
                        Bot Breakdown
                    </h3>
                    <span className="text-xs text-muted-foreground">Click a row to drill into crawled paths</span>
                </div>
                <div className="overflow-y-auto max-h-[500px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Bot Name</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3 text-right">Hits</th>
                                <th className="px-6 py-3 text-right">Unique URLs</th>
                                <th className="px-6 py-3 text-right">Bandwidth</th>
                                <th className="px-4 py-3 text-right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {botStats.length > 0 ? botStats.map((bot, idx) => (
                                <React.Fragment key={idx}>
                                    <tr onClick={() => toggleBotRow(bot.bot_name)} className="hover:bg-muted/40 transition-colors cursor-pointer group">
                                        <td className="px-6 py-3 font-medium">{bot.bot_name}</td>
                                        <td className="px-6 py-3">
                                            <span className={clsx('px-2 py-0.5 rounded-full text-xs',
                                                bot.bot_type === 'search_engine' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                bot.bot_type === 'ai_bot' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                                bot.bot_type === 'seo_tool' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                                                bot.bot_type === 'social' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' :
                                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                            )}>
                                                {bot.bot_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">{Number(bot.hits).toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right font-mono">{Number(bot.unique_urls).toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right text-muted-foreground text-xs">
                                            {(Number(bot.bandwidth) / 1024).toFixed(1)} KB
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {expandedBot === bot.bot_name ? <ChevronUp className="w-4 h-4 inline text-muted-foreground" /> : <ChevronDown className="w-4 h-4 inline text-muted-foreground group-hover:text-foreground" />}
                                        </td>
                                    </tr>
                                    {expandedBot === bot.bot_name && (
                                        <tr className="bg-muted/10">
                                            <td colSpan={6} className="p-0">
                                                <div className="px-8 py-4 bg-black/5 dark:bg-white/3 shadow-inner">
                                                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                                                        <LinkIcon className="w-4 h-4 text-blue-500" />
                                                        Top Crawled Paths for {bot.bot_name}
                                                    </h4>
                                                    {botPaths.length === 0 ? (
                                                        <div className="text-sm text-muted-foreground py-2 animate-pulse">Loading...</div>
                                                    ) : (
                                                        <ul className="divide-y divide-border/40 border border-border/40 rounded-lg bg-background max-h-56 overflow-y-auto text-sm">
                                                            {botPaths.map((p, pIdx) => (
                                                                <li key={pIdx} className="px-4 py-2 flex justify-between hover:bg-muted/20">
                                                                    <a href={`${cleanDomain}${(p.url || '').startsWith('/') ? '' : '/'}${p.url || ''}`} target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline truncate flex-1 max-w-[70%]">
                                                                        {cleanDomain}{(p.url || '').startsWith('/') ? '' : '/'}{p.url || ''}
                                                                    </a>
                                                                    <span className="text-muted-foreground tabular-nums text-xs">
                                                                        {Number(p.hits).toLocaleString()} hits
                                                                        <span className="ml-2 opacity-50">· {new Date(p.last_crawled).toLocaleDateString()}</span>
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
                            )) : (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No bots detected yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bot Timetable */}
            {timetable.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center gap-2 bg-muted/20">
                        <Clock className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-semibold">Bot Activity Schedule</h3>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Bot Name</th>
                                    <th className="px-6 py-3">Day of Week</th>
                                    <th className="px-6 py-3 text-right">Total Hits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {timetable.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-6 py-3 font-medium text-purple-400">{row.bot_name}</td>
                                        <td className="px-6 py-3">{row.day_of_week}</td>
                                        <td className="px-6 py-3 text-right font-mono">{Number(row.hits).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
