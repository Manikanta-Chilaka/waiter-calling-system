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
# =============================================================================

MENU = [
    # ----- Starters -----
    {"id": 1,  "name": "Paneer Tikka",            "price": 260, "category": "Starters",         "veg": True,  "desc": "Char-grilled cottage cheese, mint chutney"},
    {"id": 2,  "name": "Crispy Corn",             "price": 220, "category": "Starters",         "veg": True,  "desc": "Golden fried corn tossed with spices"},
    {"id": 3,  "name": "Chicken 65",              "price": 280, "category": "Starters",         "veg": False, "desc": "Spicy South-Indian fried chicken"},
    {"id": 4,  "name": "Chilli Garlic Prawns",    "price": 340, "category": "Starters",         "veg": False, "desc": "Wok-tossed prawns, garlic & chilli"},

    # ----- Main Course -----
    {"id": 5,  "name": "Paneer Butter Masala",    "price": 300, "category": "Main Course",      "veg": True,  "desc": "Creamy tomato gravy, served with naan"},
    {"id": 6,  "name": "Dal Makhani",             "price": 250, "category": "Main Course",      "veg": True,  "desc": "Slow-cooked black lentils, butter"},
    {"id": 7,  "name": "Butter Chicken",          "price": 360, "category": "Main Course",      "veg": False, "desc": "Classic makhani gravy, tandoori chicken"},
    {"id": 8,  "name": "Hyderabadi Chicken Biryani","price": 320,"category": "Main Course",      "veg": False, "desc": "Dum-cooked basmati, raita & salan"},
    {"id": 9,  "name": "Veg Biryani",             "price": 260, "category": "Main Course",      "veg": True,  "desc": "Fragrant rice, mixed vegetables"},

    # ----- Pizzas & Burgers -----
    {"id": 10, "name": "Margherita Pizza",        "price": 290, "category": "Pizzas & Burgers", "veg": True,  "desc": "Mozzarella, basil, tomato sauce"},
    {"id": 11, "name": "Peri Peri Chicken Pizza", "price": 380, "category": "Pizzas & Burgers", "veg": False, "desc": "Peri peri chicken, peppers, cheese"},
    {"id": 12, "name": "Classic Veg Burger",      "price": 180, "category": "Pizzas & Burgers", "veg": True,  "desc": "Crispy patty, lettuce, house sauce"},
    {"id": 13, "name": "Grilled Chicken Burger",  "price": 230, "category": "Pizzas & Burgers", "veg": False, "desc": "Grilled chicken, cheese, mayo"},

    # ----- Beverages -----
    {"id": 14, "name": "Fresh Lime Soda",         "price": 90,  "category": "Beverages",        "veg": True,  "desc": "Sweet / salted, chilled"},
    {"id": 15, "name": "Cold Coffee",             "price": 150, "category": "Beverages",        "veg": True,  "desc": "Blended with ice cream"},
    {"id": 16, "name": "Virgin Mojito",           "price": 170, "category": "Beverages",        "veg": True,  "desc": "Mint, lime, soda"},
    {"id": 17, "name": "Craft Cold Brew",         "price": 190, "category": "Beverages",        "veg": True,  "desc": "House-steeped 18-hour cold brew"},

    # ----- Desserts -----
    {"id": 18, "name": "Chocolate Brownie",       "price": 160, "category": "Desserts",         "veg": True,  "desc": "Warm brownie, vanilla ice cream"},
    {"id": 19, "name": "Gulab Jamun (2 pc)",      "price": 110, "category": "Desserts",         "veg": True,  "desc": "Warm, syrup-soaked"},
]

# Fast lookup by id — used by the backend to price orders securely.
MENU_BY_ID = {item["id"]: item for item in MENU}

# Ordered, de-duplicated list of categories (in the order they first appear above).
CATEGORIES = []
for _item in MENU:
    if _item["category"] not in CATEGORIES:
        CATEGORIES.append(_item["category"])
