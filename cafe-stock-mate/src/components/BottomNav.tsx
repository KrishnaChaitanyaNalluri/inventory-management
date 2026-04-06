import { Home, Package, ClipboardList, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/inventory', icon: Package, label: 'Inventory' },
  { path: '/activity', icon: ClipboardList, label: 'Activity' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-primary rounded-full" />
              )}
              <tab.icon className={cn('h-5 w-5 transition-all', active ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
