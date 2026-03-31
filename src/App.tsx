import { AppLayout } from './components/layout/AppLayout';
import { FileDropzone } from './components/upload/FileDropzone';
import { LogExplorer } from './components/explorer/LogExplorer';
import { Dashboard } from './components/analytics/Dashboard';
import { SEOReports } from './components/analytics/SEOReports';
import { Settings } from './components/settings/Settings';
import { useState, useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  useEffect(() => {
    const checkPersistedData = async () => {
      try {
        const { initDB, getStats } = await import('./lib/db');
        await initDB();
        const stats = await getStats();
        if (stats && stats.total_hits > 0) {
          setTotalRows(stats.total_hits);
          setStatus(`Restored ${stats.total_hits.toLocaleString()} rows from previous session.`);
          setActiveTab('dashboard');
        }
      } catch (e) {
        // Ignoring error, start empty
      }
    };
    checkPersistedData();
  }, []);

  const processFile = async (file: File): Promise<number> => {
    setStatus(`Reading ${file.name}...`);
    let fileRows = 0;

    try {
      // Initialize DB
      const { initDB, insertLogs } = await import('./lib/db');
      await initDB();

      const { processChunk } = await import('./lib/parser/logParser');

      // Check file type
      const fileName = file.name.toLowerCase();

      // Excel/CSV handling
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const { parseExcel } = await import('./lib/parser/excelParser');
        const entries = await parseExcel(file);
        if (entries.length > 0) {
          await insertLogs(entries);
          fileRows = entries.length;
        }
        return fileRows;
      }

      // Stream processing for huge files
      let stream: ReadableStream<Uint8Array>;

      if (fileName.endsWith('.gz')) {
        const ds = new DecompressionStream('gzip');
        stream = file.stream().pipeThrough(ds);
      } else {
        // Check for binary/GZIP without extension by reading first 2 bytes
        const headerBlob = file.slice(0, 2);
        const headerBuffer = await headerBlob.arrayBuffer();
        const view = new Uint8Array(headerBuffer);
        if (view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b) {
          setStatus("This file appears to be GZIP compressed. Please rename it with .gz extension.");
          return 0;
        }
        stream = file.stream();
      }

      const textStream = stream.pipeThrough(new TextDecoderStream() as any);
      const reader = textStream.getReader();

      let remainder = '';
      let processedBytes = 0;
      let buffer: any[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const valStr = value as string;
        processedBytes += valStr.length; 
        const chunk = remainder + valStr;
        const lastNewline = chunk.lastIndexOf('\n');
        
        let toProcess: string;
        
        if (lastNewline !== -1) {
          toProcess = chunk.substring(0, lastNewline);
          remainder = chunk.substring(lastNewline + 1);
        } else {
          remainder = chunk;
          continue;
        }

        const entries = processChunk(toProcess);
        if (entries.length > 0) {
          buffer.push(...entries);
          
          if (buffer.length >= 50000) {
            await insertLogs(buffer);
            fileRows += buffer.length;
            setTotalRows(prev => prev + buffer.length);
            buffer = [];
          }
        }

        const currentPct = fileName.endsWith('.gz') 
            ? Math.min(99, Math.round((processedBytes / (file.size * 5)) * 100)) 
            : Math.min(99, Math.round((processedBytes / file.size) * 100));
        
        setStatus(`Processing ${file.name}: ${currentPct}% ...`);
      }

      // Process remainder
      if (remainder.trim()) {
        const entries = processChunk(remainder);
        if (entries.length > 0) {
          buffer.push(...entries);
        }
      }

      // Flush remaining buffer
      if (buffer.length > 0) {
        await insertLogs(buffer);
        fileRows += buffer.length;
        setTotalRows(prev => prev + buffer.length);
      }

      // Debug: if no rows parsed, just show raw string state
      if (fileRows === 0) {
        setDebugLines(["Parsed 0 valid rows."]);
      }

      return fileRows;
    } catch (e) {
      console.error("Error processing file:", e);
      setStatus(`Error: ${(e as Error).message}`);
      return 0;
    }
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    setDebugLines([]); // Clear previous debug
    setFiles(prev => [...prev, ...newFiles]);
    setProcessing(true);
    let totalImported = 0;

    for (const file of newFiles) {
      const rows = await processFile(file);
      totalImported += rows;
    }

    setProcessing(false);

    if (totalImported === 0) {
      setStatus(prev => prev.startsWith('Error') ? prev : "Error: No valid log lines found. Check format.");
    } else {
      setStatus(`Done! Imported ${totalImported.toLocaleString()} rows.`);
      setTimeout(() => setActiveTab('dashboard'), 1000);
    }
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 h-full">
        {activeTab === 'upload' && (
          <>
            <header>
              <h2 className="text-3xl font-bold tracking-tight">Data Intake</h2>
              <p className="text-muted-foreground mt-2">
                Upload your raw access logs to generate SEO insights. No data leaves your device.
              </p>
            </header>

            <section className="space-y-4">
              <FileDropzone onFilesSelected={handleFilesSelected} isProcessing={processing} />

              {files.length > 0 && (
                <div className="bg-card border border-border rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex justify-between items-center">
                    <h3 className="font-medium text-sm">Upload Queue ({files.length})</h3>
                    {status && <span className="text-xs text-blue-400 font-mono">{status} | {totalRows.toLocaleString()} rows</span>}
                  </div>
                  <ul className="divide-y divide-border">
                    {files.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="px-4 py-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500/50"></span>
                          {file.name}
                        </span>
                        <span className="text-muted-foreground text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {debugLines.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4 mt-4 text-sm text-red-800 dark:text-red-200">
                  <h4 className="font-semibold mb-2">Parser Diagnosis</h4>
                  <p className="mb-3 opacity-90">
                    Could not parse these lines. Ensure file is a valid log (Nginx/Apache/IIS/JSON) or CSV/Excel.
                  </p>
                  <div className="bg-black/5 p-3 rounded overflow-x-auto font-mono text-xs whitespace-pre mb-4">
                    {debugLines.map((line, i) => (
                      <div key={i} className="border-b border-black/5 pb-1 mb-1 last:border-0">{i + 1}: {line.substring(0, 200)}</div>
                    ))}
                  </div>

                  <h4 className="font-semibold mb-2">Hex Dump (First 100 chars)</h4>
                  <p className="opacity-75 mb-2 text-xs">Check for "" or strange codes at the start.</p>
                  <div className="bg-black text-green-400 p-3 rounded overflow-x-auto font-mono text-xs leading-relaxed">
                    {debugLines[0] && debugLines[0].substring(0, 50).split('').map((c, i) => {
                      const code = c.charCodeAt(0);
                      return (
                        <span key={i} className="inline-block mr-1 mb-1 border border-green-900/50 p-0.5" title={`Char: ${c} Code: ${code}`}>
                          <div className="text-center opacity-50 text-[10px]">{code.toString(16).toUpperCase().padStart(2, '0')}</div>
                          <div className="text-center font-bold text-white min-w-[12px]">{code < 32 ? '.' : c}</div>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'explorer' && <LogExplorer />}
        {activeTab === 'reports' && <SEOReports />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </AppLayout>
  );
}

export default App;
