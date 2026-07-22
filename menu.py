# =============================================================================
#  MENU  —  Edit this file to change what customers can order.
# =============================================================================
#  How to customize:
#    - Change name / price (INR) / desc freely.
#    - "category" groups items into sections on the customer page.
#    - "veg": True  -> green veg dot 🟢   |   False -> red non-veg dot 🔴
#    - Every item MUST have a unique integer "id".
#    - After editing, commit + push (or redeploy) to apply.
#  Prices are looked up here on the SERVER when an order is placed, so the
#  customer's browser can't tamper with them.
#
#  NOTE: This is a starter menu for Basil Bites - Taramani. Swap in the
#  restaurant's real items and prices; the layout adapts automatically.
# =============================================================================

MENU = [
    # ----- Starters & Bites -----
    {"id": 1,  "name": "Basil Bruschetta",        "price": 150, "category": "Starters & Bites",  "veg": True,  "desc": "Toasted bread, tomato, fresh basil"},
    {"id": 2,  "name": "Peri Peri Fries",         "price": 130, "category": "Starters & Bites",  "veg": True,  "desc": "Crispy fries tossed in peri peri"},
    {"id": 3,  "name": "Paneer Cheese Balls",     "price": 160, "category": "Starters & Bites",  "veg": True,  "desc": "Golden fried cheesy paneer bites"},
    {"id": 4,  "name": "Chicken Popcorn",         "price": 180, "category": "Starters & Bites",  "veg": False, "desc": "Crunchy bite-sized fried chicken"},

    # ----- Pizzas & Pasta -----
    {"id": 5,  "name": "Margherita Pizza",        "price": 220, "category": "Pizzas & Pasta",    "veg": True,  "desc": "Mozzarella, tomato, basil"},
    {"id": 6,  "name": "Farmhouse Pizza",         "price": 260, "category": "Pizzas & Pasta",    "veg": True,  "desc": "Onion, capsicum, corn, mushroom"},
    {"id": 7,  "name": "Basil Pesto Pasta",       "price": 240, "category": "Pizzas & Pasta",    "veg": True,  "desc": "Penne in fresh basil pesto"},
    {"id": 8,  "name": "Chicken Alfredo Pasta",   "price": 280, "category": "Pizzas & Pasta",    "veg": False, "desc": "Creamy white sauce, grilled chicken"},

    # ----- Rolls & Wraps -----
    {"id": 9,  "name": "Paneer Tikka Roll",       "price": 140, "category": "Rolls & Wraps",     "veg": True,  "desc": "Spiced paneer in a soft wrap"},
    {"id": 10, "name": "Veg Schezwan Roll",       "price": 120, "category": "Rolls & Wraps",     "veg": True,  "desc": "Crunchy veg, spicy schezwan"},
    {"id": 11, "name": "Chicken Kathi Roll",      "price": 170, "category": "Rolls & Wraps",     "veg": False, "desc": "Egg-coated wrap, chicken filling"},
    {"id": 12, "name": "Double Egg Roll",         "price": 110, "category": "Rolls & Wraps",     "veg": False, "desc": "Classic egg roll, onions & sauce"},

    # ----- Indo-Chinese -----
    {"id": 13, "name": "Veg Hakka Noodles",       "price": 160, "category": "Indo-Chinese",      "veg": True,  "desc": "Wok-tossed noodles & veggies"},
    {"id": 14, "name": "Gobi Manchurian",         "price": 170, "category": "Indo-Chinese",      "veg": True,  "desc": "Crispy cauliflower, tangy sauce"},
    {"id": 15, "name": "Chicken Fried Rice",      "price": 190, "category": "Indo-Chinese",      "veg": False, "desc": "Wok-fried rice with chicken"},
    {"id": 16, "name": "Chilli Chicken",          "price": 210, "category": "Indo-Chinese",      "veg": False, "desc": "Spicy Indo-Chinese chicken"},

    # ----- Beverages & Shakes -----
    {"id": 17, "name": "Fresh Lime Soda",         "price": 80,  "category": "Beverages & Shakes","veg": True,  "desc": "Sweet / salted, chilled"},
    {"id": 18, "name": "Virgin Mojito",           "price": 120, "category": "Beverages & Shakes","veg": True,  "desc": "Mint, lime, soda"},
    {"id": 19, "name": "Cold Coffee",             "price": 130, "category": "Beverages & Shakes","veg": True,  "desc": "Blended with ice cream"},
    {"id": 20, "name": "Oreo Shake",              "price": 140, "category": "Beverages & Shakes","veg": True,  "desc": "Thick shake, crushed Oreo"},

    # ----- Desserts -----
    {"id": 21, "name": "Chocolate Brownie",       "price": 150, "category": "Desserts",          "veg": True,  "desc": "Warm brownie, vanilla ice cream"},
    {"id": 22, "name": "Gulab Jamun (2 pc)",      "price": 90,  "category": "Desserts",          "veg": True,  "desc": "Warm, syrup-soaked"},
]

# Fast lookup by id — used by the backend to price orders securely.
MENU_BY_ID = {item["id"]: item for item in MENU}

# Ordered, de-duplicated list of categories (in the order they first appear above).
CATEGORIES = []
for _item in MENU:
    if _item["category"] not in CATEGORIES:
        CATEGORIES.append(_item["category"])
