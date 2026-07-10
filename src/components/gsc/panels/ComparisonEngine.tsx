import { useState, useEffect } from 'react';
import { getPinToPinComparison } from '../../../lib/db/gscQueries';
import { Search, TrendingUp, TrendingDown, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../../../lib/exportUtils';

export const ComparisonEngine = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [brandRegex, setBrandRegex] = useState('');
    const [localRegex, setLocalRegex] = useState('');

    useEffect(() => {
        loadData();
    }, [brandRegex]);

    const loadData = async () => {
        setLoading(true);
        try {
            const results = await getPinToPinComparison(brandRegex);
            setData(results);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Pin-to-Pin Comparison</h3>
                    <p className="text-sm text-muted-foreground">Compare Query + Page combos across Week 1 vs Week 2.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Brand Regex Filter (e.g. brand|bnd)" 
                            value={localRegex}
                            onChange={(e) => setLocalRegex(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setBrandRegex(localRegex)}
                            className="bg-background border border-border pl-9 pr-4 py-1.5 rounded-md text-sm w-64"
                        />
                    </div>
                    <button onClick={() => setBrandRegex(localRegex)} className="bg-secondary text-secondary-foreground text-sm px-3 py-1.5 rounded-md">
                        Filter
                    </button>
                    <button onClick={() => exportToExcel('comparison', data)} className="bg-green-600/10 text-green-600 hover:bg-green-600/20 text-sm px-3 py-1.5 rounded-md flex items-center gap-2" title="Export Excel">
                        <FileSpreadsheet className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-medium">Query</th>
                                <th className="px-4 py-3 font-medium">Page Path</th>
                                <th className="px-4 py-3 font-medium cursor-pointer">Clicks (A → B)</th>
                                <th className="px-4 py-3 font-medium">Imp (A → B)</th>
                                <th className="px-4 py-3 font-medium">Pos (A → B)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading comparison...</td></tr>}
                            {!loading && data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No matches found between groups. Make sure you uploaded both A and B.</td></tr>}
                            {!loading && data.map((row, idx) => {
                                const clickDiff = row.click_diff;
                                const isPos = clickDiff > 0;
                                
                                return (
                                    <tr key={idx} className="hover:bg-muted/30">
                                        <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={row.query}>{row.query}</td>
                                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={row.page}>{row.page.replace(/https?:\/\/[^\/]+/, '')}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <span>{row.clicks_a} → {row.clicks_b}</span>
                                                {clickDiff !== 0 && (
                                                    <span className={`text-xs px-2 py-0.5 rounded flex items-center ${isPos ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                                        {isPos ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                        {Math.abs(clickDiff)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.imp_a} → {row.imp_b}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.pos_a?.toFixed(1) || '-'} → {row.pos_b?.toFixed(1) || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                    Showing top {data.length} absolute movers.
                </div>
            </div>
        </div>
    );
};
