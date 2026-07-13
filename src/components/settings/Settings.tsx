
import { Trash2, Database, Info, RefreshCw } from 'lucide-react';
import { conn } from '../../lib/db';
import { getDBInfo } from '../../lib/db/queries';
import { useState, useEffect } from 'react';

export function Settings() {
    const [clearing, setClearing] = useState(false);
    const [status, setStatus] = useState("");
    const [dbInfo, setDbInfo] = useState<any>(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [skipUserTraffic, setSkipUserTraffic] = useState(localStorage.getItem('skip_user_traffic') === 'true');

    useEffect(() => {
        const loadInfo = async () => {
            try {
                const info = await getDBInfo();
                setDbInfo(info);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingInfo(false);
            }
        };
        loadInfo();
    }, []);

    const handleClearData = async () => {
        if (!confirm("Are you sure you want to delete ALL parsed logs? This cannot be undone.")) return;

        setClearing(true);
        setStatus("Releasing database locks...");
        try {
            // Terminate DuckDB first to release all active file locks on the seologanalyzer.db file
            try {
                const { db, conn } = await import('../../lib/db');
                if (conn) {
                    try { await conn.close(); } catch {}
                }
                if (db) {
                    try { await db.terminate(); } catch {}
                }
            } catch (termErr) {
                console.warn("Failed to terminate DuckDB connection:", termErr);
            }

            setStatus("Wiping database files...");
            // Attempt to delete OPFS database file directly first. 
            // This is critical to unbrick the app if DuckDB is in a fatal invalidated state.
            try {
                const dir = await navigator.storage.getDirectory();
                await dir.removeEntry('seologanalyzer.db', { recursive: true });
                console.log("OPFS database file deleted successfully");
            } catch (opfsErr) {
                console.warn("Could not delete OPFS file directly:", opfsErr);
            }

            setStatus("All logs cleared. Reloading...");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            setStatus("Error clearing data: " + (e as Error).message);
        } finally {
            setClearing(false);
        }
    };

    const handleVacuum = async () => {
        if (!conn) return;
        try {
            setStatus("Optimizing database...");
            await conn.query(`VACUUM`);
            setStatus("Database optimized successfully.");
        } catch (e) {
            setStatus("Vacuum error: " + (e as Error).message);
        }
    };

    const formatDate = (d: any) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in p-8">
            <header>
                <h2 className="text-2xl font-bold">Settings</h2>
                <p className="text-muted-foreground">Manage your local data and preferences.</p>
            </header>

            {/* DB Info */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-medium">Database Information</h3>
                    <button onClick={() => { setLoadingInfo(true); getDBInfo().then(i => { setDbInfo(i); setLoadingInfo(false); }); }}
                        className="ml-auto text-muted-foreground hover:text-foreground">
                        <RefreshCw className={`w-4 h-4 ${loadingInfo ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {loadingInfo ? (
                    <div className="text-sm text-muted-foreground animate-pulse">Loading DB stats...</div>
                ) : dbInfo ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Total Rows', value: Number(dbInfo.total_rows).toLocaleString() },
                            { label: 'Log Files', value: Number(dbInfo.total_files).toLocaleString() },
                            { label: 'Memory Limit', value: '2.0 GB' },
                            { label: 'Spill-to-Disk', value: 'Enabled (OPFS)' },
                            { label: 'Earliest Entry', value: formatDate(dbInfo.earliest) },
                            { label: 'Latest Entry', value: formatDate(dbInfo.latest) },
                        ].map(s => (
                            <div key={s.label} className="p-3 bg-muted/30 rounded-lg">
                                <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-1">{s.label}</div>
                                <div className="font-mono font-bold whitespace-nowrap overflow-hidden text-ellipsis">{s.value}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No data loaded yet.</p>
                )}
                <button onClick={handleVacuum} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                    Optimize Database (VACUUM)
                </button>
            </div>

            {/* Parser Info */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-lg font-medium">Parser Configuration</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { name: 'Apache Combined', desc: 'Standard Apache access logs' },
                        { name: 'Nginx Access', desc: 'Default Nginx log format' },
                        { name: 'IIS W3C', desc: 'IIS with standard W3C fields' },
                        { name: 'JSON Logs', desc: 'Structured JSON log lines' },
                        { name: 'Common Log Format', desc: 'CLF / NCSA format' },
                        { name: 'GZIP Compressed', desc: '.gz files auto-decompressed' },
                        { name: 'Excel / CSV', desc: '.xlsx, .xls, .csv files' },
                        { name: 'Heuristic Fallback', desc: 'Auto-detect unknown formats' },
                    ].map(f => (
                        <div key={f.name} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                            <div>
                                <div className="text-sm font-medium">{f.name}</div>
                                <div className="text-xs text-muted-foreground">{f.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    Supports 80+ bot fingerprints including Googlebot, Bingbot, AI crawlers (GPTBot, Claude, Perplexity), SEO tools (Ahrefs, Semrush, Screaming Frog) and monitoring agents.
                </p>
            </div>

            {/* About */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-medium">About Log Prism</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Version <strong className="text-foreground">0.2.1 — Performance Edition</strong></p>
                    <p>Powered by <strong className="text-foreground">DuckDB WASM</strong> — all data stays 100% local in your browser.</p>
                    <p>Optimized for <strong className="text-foreground">3-5GB log files</strong> with automated memory spill-to-disk (OPFS).</p>
                    <p>Built for SEO professionals who need fast, private log analysis without third-party data tracking.</p>
                </div>
            </div>

            {/* Import Preferences */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-medium">Import Preferences</h3>
                </div>
                <div className="flex items-center justify-between p-4 border border-border bg-muted/20 rounded-lg">
                    <div>
                        <div className="font-medium">Ignore All User Traffic (Highly Recommended)</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            Exclude standard browser user hits entirely. Only imports search engine crawlers and SEO bots.
                            Reduces database size by 95%+ and prevents Out of Memory crashes on massive logs.
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={skipUserTraffic} 
                            onChange={(e) => {
                                setSkipUserTraffic(e.target.checked);
                                localStorage.setItem('skip_user_traffic', e.target.checked ? 'true' : 'false');
                            }}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div>
                    <h3 className="text-lg font-medium text-red-500 flex items-center gap-2">
                        <Trash2 className="w-5 h-5" />
                        Danger Zone
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Actions here permanently delete data and cannot be undone.
                    </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-300/50 bg-red-500/5 rounded-lg">
                    <div>
                        <div className="font-medium text-red-400">Clear All Log Data</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            Deletes all parsed rows from DuckDB and clears OPFS persistent storage.
                        </div>
                    </div>
                    <button
                        onClick={handleClearData}
                        disabled={clearing}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0 ml-4"
                    >
                        {clearing ? "Deleting..." : "Delete All Data"}
                    </button>
                </div>

                {status && (
                    <p className="text-sm font-mono text-center text-muted-foreground bg-muted/30 rounded-lg py-2 px-4">{status}</p>
                )}
            </div>
        </div>
    );
}
