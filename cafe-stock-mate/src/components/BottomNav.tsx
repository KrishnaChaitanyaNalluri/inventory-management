import { Home, Package, ClipboardList, Warehouse, MessageSquareText, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { canEditThreshold, canManageOffsiteStorage } from '@/types/inventory';
import { usePurchaseDraftCount } from '@/hooks/usePurchaseDraft';

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/inventory', icon: Package, label: 'Inventory' },
  { path: '/activity', icon: ClipboardList, label: 'Activity' },
  { path: '/storage', icon: Warehouse, label: 'Storage', managerOnly: true },
  { path: '/feedback', icon: MessageSquareText, label: 'Ideas' },
  { path: '/profile', icon: User, label: 'Profile' },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const purchaseDraftCount = usePurchaseDraftCount();
  const visible = tabs.filter(
    t => !('managerOnly' in t && t.managerOnly) || canManageOffsiteStorage(currentUser?.role),
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-lg">
        {visible.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[52px] py-2 text-[11px] font-semibold transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-primary rounded-full" />
              )}
              <span className="relative inline-flex">
                <tab.icon className={cn('h-6 w-6 transition-all', active ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
                {tab.path === '/activity' && canEditThreshold(currentUser?.role) && purchaseDraftCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 min-w-[16px] rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {purchaseDraftCount > 9 ? '9+' : purchaseDraftCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
