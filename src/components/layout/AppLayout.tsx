import { LayoutDashboard, FileText, Settings, UploadCloud, PieChart } from 'lucide-react';
import clsx from 'clsx';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg",
                active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-white"
            )}
        >
            <Icon className="w-5 h-5 mr-3" />
            {label}
        </button>
    );
};

interface AppLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const AppLayout = ({ children, activeTab, onTabChange }: AppLayoutProps) => {
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Log Prism
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">SEO Log Analyzer</p>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <SidebarItem
                        icon={UploadCloud}
                        label="Data Intake"
                        active={activeTab === 'upload'}
                        onClick={() => onTabChange('upload')}
                    />
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => onTabChange('dashboard')}
                    />
                    <SidebarItem
                        icon={FileText}
                        label="Log Explorer"
                        active={activeTab === 'explorer'}
                        onClick={() => onTabChange('explorer')}
                    />
                    <SidebarItem
                        icon={PieChart}
                        label="SEO Reports"
                        active={activeTab === 'reports'}
                        onClick={() => onTabChange('reports')}
                    />
                    <SidebarItem
                        icon={Settings}
                        label="Settings"
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                </nav>

                <div className="p-4 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                        Local Mode • v0.1.0
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="h-full flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
};
