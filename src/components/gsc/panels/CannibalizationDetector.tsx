import { useState, useEffect } from 'react';
import { getCannibalization } from '../../../lib/db/gscQueries';
import { Skull, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../../../lib/exportUtils';

export const CannibalizationDetector = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const results = await getCannibalization('Group B');
            setData(results);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    let prevQuery = '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Skull className="w-5 h-5 text-red-500" /> Cannibalization Detector
                    </h3>
                    <p className="text-sm text-muted-foreground">Queries where multiple URLs are ranking in Group B.</p>
                </div>
                <button onClick={() => exportToExcel('cannibalization', data)} className="bg-green-600/10 text-green-600 hover:bg-green-600/20 text-sm px-3 py-1.5 rounded-md flex items-center gap-2" title="Export Excel">
                    <FileSpreadsheet className="w-4 h-4" /> Export
                </button>
            </div>

            <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-medium">Cannibalized Query</th>
                                <th className="px-4 py-3 font-medium">Competing Pages</th>
                                <th className="px-4 py-3 font-medium">Clicks</th>
                                <th className="px-4 py-3 font-medium">Impressions</th>
                                <th className="px-4 py-3 font-medium">Position</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Detecting conflicts...</td></tr>}
                            {!loading && data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No cannibalization detected!</td></tr>}
                            {!loading && data.map((row, idx) => {
                                const isNewQueryGroup = row.query !== prevQuery;
                                prevQuery = row.query;
                                
                                return (
                                    <tr key={idx} className={`hover:bg-muted/30 ${isNewQueryGroup ? 'border-t-2 border-border' : ''}`}>
                                        <td className="px-4 py-2 font-medium max-w-[200px] truncate">
                                            {isNewQueryGroup ? row.query : ''}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-mono max-w-[300px] truncate" title={row.page}>
                                            <span className="bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                                {row.page.replace(/https?:\/\/[^\/]+/, '') || '/'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-semibold text-primary">{row.clicks}</td>
                                        <td className="px-4 py-2">{row.impressions}</td>
                                        <td className="px-4 py-2">{row.position?.toFixed(1) || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
