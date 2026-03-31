
import { Trash2 } from 'lucide-react';
import { conn } from '../../lib/db';
import { useState } from 'react';

export function Settings() {
    const [clearing, setClearing] = useState(false);
    const [status, setStatus] = useState("");

    const handleClearData = async () => {
        if (!conn) return;
        if (!confirm("Are you sure you want to delete all parsed logs? This cannot be undone.")) return;

        setClearing(true);
        try {
            await conn.query(`DELETE FROM logs`);
            setStatus("All logs cleared successfully.");
            setTimeout(() => window.location.reload(), 1500); // Reload to reset generic states
        } catch (e) {
            setStatus("Error clearing data: " + (e as Error).message);
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in p-8">
            <header>
                <h2 className="text-2xl font-bold">Settings</h2>
                <p className="text-muted-foreground">Manage your local data and preferences.</p>
            </header>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-red-600 flex items-center gap-2">
                        <Trash2 className="w-5 h-5" />
                        Danger Zone
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Actions here can result in data loss.
                    </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <div className="space-y-1">
                        <div className="font-medium text-red-900 dark:text-red-200">Clear All Log Data</div>
                        <div className="text-xs text-red-700 dark:text-red-300">
                            Deletes all parsed rows from the in-memory DuckDB instance.
                        </div>
                    </div>
                    <button
                        onClick={handleClearData}
                        disabled={clearing}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                        {clearing ? "Deleting..." : "Delete Data"}
                    </button>
                </div>

                {status && <p className="text-sm font-mono text-center text-muted-foreground">{status}</p>}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-medium mb-4">Parser Configuration</h3>
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground mb-4">
                    The parser currently auto-detects:
                    <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                        <li>Apache Combined Log Format</li>
                        <li>Nginx Access Logs</li>
                        <li>IIS W3C Logs (Standard fields)</li>
                        <li>Common Log Format (CLF)</li>
                    </ul>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-md cursor-not-allowed opacity-50">
                        Edit Regex Patterns (Coming Soon)
                    </button>
                </div>
            </div>
        </div>
    );
}
