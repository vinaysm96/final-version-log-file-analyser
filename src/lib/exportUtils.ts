import * as XLSX from 'xlsx';

export const exportToExcel = (title: string, data: any[]) => {
    if (!data || data.length === 0) return;
    
    try {
        // Flatten nested data for Excel and safely convert BigInt to Number
        const rawData = JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? Number(v) : v));
        const flattened = rawData.map((row: any) => {
            const newRow = { ...row };
            Object.keys(newRow).forEach(key => {
                if (Array.isArray(newRow[key])) {
                    newRow[key] = newRow[key].join(', ');
                }
            });
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(flattened);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        
        const dateStr = new Date().toISOString().split('T')[0];
        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `${safeTitle}_${dateStr}.xlsx`;
        
        // Generate Base64 for maximum OS/Browser filename reliability
        const b64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        
        const a = document.createElement('a');
        a.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + b64;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
    } catch (err) {
        console.error("Excel Export Error:", err);
        alert("Export failed. Detail: " + (err as Error).message);
    }
};
