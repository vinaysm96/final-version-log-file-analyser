import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseGSCCSV } from '../../lib/gsc/gscParser';
import { insertGSCLogs } from '../../lib/db';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    onUploadComplete: () => void;
}

export const GSCUpload = ({ onUploadComplete }: Props) => {
    const [status, setStatus] = useState<string>('');
    const [groupAFile, setGroupAFile] = useState<File | null>(null);
    const [groupBFile, setGroupBFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);

    const onDropA = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) setGroupAFile(acceptedFiles[0]);
    }, []);

    const onDropB = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) setGroupBFile(acceptedFiles[0]);
    }, []);

    const { getRootProps: getRootPropsA, getInputProps: getInputPropsA } = useDropzone({ onDrop: onDropA, accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] } });
    const { getRootProps: getRootPropsB, getInputProps: getInputPropsB } = useDropzone({ onDrop: onDropB, accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] } });

    const handleProcess = async () => {
        if (!groupAFile && !groupBFile) return;
        setProcessing(true);
        setStatus('Parsing CSV files...');
        
        try {
            if (groupAFile) {
                setStatus(`Parsing ${groupAFile.name}...`);
                const dataA = await parseGSCCSV(groupAFile);
                setStatus(`Inserting ${dataA.length} rows into Group A...`);
                await insertGSCLogs(dataA, 'Group A');
            }
            if (groupBFile) {
                setStatus(`Parsing ${groupBFile.name}...`);
                const dataB = await parseGSCCSV(groupBFile);
                setStatus(`Inserting ${dataB.length} rows into Group B...`);
                await insertGSCLogs(dataB, 'Group B');
            }
            setStatus('Import complete!');
            setTimeout(() => onUploadComplete(), 1000);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
        setProcessing(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-bold mb-1">GSC Pin-to-Pin Engine</h3>
                <p className="text-sm text-muted-foreground mb-6">
                    Upload your Google Search Console datasets. For comparison, upload your older data as Group A (Baseline), and newer data as Group B (Recent).
                </p>

                <div className="grid grid-cols-2 gap-6">
                    {/* Group A */}
                    <div {...getRootPropsA()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${groupAFile ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <input {...getInputPropsA()} />
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                            {groupAFile ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <UploadCloud className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <h4 className="font-semibold mb-1">Group A (Baseline)</h4>
                        <p className="text-xs text-muted-foreground font-mono truncate px-4">
                            {groupAFile ? groupAFile.name : 'Drop Week 1 CSV or XLSX here'}
                        </p>
                    </div>

                    {/* Group B */}
                    <div {...getRootPropsB()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${groupBFile ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <input {...getInputPropsB()} />
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                            {groupBFile ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <UploadCloud className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <h4 className="font-semibold mb-1">Group B (Recent)</h4>
                        <p className="text-xs text-muted-foreground font-mono truncate px-4">
                            {groupBFile ? groupBFile.name : 'Drop Week 2 CSV or XLSX here'}
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <div className="text-sm font-medium flex items-center gap-2">
                        {status && (
                            <span className={`px-3 py-1 rounded-full text-xs ${status.includes('Error') ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {status.includes('Error') ? <AlertCircle className="w-3 h-3 inline mr-1" /> : null}
                                {status}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleProcess}
                        disabled={(!groupAFile && !groupBFile) || processing}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? 'Processing...' : 'Run Analysis'}
                    </button>
                </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200">
                <h4 className="font-semibold mb-1 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                    <AlertCircle className="w-4 h-4" /> Data Requirement
                </h4>
                <p className="opacity-90">
                    Your CSV must contain both <code className="font-bold">Query</code> and <code className="font-bold">Page</code> columns for the comparison and cannibalization engines to work. Standard GSC exports usually require a plugin or API connection to extract both simultaneously.
                </p>
            </div>
        </div>
    );
};
