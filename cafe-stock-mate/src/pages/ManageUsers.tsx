import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { apiCreateUser, apiListUsers, apiUpdateUser, type ApiUserRow } from '@/lib/api';
import { UserRole } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLES: UserRole[] = ['employee', 'manager', 'admin'];

function loginLabel(u: ApiUserRow): string {
  return u.phone || u.email || '—';
}

export default function ManageUsers() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addIdentifier, setAddIdentifier] = useState('');
  const [addPin, setAddPin] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('employee');
  const [addSaving, setAddSaving] = useState(false);

  const [editUser, setEditUser] = useState<ApiUserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editPin, setEditPin] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const rows = await apiListUsers();
      setUsers(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!currentUser || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <p className="text-sm text-muted-foreground">Admins only.</p>
        <Button variant="outline" onClick={() => navigate('/profile')}>
          Back to profile
        </Button>
      </div>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    try {
      await apiCreateUser({
        name: addName,
        identifier: addIdentifier,
        pin: addPin,
        role: addRole,
      });
      toast.success('User created');
      setAddOpen(false);
      setAddName('');
      setAddIdentifier('');
      setAddPin('');
      setAddRole('employee');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(u: ApiUserRow) {
    setEditUser(u);
    setEditName(u.name);
    setEditRole(u.role as UserRole);
    setEditPin('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    try {
      const body: { name?: string; role?: string; pin?: string } = {
        name: editName.trim(),
        role: editRole,
      };
      if (editPin.trim()) body.pin = editPin.trim();
      await apiUpdateUser(editUser.id, body);
      toast.success('User updated');
      setEditUser(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-28 bg-background">
      <div className="bg-primary px-4 pt-4 pb-10 rounded-b-[1.75rem] shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="rounded-full p-2 text-white/90 hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-white flex-1">Team & users</h1>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <p className="text-xs text-white/80 pl-11">
          Create logins and assign roles. Login uses phone or email plus PIN (same as staff sign-in).
        </p>
      </div>

      <div className="px-4 -mt-4 relative z-10 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No users yet.</p>
        ) : (
          users.map(u => (
            <div
              key={u.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-start gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{loginLabel(u)}</p>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    u.role === 'admin'
                      ? 'bg-violet-100 text-violet-800'
                      : u.role === 'manager'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {u.role}
                </span>
              </div>
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openEdit(u)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="nu-name">Name</Label>
                <Input
                  id="nu-name"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nu-id">Phone or email</Label>
                <Input
                  id="nu-id"
                  value={addIdentifier}
                  onChange={e => setAddIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="e.g. 4085550100 or name@cafe.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nu-pin">PIN (4–6 digits)</Label>
                <Input
                  id="nu-pin"
                  type="password"
                  inputMode="numeric"
                  value={addPin}
                  onChange={e => setAddPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  minLength={4}
                  maxLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select value={addRole} onValueChange={v => setAddRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSaving}>
                {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          {editUser && (
            <form onSubmit={handleEdit}>
              <DialogHeader>
                <DialogTitle>Edit user</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <p className="text-xs text-muted-foreground">
                  Login: <span className="font-medium text-foreground">{loginLabel(editUser)}</span> (not editable)
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="eu-name">Name</Label>
                  <Input
                    id="eu-name"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="eu-pin">New PIN (optional, 4–6 digits)</Label>
                  <Input
                    id="eu-pin"
                    type="password"
                    inputMode="numeric"
                    value={editPin}
                    onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Leave blank to keep current PIN"
                    minLength={4}
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
