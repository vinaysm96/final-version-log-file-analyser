import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { queryLogs, getStats } from '../../lib/db';
import type { LogFilter } from '../../lib/db';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

const STATUS_OPTIONS = [
    { label: 'All Status', value: '' },
    { label: '2xx Success', value: '2xx' },
    { label: '3xx Redirect', value: '3xx' },
    { label: '4xx Client Error', value: '4xx' },
    { label: '5xx Server Error', value: '5xx' },
    { label: '200 OK', value: '200' },
    { label: '301 Moved', value: '301' },
    { label: '302 Found', value: '302' },
    { label: '304 Not Modified', value: '304' },
    { label: '404 Not Found', value: '404' },
    { label: '403 Forbidden', value: '403' },
    { label: '500 Server Error', value: '500' },
];

const METHOD_OPTIONS = [
    { label: 'All Methods', value: '' },
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'HEAD', value: 'HEAD' },
    { label: 'PUT', value: 'PUT' },
    { label: 'DELETE', value: 'DELETE' },
    { label: 'OPTIONS', value: 'OPTIONS' },
    { label: 'PATCH', value: 'PATCH' },
];

const PAGE_SIZES = [25, 50, 100, 250, 500];

export const LogExplorer = ({ domain = "" }: { domain?: string }) => {
    const cleanDomain = domain.replace(/\/+$/, '');
    const [logs, setLogs] = useState<any[]>([]);
    const [totalStats, setTotalStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Separate filter state from query trigger
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [botFilter, setBotFilter] = useState('');
    const [pageSize, setPageSize] = useState(50);
    const [offset, setOffset] = useState(0);

    // Build query filter from current state
    const buildFilter = useCallback((): LogFilter => {
        const f: LogFilter = { limit: pageSize, offset };

        // Search input (URL or IP or UA)
        if (searchInput.trim()) f.search = searchInput.trim();

        // Override search with bot filter if bot filter is set
        if (botFilter.trim() && !searchInput.trim()) f.search = botFilter.trim();

        // Status filter
        if (statusFilter) {
            if (statusFilter === '2xx') f.statusRange = [200, 299];
            else if (statusFilter === '3xx') f.statusRange = [300, 399];
            else if (statusFilter === '4xx') f.statusRange = [400, 499];
            else if (statusFilter === '5xx') f.statusRange = [500, 599];
            else f.statusCodes = [parseInt(statusFilter)];
        }

        if (methodFilter) f.methods = [methodFilter];

        return f;
    }, [searchInput, statusFilter, methodFilter, botFilter, pageSize, offset]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const f = buildFilter();
            const [data, s] = await Promise.all([queryLogs(f), getStats()]);
            setLogs(data);
            setTotalStats(s);
        } catch (e: any) {
            console.error("Failed to load logs", e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [buildFilter]);

    // Reload when pagination changes
    useEffect(() => {
        loadData();
    }, [offset, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

    const applyFilters = () => {
        setOffset(0);
        // trigger via loadData directly since offset may not change
        setLoading(true);
        const f: LogFilter = { limit: pageSize, offset: 0 };
        if (searchInput.trim()) f.search = searchInput.trim();
        if (botFilter.trim() && !searchInput.trim()) f.search = botFilter.trim();
        if (statusFilter) {
            if (statusFilter === '2xx') f.statusRange = [200, 299];
            else if (statusFilter === '3xx') f.statusRange = [300, 399];
            else if (statusFilter === '4xx') f.statusRange = [400, 499];
            else if (statusFilter === '5xx') f.statusRange = [500, 599];
            else f.statusCodes = [parseInt(statusFilter)];
        }
        if (methodFilter) f.methods = [methodFilter];
        queryLogs(f).then(data => {
            setLogs(data);
        }).catch(e => {
            console.error(e);
            setLogs([]);
        }).finally(() => {
            setLoading(false);
        });
    };

    const clearFilters = () => {
        setSearchInput('');
        setStatusFilter('');
        setMethodFilter('');
        setBotFilter('');
        setOffset(0);
    };

    const handleExport = async (format: 'csv' | 'xlsx') => {
        setExporting(true);
        try {
            const f = buildFilter();
            const exportData = await queryLogs({ ...f, limit: -1, offset: 0 });
            if (!exportData || exportData.length === 0) return;
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Logs");
            XLSX.writeFile(wb, `seo_logs_export.${format}`);
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setExporting(false);
        }
    };

    const hasActiveFilters = searchInput || statusFilter || methodFilter || botFilter;
    const currentPage = Math.floor(offset / pageSize) + 1;

    const statusBadge = (status: number) => clsx(
        'px-2 py-0.5 rounded text-xs font-bold tabular-nums',
        status >= 500 ? 'bg-red-500/20 text-red-400' :
        status >= 400 ? 'bg-orange-500/20 text-orange-400' :
        status >= 300 ? 'bg-blue-500/20 text-blue-400' :
        'bg-green-500/20 text-green-400'
    );

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Log Explorer</h2>
                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setOffset(0); }}
                            className="bg-background border border-border rounded px-2 py-1 text-sm"
                        >
                            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
                        </select>
                        <button onClick={() => handleExport('csv')} disabled={exporting}
                            className="px-3 py-1.5 text-sm border border-border rounded flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-50">
                            <Download className="w-3.5 h-3.5" /> CSV
                        </button>
                        <button onClick={() => handleExport('xlsx')} disabled={exporting}
                            className="px-3 py-1.5 text-sm border border-border rounded flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-50">
                            <Download className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button onClick={loadData}
                            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors flex items-center gap-1.5">
                            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                {totalStats && (
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total Hits', value: Number(totalStats.total_hits).toLocaleString() },
                            { label: 'Unique IPs', value: Number(totalStats.unique_ips).toLocaleString() },
                            { label: 'Unique URLs', value: Number(totalStats.unique_urls).toLocaleString() },
                            { label: 'Avg Size', value: `${Math.round(Number(totalStats.avg_size) / 1024)} KB` },
                        ].map(s => (
                            <div key={s.label} className="p-3 bg-card rounded-lg border border-border">
                                <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wide">{s.label}</div>
                                <div className="text-xl font-bold font-mono">{s.value}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search URL, IP or User Agent... (Enter)"
                            className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyFilters()}
                        />
                    </div>

                    <select value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); }}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <select value={methodFilter}
                        onChange={e => { setMethodFilter(e.target.value); }}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                        {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <input
                        type="text"
                        placeholder="Bot name..."
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-36"
                        value={botFilter}
                        onChange={e => setBotFilter(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    />

                    <button onClick={applyFilters}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5" /> Apply
                    </button>

                    {hasActiveFilters && (
                        <button onClick={clearFilters}
                            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/80 text-muted-foreground sticky top-0 z-10 border-b border-border backdrop-blur-sm">
                        <tr>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide whitespace-nowrap">Timestamp</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Status</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Method</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide w-1/4">URL</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Bot / Agent</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">IP</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Size</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Source</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {loading ? (
                            Array.from({ length: 12 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 bg-muted rounded" style={{ width: `${40 + Math.random() * 60}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                                    <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                    <div>No logs found.</div>
                                    <div className="text-xs mt-1">{hasActiveFilters ? 'Try adjusting your filters.' : 'Upload some data first!'}</div>
                                </td>
                            </tr>
                        ) : (
                            logs.map((log, i) => (
                                <tr key={i} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={statusBadge(log.status)}>{log.status}</span>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">{log.method}</td>
                                    <td className="px-4 py-2 max-w-xs truncate" title={log.url || ''}>
                                        <a href={`${cleanDomain}${(log.url || '').startsWith('/') ? '' : '/'}${log.url || ''}`}
                                            target="_blank" rel="noreferrer" className="hover:text-blue-400 hover:underline">
                                            {log.url || '/'}
                                        </a>
                                    </td>
                                    <td className="px-4 py-2 max-w-[180px]">
                                        {log.bot_name && log.bot_name !== 'User' ? (
                                            <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded whitespace-nowrap">{log.bot_name}</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground truncate block" title={log.user_agent}>{log.user_agent}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{log.ip}</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                                        {log.size ? `${(Number(log.size) / 1024).toFixed(1)} KB` : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[100px]" title={log.file_name}>
                                        {log.file_name}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-border bg-card flex justify-between items-center text-sm shrink-0">
                <span className="text-muted-foreground text-xs">
                    Page {currentPage} · Showing {logs.length} of {Number(totalStats?.total_hits || 0).toLocaleString()} total
                </span>
                <div className="flex gap-1">
                    <button
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - pageSize))}
                        className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors flex items-center gap-1"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <button
                        disabled={logs.length < pageSize}
                        onClick={() => setOffset(offset + pageSize)}
                        className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors flex items-center gap-1"
                    >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
