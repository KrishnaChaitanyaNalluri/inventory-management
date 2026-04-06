# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv
load_dotenv()

from database import get_cursor

CATEGORY_OVERRIDES = {
    'Ice Creams':             3,
    'Cups & Lids':           20,
    'Teas':                   8,
    'Disposables & Utensils': 10,
}

with get_cursor() as cur:
    cur.execute("SELECT id, name, category, low_stock_threshold FROM inventory_items ORDER BY category, name")
    rows = cur.fetchall()

    updated = 0
    for item_id, name, category, threshold in rows:
        if category in CATEGORY_OVERRIDES:
            new_qty = CATEGORY_OVERRIDES[category]
        else:
            new_qty = threshold * 3 + 2

        cur.execute(
            "UPDATE inventory_items SET current_quantity = %s WHERE id = %s",
            (new_qty, item_id)
        )
        updated += 1
        print("  %-30s | %-40s | alert<=%d  ->  qty=%d" % (category, name, threshold, new_qty))

print("\nDone! Updated %d items to healthy stock levels." % updated)
