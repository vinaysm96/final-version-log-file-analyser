import { useState, useEffect } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { queryLogs, getStats } from '../../lib/db';
import type { LogFilter } from '../../lib/db';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

export const LogExplorer = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<LogFilter>({ limit: 50, offset: 0 });

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await queryLogs(filter);
            setLogs(data);
            const s = await getStats();
            setStats(s);
        } catch (e) {
            console.error("Failed to load logs", e);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'xlsx') => {
        setLoading(true);
        try {
            // Fetch all matching rows for export (limit set to -1 for unlimited)
            const exportData = await queryLogs({ ...filter, limit: -1, offset: 0 });
            if (!exportData || exportData.length === 0) return;
            
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Logs");
            
            XLSX.writeFile(wb, `seo_logs_export.${format}`);
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filter]); // separate strict deps later

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header / Stats */}
            <div className="p-6 border-b border-border space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Log Explorer</h2>
                    <div className="flex space-x-2">
                        <button onClick={() => handleExport('csv')} className="px-3 py-1 text-sm border border-border rounded flex items-center gap-2 hover:bg-muted" title="Export as CSV">
                            <Download className="w-3 h-3" /> CSV
                        </button>
                        <button onClick={() => handleExport('xlsx')} className="px-3 py-1 text-sm border border-border rounded flex items-center gap-2 hover:bg-muted" title="Export as Excel">
                            <Download className="w-3 h-3" /> Excel
                        </button>
                        <button onClick={loadData} className="px-3 py-1 text-sm border border-border rounded hover:bg-muted">Refresh</button>
                    </div>
                </div>

                {stats && (
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-card rounded-lg border border-border">
                            <div className="text-muted-foreground text-xs uppercase font-bold">Total Hits</div>
                            <div className="text-2xl font-mono">{Number(stats.total_hits).toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-card rounded-lg border border-border">
                            <div className="text-muted-foreground text-xs uppercase font-bold">Unique IPs</div>
                            <div className="text-2xl font-mono">{Number(stats.unique_ips).toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-card rounded-lg border border-border">
                            <div className="text-muted-foreground text-xs uppercase font-bold">Unique URLs</div>
                            <div className="text-2xl font-mono">{Number(stats.unique_urls).toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-card rounded-lg border border-border">
                            <div className="text-muted-foreground text-xs uppercase font-bold">Avg Size</div>
                            <div className="text-2xl font-mono">{Math.round(Number(stats.avg_size) / 1024)} KB</div>
                        </div>
                    </div>
                )}

                {/* Filters Bar */}
                <div className="flex gap-4 items-center bg-muted/30 p-2 rounded-lg border border-border">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search URL or User Agent..."
                            className="w-full bg-background border border-border rounded pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setFilter({ ...filter, search: e.currentTarget.value })
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                            className="bg-background border border-border rounded px-3 py-2 text-sm"
                            onChange={(e) => setFilter({ ...filter, statusCodes: e.target.value ? [parseInt(e.target.value)] : undefined })}
                        >
                            <option value="">All Status</option>
                            <option value="200">200 OK</option>
                            <option value="301">301 Redirect</option>
                            <option value="404">404 Not Found</option>
                            <option value="500">500 Error</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground sticky top-0 z-10 border-b border-border">
                        <tr>
                            <th className="px-6 py-3 font-medium">Time (UTC)</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Method</th>
                            <th className="px-6 py-3 font-medium w-1/3">URL</th>
                            <th className="px-6 py-3 font-medium w-1/4">User Agent</th>
                            <th className="px-6 py-3 font-medium text-right">Size</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    {loading ? "Loading logs..." : "No logs found. Upload some data first!"}
                                </td>
                            </tr>
                        ) : (
                            logs.map((log, i) => (
                                <tr key={i} className="hover:bg-muted/50 group">
                                    <td className="px-6 py-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-2">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-xs font-bold",
                                            log.status >= 500 ? "bg-red-500/20 text-red-400" :
                                                log.status >= 400 ? "bg-orange-500/20 text-orange-400" :
                                                    log.status >= 300 ? "bg-blue-500/20 text-blue-400" :
                                                        "bg-green-500/20 text-green-400"
                                        )}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-2 font-mono text-xs">{log.method}</td>
                                    <td className="px-6 py-2 max-w-xs truncate" title={log.url}>{log.url}</td>
                                    <td className="px-6 py-2 max-w-xs truncate text-xs text-muted-foreground" title={log.user_agent}>
                                        {log.user_agent}
                                    </td>
                                    <td className="px-6 py-2 text-right font-mono text-xs">
                                        {log.size}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-border bg-card flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Showing {logs.length} rows</span>
                <div className="flex gap-2">
                    <button
                        disabled={filter.offset === 0}
                        onClick={() => setFilter({ ...filter, offset: Math.max(0, (filter.offset || 0) - (filter.limit || 50)) })}
                        className="px-3 py-1 border border-border rounded disabled:opacity-50 hover:bg-muted"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setFilter({ ...filter, offset: (filter.offset || 0) + (filter.limit || 50) })}
                        className="px-3 py-1 border border-border rounded hover:bg-muted"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};
