import Papa from 'papaparse';
import { read, utils } from 'xlsx';

export interface GSCDataRow {
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    file_name: string;
}

export const parseGSCCSV = async (file: File): Promise<GSCDataRow[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const arrayBuffer = await file.arrayBuffer();
                const wb = read(arrayBuffer);
                const ws = wb.Sheets[wb.SheetNames[0]];
                const jsonData = utils.sheet_to_json(ws);
                const data = processJSONData(jsonData, file.name);
                resolve(data);
                return;
            }

            // Fallback to PapaParse for standard CSVs
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = processJSONData(results.data, file.name);
                    resolve(data);
                },
                error: (error) => {
                    reject(error);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
};

const processJSONData = (rows: any[], fileName: string): GSCDataRow[] => {
    const data: GSCDataRow[] = [];
    rows.forEach((row: any) => {
        // Try to map columns resiliently and cast to string to prevent numeric cell errors
        const rawQuery = row['Top queries'] || row['Query'] || row['query'] || row['Keys'] || '';
        const query = String(rawQuery).trim().toLowerCase();
        
        const rawPage = row['Top pages'] || row['Page'] || row['page'] || '';
        let page = String(rawPage).trim();
        
        // URL Normalization: Remove standard tracking params and trailing slash
        if (page) {
            try {
                const url = new URL(page);
                url.searchParams.delete('utm_source');
                url.searchParams.delete('utm_medium');
                url.searchParams.delete('utm_campaign');
                page = url.toString();
                if (page.endsWith('/')) {
                    page = page.slice(0, -1);
                }
            } catch (e) {
                if (page.includes('?utm')) {
                    page = page.split('?utm')[0];
                }
                if (page.endsWith('/')) {
                    page = page.slice(0, -1);
                }
            }
        }

        const clicks = parseInt(row['Clicks'] || row['clicks'] || '0', 10) || 0;
        const impressions = parseInt(row['Impressions'] || row['impressions'] || '0', 10) || 0;
        let ctr = parseFloat(row['CTR'] || row['ctr'] || '0') || 0;
        if (typeof row['CTR'] === 'string' && row['CTR'].includes('%')) {
            ctr = parseFloat(row['CTR'].replace('%', '')) / 100;
        }
        const position = parseFloat(row['Position'] || row['position'] || '0') || 0;

        if (query || page) { 
            data.push({
                query,
                page,
                clicks,
                impressions,
                ctr,
                position,
                file_name: fileName
            });
        }
    });
    return data;
}
