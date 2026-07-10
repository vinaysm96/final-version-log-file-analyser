import { LayoutDashboard, FileText, Settings, UploadCloud, PieChart, GitCompare, Globe, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick: () => void;
    badge?: number;
}

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: SidebarItemProps) => {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center w-full px-4 py-2.5 text-sm font-medium transition-all duration-150 rounded-lg group",
                active
                    ? "bg-gradient-to-r from-blue-600/80 to-indigo-600/80 text-white shadow-sm shadow-blue-500/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
        >
            <Icon className={clsx("w-4 h-4 mr-3 transition-colors", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
            {label}
            {badge !== undefined && badge > 0 && (
                <span className="ml-auto bg-red-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
            )}
        </button>
    );
};

interface AppLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const AppLayout = ({ children, activeTab, onTabChange }: AppLayoutProps) => {
    const navItems = [
        { id: 'upload', icon: UploadCloud, label: 'Data Intake' },
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'explorer', icon: FileText, label: 'Log Explorer' },
        { id: 'reports', icon: PieChart, label: 'SEO Reports' },
        { id: 'ip', icon: Globe, label: 'IP Intelligence' },
        { id: 'compare', icon: GitCompare, label: 'Log Comparison' },
        { id: 'gsc', icon: TrendingUp, label: 'GSC Analytics' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
                {/* Logo */}
                <div className="p-5 border-b border-border/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
                            <span className="text-white text-sm font-bold">L</span>
                        </div>
                        <div>
                            <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent leading-none">
                                Log Prism
                            </h1>
                            <p className="text-[10px] text-muted-foreground mt-0.5">SEO Log Analyzer</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    {navItems.map(item => (
                        <SidebarItem
                            key={item.id}
                            icon={item.icon}
                            label={item.label}
                            active={activeTab === item.id}
                            onClick={() => onTabChange(item.id)}
                        />
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-border/50 space-y-1">
                    <div className="text-[10px] text-muted-foreground/60 font-mono">v0.2.0 · Local Mode</div>
                    <div className="text-[10px] text-muted-foreground/40">All data stays on your device</div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto min-w-0">
                <div className="h-full flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
};
