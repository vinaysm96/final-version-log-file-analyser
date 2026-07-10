const fs = require('fs');

let c = fs.readFileSync('src/components/analytics/SEOReports.tsx', 'utf8');

c = c.replace(
    'const [loading, setLoading] = useState(true);',
    `const [loading, setLoading] = useState(true);
    const [limits, setLimits] = useState<Record<string, number>>({
        errors: 100, serverErrors: 100, slashIssues: 100, caseIssues: 100, 
        orphans: 100, robotsSuggestions: 100, topCrawled: 100, crawlBudget: 100, redirectionChains: 100
    });
    const loadMore = (k: string) => setLimits(p => ({...p, [k]: p[k] + 500}));`
);

const r = [
    { k: 'errors', c: 5, t: 'table' },
    { k: 'serverErrors', c: 5, t: 'table' },
    { k: 'slashIssues', t: 'ul' },
    { k: 'caseIssues', t: 'ul' },
    { k: 'orphans', c: 4, t: 'table' },
    { k: 'robotsSuggestions', c: 3, t: 'table' },
    { k: 'topCrawled', c: 3, t: 'table' },
    { k: 'crawlBudget', c: 3, t: 'table' },
    { k: 'redirectionChains', c: 3, t: 'table' }
];

for (let a of r) {
    if (c.includes(`issues.${a.k}.slice(0, 100)`)) {
        c = c.split(`issues.${a.k}.slice(0, 100)`).join(`issues.${a.k}.slice(0, limits.${a.k})`);
    }

    if (a.t === 'table') {
        const targetOld = `</tbody>
                        </table>`;
        const targetNew = `</tbody>
                            <tfoot className="bg-muted/10">
                                {issues.${a.k}.length > limits.${a.k} && (
                                    <tr>
                                        <td colSpan={${a.c}} className="p-3 text-center border-t border-border">
                                            <button onClick={() => loadMore('${a.k}')} className="text-xs text-blue-500 hover:text-blue-600 font-medium">Load More (Displaying {limits.${a.k}} of {issues.${a.k}.length})</button>
                                        </td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>`;
        c = c.replace(targetOld, targetNew);
    } else {
        const targetOld = `</ul>
                    </div>`;
        const targetNew = `</ul>
                        {issues.${a.k}.length > limits.${a.k} && (
                            <div className="p-3 text-center border-t border-border bg-muted/10">
                                <button onClick={() => loadMore('${a.k}')} className="text-xs text-blue-500 hover:text-blue-600 font-medium">Load More (Displaying {limits.${a.k}} of {issues.${a.k}.length})</button>
                            </div>
                        )}
                    </div>`;
        c = c.replace(targetOld, targetNew);
    }
}

fs.writeFileSync('src/components/analytics/SEOReports.tsx', c);
console.log('Patched');
