import React, { useEffect, useState } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { getOverviewStats, getBotStats, getStatusCodeStats, getTimeSeriesData, getBotPaths, getBotActivityTimetable, type OverviewStats } from '../../lib/db/queries';
import { FileText, Zap, Activity, ChevronDown, ChevronUp, Clock, Link as LinkIcon } from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [botStats, setBotStats] = useState<any[]>([]);
    const [statusStats, setStatusStats] = useState<any[]>([]);
    const [timeData, setTimeData] = useState<any[]>([]);
    const [timetable, setTimetable] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [expandedBot, setExpandedBot] = useState<string | null>(null);
    const [botPaths, setBotPaths] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [overview, bots, status, time, schedule] = await Promise.all([
                    getOverviewStats(),
                    getBotStats(),
                    getStatusCodeStats(),
                    getTimeSeriesData(),
                    getBotActivityTimetable()
                ]);
                setStats(overview);
                setBotStats(bots);
                setStatusStats(status);
                setTimetable(schedule);

                // Process time data
                const processedTime = time.reduce((acc: any[], curr: any) => {
                    const date = curr.date.split('T')[0];
                    const existing = acc.find(a => a.date === date);
                    if (existing) {
                        existing[curr.bot_type] = (existing[curr.bot_type] || 0) + curr.hits;
                        existing.search_engine = (existing.search_engine || 0) + (curr.bot_type === 'search_engine' ? curr.hits : 0);
                        existing.user = (existing.user || 0) + (curr.bot_type === 'user' ? curr.hits : 0);
                        existing.seo_tool = (existing.seo_tool || 0) + (curr.bot_type === 'seo_tool' ? curr.hits : 0);
                    } else {
                        const newEntry = { date, search_engine: 0, user: 0, seo_tool: 0 };
                        // @ts-ignore
                        newEntry[curr.bot_type] = curr.hits;
                        // @ts-ignore
                        if (curr.bot_type === 'search_engine') newEntry.search_engine = curr.hits;
                        // @ts-ignore
                        if (curr.bot_type === 'user') newEntry.user = curr.hits;
                        // @ts-ignore
                        if (curr.bot_type === 'seo_tool') newEntry.seo_tool = curr.hits;

                        acc.push(newEntry);
                    }
                    return acc;
                }, []);
                setTimeData(processedTime);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const toggleBotRow = async (botName: string) => {
        if (expandedBot === botName) {
            setExpandedBot(null);
            return;
        }
        setExpandedBot(botName);
        setBotPaths([]); // set empty while loading
        try {
            const paths = await getBotPaths(botName);
            setBotPaths(paths);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Analyzing logs...</div>;
    if (!stats) return <div className="p-8 text-center">No data available</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Total Lines Processed</h3>
                        <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-2xl font-bold">{stats.total_hits.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Unique URLs</h3>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">{stats.unique_urls.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Total Bandwidth</h3>
                        <Zap className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold">{(stats.total_bandwidth / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Avg Response Time</h3>
                        <Activity className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">{Math.round(stats.avg_response_time)} ms</div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-6">Traffic Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timeData}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="search_engine" stroke="#0088FE" strokeWidth={2} name="Search Bots" />
                            <Line type="monotone" dataKey="user" stroke="#82ca9d" strokeWidth={2} name="Users" />
                            <Line type="monotone" dataKey="seo_tool" stroke="#FFBB28" strokeWidth={2} name="SEO Tools" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-6">Status Code Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={statusStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="count"
                                nameKey="status"
                            >
                                {statusStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.status >= 500 ? '#ef4444' : entry.status >= 400 ? '#f59e0b' : entry.status >= 300 ? '#3b82f6' : '#22c55e'} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Timetable & Bot Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bot Timetable */}
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                    <div className="p-6 border-b border-border flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-semibold">Bot Activity Timetable</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Bot Name</th>
                                    <th className="px-6 py-3">Day of Week</th>
                                    <th className="px-6 py-3 text-right">Total Hits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {timetable.length > 0 ? timetable.map((timeRow, idx) => (
                                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-purple-500 dark:text-purple-400">{timeRow.bot_name}</td>
                                        <td className="px-6 py-3">{timeRow.day_of_week}</td>
                                        <td className="px-6 py-3 text-right">{Number(timeRow.hits).toLocaleString()}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">Not enough data to calculate bot schedules.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bot Table Activity Breakdown */}
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                    <div className="p-6 border-b border-border flex justify-between items-center">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            General Bot Breakdown
                        </h3>
                        <span className="text-xs text-muted-foreground">Click a row to see URLs</span>
                    </div>
                    <div className="overflow-y-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Bot Name</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3 text-right">Hits</th>
                                    <th className="px-6 py-3 text-right">Unique URLs</th>
                                    <th className="px-6 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {botStats.length > 0 ? botStats.map((bot, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr 
                                            onClick={() => toggleBotRow(bot.bot_name)}
                                            className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4 font-medium">{bot.bot_name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs ${bot.bot_type === 'search_engine' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                        bot.bot_type === 'seo_tool' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                    }`}>
                                                    {bot.bot_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">{Number(bot.hits).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">{Number(bot.unique_urls).toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right">
                                                {expandedBot === bot.bot_name ? 
                                                    <ChevronUp className="w-4 h-4 inline-block text-muted-foreground" /> : 
                                                    <ChevronDown className="w-4 h-4 inline-block text-muted-foreground group-hover:text-foreground" />
                                                }
                                            </td>
                                        </tr>
                                        {expandedBot === bot.bot_name && (
                                            <tr className="bg-muted/10 border-b border-border">
                                                <td colSpan={5} className="p-0">
                                                    <div className="px-8 py-4 space-y-3 bg-black/5 dark:bg-white/5 shadow-inner">
                                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                                            <LinkIcon className="w-4 h-4" /> Top Crawled Paths targets for {bot.bot_name}
                                                        </h4>
                                                        {botPaths.length === 0 ? (
                                                            <div className="text-sm text-muted-foreground py-2 animate-pulse">Loading paths...</div>
                                                        ) : (
                                                            <div className="max-h-64 overflow-y-auto border border-border/50 rounded-lg bg-background">
                                                                <ul className="divide-y divide-border/50 text-sm">
                                                                    {botPaths.map((p, pIdx) => (
                                                                        <li key={pIdx} className="px-4 py-2 flex justify-between hover:bg-muted/30">
                                                                            <span className="truncate flex-1 max-w-[70%]" title={p.url}>{p.url}</span>
                                                                            <span className="text-muted-foreground tabular-nums text-xs">
                                                                                {Number(p.hits).toLocaleString()} hits 
                                                                                <span className="ml-2 text-[10px] opacity-50">Last: {new Date(p.last_crawled).toLocaleDateString()}</span>
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No bots detected yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
