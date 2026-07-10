import { useState, useEffect } from 'react';
import { getOpportunities } from '../../../lib/db/gscQueries';
import { Zap, AlertTriangle, Ghost, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../../../lib/exportUtils';

export const OpportunityFinder = () => {
    const [data, setData] = useState<any>({ quickWins: [], ctrIssues: [], deadWeight: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const results = await getOpportunities('Group B'); // Always check newest data
            setData(results);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const renderTable = (rows: any[], title: string, desc: string, icon: any, colorClass: string) => {
        const Icon = icon;
        return (
            <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col max-h-[400px]">
                <div className="p-4 border-b border-border bg-muted/30">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold flex items-center gap-2">
                            <Icon className={`w-5 h-5 ${colorClass}`} />
                            {title} <span className="text-xs bg-background px-2 py-0.5 rounded-full border">{rows.length}</span>
                        </h4>
                        <button onClick={() => exportToExcel(title, rows)} className="text-muted-foreground hover:text-green-600 transition-colors" title="Export Excel">
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div className="overflow-auto hidden xl:block flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-muted/10 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 font-medium">Query</th>
                                <th className="px-4 py-2 font-medium">Impressions</th>
                                <th className="px-4 py-2 font-medium">Position</th>
                                <th className="px-4 py-2 font-medium">CTR</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((r, i) => (
                                <tr key={i} className="hover:bg-muted/30">
                                    <td className="px-4 py-2" title={r.page}>
                                        <div className="font-medium truncate max-w-[150px]">{r.query}</div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{r.page.replace(/https?:\/\/[^\/]+/, '')}</div>
                                    </td>
                                    <td className="px-4 py-2">{r.impressions}</td>
                                    <td className="px-4 py-2 font-mono">{r.position.toFixed(1)}</td>
                                    <td className="px-4 py-2">{(r.ctr * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-muted-foreground text-xs">No opportunities found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h3 className="text-lg font-bold">Opportunity Finder</h3>
                <p className="text-sm text-muted-foreground">Automated insights based on your recent (Group B) data.</p>
            </div>
            
            {loading ? (
                <div className="p-8 text-center">Loading opportunities...</div>
            ) : (
                <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                    {renderTable(
                        data.quickWins, 
                        "Quick Wins", 
                        "Position 5-15, High Impressions. Easy to boost.", 
                        Zap, 
                        "text-yellow-500"
                    )}
                    {renderTable(
                        data.ctrIssues, 
                        "CTR Fixes", 
                        "High Impressions, Page 1, CTR < 2%. Need title/meta updates.", 
                        AlertTriangle, 
                        "text-orange-500"
                    )}
                    {renderTable(
                        data.deadWeight, 
                        "Dead Weight", 
                        "High Impressions, Position > 20. Needs major rewrite.", 
                        Ghost, 
                        "text-slate-400"
                    )}
                </div>
            )}
        </div>
    );
};
