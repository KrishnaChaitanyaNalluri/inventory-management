import { useCallback, useEffect, useState } from 'react';
import { Bug, Lightbulb, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { apiListFeedback, apiSubmitFeedback, type ApiFeedbackRow, type FeedbackCategory } from '@/lib/api';
import { canEditThreshold } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Feedback() {
  const { currentUser } = useAuth();
  const isLead = canEditThreshold(currentUser?.role);

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<ApiFeedbackRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadList = useCallback(async () => {
    if (!isLead) return;
    setLoadingList(true);
    try {
      const rows = await apiListFeedback(80);
      setList(rows);
    } catch {
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }, [isLead]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await apiSubmitFeedback({ category, message });
      toast.success('Thanks — your note was sent.');
      setMessage('');
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen pb-28 bg-background">
      <div className="bg-primary px-4 pt-6 pb-10 rounded-b-[1.75rem] shadow-sm">
        <h1 className="text-lg font-bold text-white">Feedback</h1>
        <p className="text-sm text-white/80 mt-1 max-w-md">
          Report a bug or suggest an improvement. Managers see all submissions below.
        </p>
      </div>

      <div className="px-4 -mt-4 relative z-10 space-y-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4"
        >
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory('bug')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors',
                  category === 'bug'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                <Bug className="h-4 w-4" />
                Bug
              </button>
              <button
                type="button"
                onClick={() => setCategory('enhancement')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors',
                  category === 'enhancement'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                <Lightbulb className="h-4 w-4" />
                Idea
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-msg" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details (min 5 characters)
            </Label>
            <Textarea
              id="fb-msg"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What happened, or what would help you work faster?"
              rows={5}
              className="resize-none text-sm min-h-[120px]"
              maxLength={4000}
              required
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length} / 4000</p>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={sending || message.trim().length < 5}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit
          </Button>
        </form>

        {isLead && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-3">Team submissions</h2>
            {loadingList ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No feedback yet.</p>
            ) : (
              <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {list.map(row => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{row.user_name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatWhen(row.created_at)}</span>
                    </div>
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase mb-1.5',
                        row.category === 'bug'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      {row.category === 'bug' ? 'Bug' : 'Enhancement'}
                    </span>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{row.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
