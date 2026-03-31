import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import clsx from 'clsx';

interface FileDropzoneProps {
    onFilesSelected: (files: File[]) => void;
    isProcessing?: boolean;
}

export const FileDropzone = ({ onFilesSelected, isProcessing = false }: FileDropzoneProps) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFilesSelected(acceptedFiles);
        }
    }, [onFilesSelected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled: isProcessing,
        // Removed 'accept' property to make it flexible for any file type (e.g., ext-less files or random mime types).
    });
    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={clsx(
                    "relative group cursor-pointer flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300",
                    isDragActive
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:border-blue-500/50 hover:bg-muted/50",
                    isProcessing && "opacity-50 cursor-not-allowed"
                )}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center p-6 text-center space-y-4">
                    <div className={clsx(
                        "p-4 rounded-full transition-colors",
                        isDragActive ? "bg-blue-500/20 text-blue-500" : "bg-muted text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-500"
                    )}>
                        <UploadCloud className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                        <p className="text-lg font-semibold">
                            {isDragActive ? "Drop logs here" : "Drag & drop log files"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Drag any log file, .csv, excel, or .gz (Apache, Nginx, IIS support)
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Create a dummy file and pass it up
                        const dummyContent = `
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:00:00 +0000] "GET / HTTP/1.1" 200 1200 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:00:01 +0000] "GET /about HTTP/1.1" 200 500 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:00:02 +0000] "GET /contact HTTP/1.1" 404 120 "-" "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)"
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:00:05 +0000] "GET /products/1 HTTP/1.1" 200 2300 "-" "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:01:00 +0000] "GET /wp-admin HTTP/1.1" 403 0 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
127.0.0.1 - - [${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/').replace(',', '')}:10:02:00 +0000] "GET /old-page HTTP/1.1" 301 0 "-" "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"
                        `.trim();

                        // Generate more data
                        let content = dummyContent;
                        for (let i = 0; i < 500; i++) {
                            content += '\n' + dummyContent;
                        }

                        const file = new File([content], "demo_data.log", { type: "text/plain" });
                        onFilesSelected([file]);
                    }}
                    className="text-sm text-blue-500 hover:underline cursor-pointer"
                >
                    Try with Demo Data
                </button>
            </div>
        </div>
    );
};
