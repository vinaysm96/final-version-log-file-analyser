import { useState } from 'react';
import { GSCUpload } from './GSCUpload';
import { ComparisonEngine } from './panels/ComparisonEngine';
import { OpportunityFinder } from './panels/OpportunityFinder';
import { CannibalizationDetector } from './panels/CannibalizationDetector';

export const GSCDashboard = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'compare' | 'opportunities' | 'cannibalization'>('upload');

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="px-8 py-6 border-b border-border bg-card/50">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">GSC Data Analyzer</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Analyze, compare, and extract insights from Search Console exports.
                        </p>
                    </div>
                    <div className="flex bg-muted/50 p-1 rounded-lg">
                        {[
                            { id: 'upload', label: 'Data Intake' },
                            { id: 'compare', label: 'Comparison' },
                            { id: 'opportunities', label: 'Opportunities' },
                            { id: 'cannibalization', label: 'Cannibalization' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === t.id 
                                        ? 'bg-background shadow-sm text-foreground' 
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-8">
                {activeTab === 'upload' && <GSCUpload onUploadComplete={() => setActiveTab('compare')} />}
                {activeTab === 'compare' && <ComparisonEngine />}
                {activeTab === 'opportunities' && <OpportunityFinder />}
                {activeTab === 'cannibalization' && <CannibalizationDetector />}
            </main>
        </div>
    );
};
