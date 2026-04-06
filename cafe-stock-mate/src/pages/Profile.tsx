import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield, User, Package, ClipboardList, AlertTriangle, Crown, Users } from 'lucide-react';
import { canEditThreshold } from '@/types/inventory';

/** Staff: everyone logged in. Manager extra: only role manager. */
const STAFF_PILLS: { label: string }[] = [
  { label: 'View Inventory' },
  { label: 'Add Stock' },
  { label: 'Remove Stock' },
  { label: 'Activity Log' },
];

const MANAGER_EXTRA_PILLS: { label: string }[] = [
  { label: 'Create Items' },
  { label: 'Edit Items' },
  { label: 'Low stock alert levels' },
  { label: 'View Reports' },
];

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser: authUser, logout } = useAuth();
  const { items, transactions, getLowStockItems } = useInventory();
  const currentUser = authUser ?? { id: '', name: '—', role: 'employee' as const };

  const lowStock = getLowStockItems();
  const needRestock = lowStock.filter(i => i.currentQuantity > 0);
  const todayStr = new Date().toDateString();
  const todayCount = transactions.filter(t => new Date(t.timestamp).toDateString() === todayStr).length;

  const isManager = canEditThreshold(currentUser.role);
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen pb-24 bg-background overflow-x-hidden">
      {/* Header — extra bottom padding so overlap feels intentional */}
      <div className="bg-primary px-4 pt-6 pb-14 rounded-b-[1.75rem] shadow-sm">
        <h1 className="text-lg font-bold text-white mb-6">Profile</h1>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {currentUser.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-lg leading-tight">{currentUser.name}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white capitalize">
              {currentUser.role === 'admin' ? (
                <Crown className="h-3 w-3" />
              ) : currentUser.role === 'manager' ? (
                <Shield className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-3 isolate">
        {/* Quick stats — one card, no floating corners at screen edge */}
        <div className="rounded-2xl bg-card border border-border shadow-md overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="py-4 px-2 text-center">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 mx-auto mb-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums leading-none">{items.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Items</p>
            </div>

            <div className={`py-4 px-2 text-center ${needRestock.length > 0 ? 'bg-amber-50/80' : ''}`}>
              <div className={`flex items-center justify-center h-8 w-8 rounded-full mx-auto mb-2 ${needRestock.length > 0 ? 'bg-amber-100' : 'bg-muted'}`}>
                <AlertTriangle className={`h-4 w-4 ${needRestock.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-xl font-bold tabular-nums leading-none ${needRestock.length > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {needRestock.length}
              </p>
              <p className={`text-[10px] font-medium mt-1 ${needRestock.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                Restock
              </p>
            </div>

            <div className={`py-4 px-2 text-center ${todayCount > 0 ? 'bg-primary/[0.06]' : ''}`}>
              <div className={`flex items-center justify-center h-8 w-8 rounded-full mx-auto mb-2 ${todayCount > 0 ? 'bg-primary/10' : 'bg-muted'}`}>
                <ClipboardList className={`h-4 w-4 ${todayCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-xl font-bold tabular-nums leading-none ${todayCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {todayCount > 0 ? todayCount : '—'}
              </p>
              <p className={`text-[10px] font-medium mt-1 ${todayCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {todayCount > 0 ? 'Today' : 'No activity'}
              </p>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-1">Permissions</p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Gray = everyone with login. Green = managers and admins (thresholds). Admins can also manage users.
          </p>

          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Your team (all roles)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {STAFF_PILLS.map(p => (
              <span
                key={p.label}
                className="rounded-full px-3 py-1 text-xs font-semibold border bg-muted border-border text-foreground"
              >
                {p.label}
              </span>
            ))}
          </div>

          {isManager && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Manager &amp; admin</p>
              <div className="flex flex-wrap gap-2">
                {MANAGER_EXTRA_PILLS.map(p => (
                  <span
                    key={p.label}
                    className="rounded-full px-3 py-1 text-xs font-semibold border bg-primary/8 border-primary/25 text-primary"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {isAdmin && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-2">Admin only</p>
              <button
                type="button"
                onClick={() => navigate('/profile/users')}
                className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 text-sm font-semibold text-violet-900 active:bg-violet-100 transition-colors shadow-sm"
              >
                <Users className="h-4 w-4" />
                Manage users &amp; roles
              </button>
            </>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-semibold text-destructive active:bg-red-50 transition-colors shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        <p className="text-center text-[10px] text-muted-foreground pb-2">
          Dumont Inventory v1.0
        </p>
      </div>
    </div>
  );
}
