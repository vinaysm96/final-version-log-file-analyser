import { AppLayout } from './components/layout/AppLayout';
import { FileDropzone } from './components/upload/FileDropzone';
import { LogExplorer } from './components/explorer/LogExplorer';
import { Dashboard } from './components/analytics/Dashboard';
import { SEOReports } from './components/analytics/SEOReports';
import { LogComparison } from './components/analytics/LogComparison';
import { IPIntelligence } from './components/analytics/IPIntelligence';
import { Settings } from './components/settings/Settings';
import { GSCDashboard } from './components/gsc/GSCDashboard';
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [domain, setDomain] = useState(localStorage.getItem('seo_domain') || "https://www.example.com");
  const [uploadedDbs, setUploadedDbs] = useState<string[]>([]);
  const [activeFiles, setActiveFiles] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    localStorage.setItem('seo_domain', domain);
  }, [domain]);

  // Default skip_user_traffic to true to protect against OOM on large files
  if (localStorage.getItem('skip_user_traffic') === null) {
    localStorage.setItem('skip_user_traffic', 'true');
  }

  useEffect(() => {
    const updateDataset = async () => {
      const { updateActiveDataset } = await import('./lib/db');
      await updateActiveDataset(activeFiles);
      setRefreshTrigger(prev => prev + 1);
    };
    updateDataset();
  }, [activeFiles]);

  useEffect(() => {
    const checkPersistedData = async () => {
      try {
        const { initDB, getStats, getUploadedFiles, updateActiveDataset } = await import('./lib/db');
        await initDB();
        
        const files = await getUploadedFiles();
        setUploadedDbs(files);
        if (files.length > 0) {
            setActiveFiles(files);
            await updateActiveDataset(files);
        } else {
            await updateActiveDataset([]);
        }

        const stats = await getStats();
        if (stats && stats.total_hits > 0) {
          setTotalRows(stats.total_hits);
          setStatus(`Restored ${stats.total_hits.toLocaleString()} rows from previous session.`);
          setActiveTab('dashboard');
        }
      } catch (e) {
        // start empty
      }
    };
    checkPersistedData();
  }, []);

  const processFile = async (file: File): Promise<number> => {
    setStatus(`Reading ${file.name}...`);
    let fileRows = 0;

    try {
      const { initDB, insertLogs } = await import('./lib/db');
      await initDB();

      const { processChunk } = await import('./lib/parser/logParser');

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const { parseExcel } = await import('./lib/parser/excelParser');
        const entries = await parseExcel(file);
        if (entries.length > 0) {
          await insertLogs(entries);
          fileRows = entries.length;
        }
        return fileRows;
      }

      let stream: ReadableStream<Uint8Array>;

      if (fileName.endsWith('.gz')) {
        const ds = new DecompressionStream('gzip');
        stream = file.stream().pipeThrough(ds);
      } else {
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

        const entries = processChunk(toProcess, file.name);
        if (entries.length > 0) {
          buffer.push(...entries);
          if (buffer.length >= 5000) {
            await insertLogs(buffer);
            fileRows += buffer.length;
            setTotalRows(prev => prev + buffer.length);
            buffer = [];
          }
        }

        const currentPct = fileName.endsWith('.gz') 
            ? Math.min(99, Math.round((processedBytes / (file.size * 5)) * 100)) 
            : Math.min(99, Math.round((processedBytes / file.size) * 100));
        setStatus(`Processing ${file.name}: ${currentPct}%...`);
      }

      if (remainder.trim()) {
        const entries = processChunk(remainder, file.name);
        if (entries.length > 0) buffer.push(...entries);
      }

      if (buffer.length > 0) {
        await insertLogs(buffer);
        fileRows += buffer.length;
        setTotalRows(prev => prev + buffer.length);
      }

      if (fileRows === 0) {
        setDebugLines(["Parsed 0 valid rows. Check your log format."]);
      }

      return fileRows;
    } catch (e) {
      console.error("Error processing file:", e);
      setStatus(`Error: ${(e as Error).message}`);
      return 0;
    }
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    setDebugLines([]);
    setFiles(prev => [...prev, ...newFiles]);
    setProcessing(true);
    let totalImported = 0;

    for (const file of newFiles) {
      const rows = await processFile(file);
      totalImported += rows;
    }

    setProcessing(false);

    const { getUploadedFiles } = await import('./lib/db');
    const allFiles = await getUploadedFiles();
    setUploadedDbs(allFiles);
    setActiveFiles(allFiles);

    if (totalImported === 0) {
      setStatus(prev => prev.startsWith('Error') ? prev : "Error: No valid log lines found. Check format.");
    } else {
      setStatus(`Done! Imported ${totalImported.toLocaleString()} rows.`);
      setTimeout(() => setActiveTab('dashboard'), 1000);
    }
  };

  const GlobalSettingsBar = () => (
    <div className="bg-card/80 backdrop-blur-sm border-b border-border shadow-sm px-6 py-2.5 flex items-center gap-4 z-10 sticky top-0">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Domain:</span>
            <input 
                type="text" 
                value={domain} 
                onChange={e => setDomain(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="https://www.example.com"
            />
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-xs">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Active Logs:</span>
            <select 
                multiple
                value={activeFiles}
                onChange={(e) => setActiveFiles(Array.from(e.target.selectedOptions).map(o => o.value))}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs max-h-[34px]"
            >
                {uploadedDbs.map(d => (
                    <option key={d} value={d}>{d}</option>
                ))}
            </select>
            {uploadedDbs.length > 1 && <div className="text-[10px] text-muted-foreground whitespace-nowrap">Ctrl+click multi</div>}
        </div>
        {totalRows > 0 && (
            <div className="text-xs text-muted-foreground ml-auto font-mono">
                <span className="text-foreground font-bold">{totalRows.toLocaleString()}</span> rows loaded
            </div>
        )}
        <button 
            onClick={() => window.location.reload()} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg border border-border transition-all ml-auto hover:scale-[1.02] active:scale-[0.98]"
            title="Reload application state"
        >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh App
        </button>
    </div>
  );

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <GlobalSettingsBar />
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 h-full overflow-auto">
        {activeTab === 'upload' && (
          <>
            <header>
              <h2 className="text-3xl font-bold tracking-tight">Data Intake</h2>
              <p className="text-muted-foreground mt-2">
                Upload raw access logs to generate SEO insights. All data is processed locally — nothing leaves your device.
              </p>
            </header>

            <section className="space-y-4">
              {/* Skip user traffic toggle directly on Data Intake page */}
              <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Ignore All User Traffic (Highly Recommended)
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Excludes standard user hits (like images, JS, CSS, fonts, and browser page views). Only imports search bots.
                    This reduces the database size by **95%+**, preventing browser memory crashes on large files.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={localStorage.getItem('skip_user_traffic') !== 'false'} 
                    onChange={(e) => {
                      localStorage.setItem('skip_user_traffic', e.target.checked ? 'true' : 'false');
                      setRefreshTrigger(prev => prev + 1); // trigger state update
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <FileDropzone onFilesSelected={handleFilesSelected} isProcessing={processing} />

              {files.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex justify-between items-center">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      Upload Queue <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{files.length}</span>
                    </h3>
                    {status && (
                      <span className={`text-xs font-mono px-2 py-1 rounded ${status.startsWith('Error') ? 'text-red-400 bg-red-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                        {status} {totalRows > 0 && `| ${totalRows.toLocaleString()} rows`}
                      </span>
                    )}
                  </div>
                  <ul className="divide-y divide-border">
                    {files.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="px-4 py-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500/70 animate-pulse" />
                          {file.name}
                        </span>
                        <span className="text-muted-foreground text-xs font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {debugLines.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 mt-4 text-sm text-red-800 dark:text-red-200">
                  <h4 className="font-semibold mb-2">Parser Diagnosis</h4>
                  <p className="mb-3 opacity-90 text-xs">
                    Could not parse these lines. Ensure file is a valid log (Nginx/Apache/IIS/JSON) or CSV/Excel.
                  </p>
                  <div className="bg-black/5 p-3 rounded overflow-x-auto font-mono text-xs whitespace-pre">
                    {debugLines.map((line, i) => (
                      <div key={i} className="border-b border-black/5 pb-1 mb-1 last:border-0">{i + 1}: {line.substring(0, 200)}</div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'dashboard' && <Dashboard key={refreshTrigger} domain={domain} />}
        {activeTab === 'explorer' && <LogExplorer key={refreshTrigger} domain={domain} />}
        {activeTab === 'reports' && <SEOReports key={refreshTrigger} domain={domain} />}
        {activeTab === 'ip' && <IPIntelligence key={refreshTrigger} domain={domain} />}
        {activeTab === 'compare' && <LogComparison key={refreshTrigger} domain={domain} />}
        {activeTab === 'gsc' && <GSCDashboard key={refreshTrigger} />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </AppLayout>
  );
}

export default App;
