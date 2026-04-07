import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { addToPurchaseDraft } from '@/lib/inventoryHelpers';

/** Managers/admins — append to session to-order list and toast with link to Activity → To order. */
export function useAddToPurchaseList() {
  const navigate = useNavigate();
  return useCallback((row: { id: string; name: string }) => {
    const ok = addToPurchaseDraft(row);
    if (ok) {
      toast.success(`Added "${row.name}" to your to-order list`, {
        action: {
          label: 'View',
          onClick: () => navigate('/activity?tab=purchase'),
        },
      });
    } else {
      toast.info('Already on your to-order list', {
        action: {
          label: 'View',
          onClick: () => navigate('/activity?tab=purchase'),
        },
      });
    }
  }, [navigate]);
}
