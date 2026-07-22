# =============================================================================
#  MENU  —  loaded from Menu_Categories_Items_Prices.csv
# =============================================================================
#  To change the menu: edit Menu_Categories_Items_Prices.csv (same folder),
#  then commit + push (or redeploy). Columns:
#      Category, Item, Price            (required)
#      Veg, Description                 (optional)
#  - Veg: leave blank / "veg" / "yes" for veg (green dot); "non-veg"/"no" for red.
#  - Items keep a stable id based on their row order, used to price orders
#    securely on the server.
# =============================================================================

import os
import csv

_CSV_PATH = os.path.join(os.path.dirname(__file__), "Menu_Categories_Items_Prices.csv")


def _load_menu():
    items = []
    try:
        with open(_CSV_PATH, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=1):
                # tolerate different header casings / stray spaces
                row = { (k or '').strip().lower(): (v or '').strip() for k, v in row.items() }
                name = row.get('item', '')
                category = row.get('category', '')
                price_raw = row.get('price', '')
                if not name or not category or not price_raw:
                    continue
                try:
                    price = int(round(float(price_raw)))
                except ValueError:
                    continue
                veg_raw = row.get('veg', '').lower()
                veg = veg_raw not in ('non-veg', 'nonveg', 'no', 'false', '0', 'n')
                items.append({
                    'id': i,
                    'name': name,
                    'price': price,
                    'category': category,
                    'veg': veg,
                    'desc': row.get('description', ''),
                })
    except FileNotFoundError:
        pass
    return items


MENU = _load_menu()

# Fast lookup by id — used by the backend to price orders securely.
MENU_BY_ID = {item["id"]: item for item in MENU}

# Ordered, de-duplicated list of categories (in the order they first appear).
CATEGORIES = []
for _item in MENU:
    if _item["category"] not in CATEGORIES:
        CATEGORIES.append(_item["category"])
