"""
Create tables and seed data.

  python migrate.py

Re-runs are safe for inventory counts: existing rows keep current_quantity,
offsite_quantity, and sort_order unless you pass --reset-quantities (then seed
quantities overwrite the DB — use only when you want a full reset).
"""
import argparse
import os
import bcrypt
import psycopg2
from dotenv import load_dotenv

load_dotenv()

from schema import SCHEMA, SCHEMA_ALTER


def hash_pin(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# ── Seed Data ─────────────────────────────────────────────────────────────────

USERS = [
    ("u_admin", "Store Admin", "admin@dumont.com", None, "9999", "admin"),
    ("u1", "Harshitha Vadavalli", None,             "4086638976", "1234", "manager"),
    ("u2", "Chay N",              None,             "1235",       "1235", "admin"),
]

# (id, name, category, sub_category, unit, current_qty, low_threshold, storage, note)
ITEMS = [
    # ── Cups & Lids ──────────────────────────────────────────────────────────
    ("1",  "Coffee Cup 8oz – Hot",                   "Cups & Lids", None, "sleeves",  35, 5,  "storage_room", None),
    ("2",  "Coffee Cup 8oz – Ripple Hot",             "Cups & Lids", None, "sleeves",   2, 3,  "storage_room", None),
    ("3",  "Coffee Cup 12oz – Hot",                   "Cups & Lids", None, "sleeves",  12, 5,  "storage_room", None),
    ("4",  "Coffee Cup 16oz – Hot",                   "Cups & Lids", None, "sleeves",  19, 5,  "storage_room", None),
    ("5",  "Coffee Cup 12oz – Iced (F/A)",            "Cups & Lids", None, "sleeves",  10, 5,  "storage_room", None),
    ("6",  "Coffee Cup 16oz – Iced Printed",          "Cups & Lids", None, "sleeves",  10, 5,  "storage_room", None),
    ("7",  "Coffee Cup 16oz – Iced Non-printed",      "Cups & Lids", None, "sleeves",   3, 3,  "storage_room", None),
    ("8",  "Milkshake Cups 16oz",                     "Cups & Lids", None, "sleeves",  33, 5,  "storage_room", None),
    ("9",  "Boba Cups 24oz",                          "Cups & Lids", None, "sleeves",  10, 3,  "storage_room", None),
    ("10", "Hot Coffee Cup Lid 8oz",                  "Cups & Lids", None, "sleeves",   8, 3,  "storage_room", None),
    ("11", "Hot Coffee Cup Lid 12oz",                 "Cups & Lids", None, "sleeves",   7, 3,  "storage_room", None),
    ("12", "Iced Coffee Cup Lid (16oz/12oz)",          "Cups & Lids", None, "sleeves",  11, 3,  "storage_room", None),
    ("13", "PP Boba Lids (16oz/24oz)",                "Cups & Lids", None, "sleeves",   4, 2,  "storage_room", None),
    ("14", "Flat Lids Iced – Middle Straw",           "Cups & Lids", None, "sleeves",   8, 2,  "storage_room", None),
    ("15", "Dome Lids (Falooda)",                     "Cups & Lids", None, "sleeves",  15, 3,  "storage_room", None),
    ("16", "Small Scoop Ice Cream Cups",              "Cups & Lids", None, "sleeves",   8, 3,  "storage_room", None),
    ("17", "Regular Scoop Ice Cream Cups",            "Cups & Lids", None, "sleeves",   8, 3,  "storage_room", None),
    ("18", "Half Pint Cups",                          "Cups & Lids", None, "sleeves",   1, 2,  "storage_room", None),
    ("19", "Handpicked Happiness Tubs",               "Cups & Lids", None, "sleeves",  15, 3,  "storage_room", None),
    ("20", "Small Scoop Ice Cream Lids",              "Cups & Lids", None, "sleeves",   0, 2,  "storage_room", None),
    ("21", "Regular Scoop Ice Cream Lids",            "Cups & Lids", None, "sleeves",   1, 2,  "storage_room", None),
    ("22", "Handpicked Happiness Lids",               "Cups & Lids", None, "sleeves",   3, 2,  "storage_room", None),
    ("23", "Sample Milk Tea Cups (1oz)",               "Cups & Lids", None, "sleeves",   1, 1,  "storage_room", None),

    # ── Teas ─────────────────────────────────────────────────────────────────
    ("24", "White Peach Tea",   "Teas", None, "bags", 50, 5, "storage_room", "Each bag contains 30 pouches — counting by bags only"),
    ("25", "Jasmine Green Tea", "Teas", None, "bags",  8, 3, "storage_room", None),
    ("26", "Black Tea",         "Teas", None, "bags",  4, 3, "storage_room", None),
    ("27", "Thai Chai Tea",     "Teas", None, "bags",  3, 2, "storage_room", None),
    ("28", "Golden Milk Tea",   "Teas", None, "bags",  9, 3, "storage_room", None),

    # ── Boba Ingredients ─────────────────────────────────────────────────────
    ("29", "Boba Pearls (Tapioca)",      "Boba Ingredients", "Boba Pearls",    "bags",    18, 3, "storage_room", None),
    ("30", "Green Apple Jelly",          "Boba Ingredients", "Jellies",         "jars",     5, 2, "storage_room", None),
    ("31", "Coffee Jelly",               "Boba Ingredients", "Jellies",         "jars",     2, 1, "storage_room", None),
    ("32", "Lychee Jelly",               "Boba Ingredients", "Jellies",         "jars",     4, 2, "storage_room", None),
    ("33", "Rainbow Jelly",              "Boba Ingredients", "Jellies",         "jars",     6, 2, "storage_room", None),
    ("34", "Passion Popping Pearls",     "Boba Ingredients", "Popping Pearls",  "jars",    12, 3, "storage_room", None),
    ("35", "Strawberry Popping Pearls",  "Boba Ingredients", "Popping Pearls",  "jars",    11, 3, "storage_room", None),
    ("36", "Mango Popping Pearls",       "Boba Ingredients", "Popping Pearls",  "jars",     8, 3, "storage_room", None),
    ("37", "Chocolate Popping Pearls",   "Boba Ingredients", "Popping Pearls",  "jars",     0, 2, "storage_room", None),
    ("38", "Crystal Boba",               "Boba Ingredients", "Popping Pearls",  "jars",    10, 3, "storage_room", None),
    ("39", "Fructose Syrup",             "Boba Ingredients", "Boba Syrups",     "bottles",  3, 1, "storage_room", None),
    ("40", "Dark Brown Sugar Syrup",     "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("41", "Dark Brown Sugar Sauce",     "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("42", "Longan Honey",               "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("43", "Winter Melon Syrup",         "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("44", "Lychee Syrup (Boba)",        "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("45", "Mango Syrup (Boba)",         "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("46", "Passion Fruit Syrup (Boba)", "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("47", "Pineapple Syrup (Boba)",     "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("48", "Strawberry Syrup (Boba)",    "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("49", "Grape Fruit Syrup (Boba)",   "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("50", "Peach Syrup (Boba)",         "Boba Ingredients", "Boba Syrups",     "bottles",  2, 1, "storage_room", None),
    ("51", "Taro Powder",                "Boba Ingredients", "Powders & Mixes", "bags",     8, 2, "storage_room", None),
    ("52", "Horchata Powder",            "Boba Ingredients", "Powders & Mixes", "bags",     7, 2, "storage_room", None),
    ("53", "Yogu Mix",                   "Boba Ingredients", "Powders & Mixes", "bags",     4, 1, "storage_room", None),
    ("54", "Custard Powder Mix",         "Boba Ingredients", "Powders & Mixes", "bags",    15, 3, "storage_room", None),
    ("55", "Matcha Powder",              "Boba Ingredients", "Powders & Mixes", "bags",    12, 3, "storage_room", None),
    ("56", "Non-Dairy Creamer",          "Boba Ingredients", "Powders & Mixes", "bags",    13, 3, "storage_room", None),
    ("57", "Vanilla Powder",             "Boba Ingredients", "Powders & Mixes", "bags",    24, 3, "storage_room", None),
    ("58", "Mango Puree",                "Boba Ingredients", "Purees",          "bottles",  2, 1, "fridge",        None),
    ("59", "Strawberry Puree",           "Boba Ingredients", "Purees",          "bottles",  8, 2, "fridge",        None),
    ("60", "Passion Fruit Puree",        "Boba Ingredients", "Purees",          "bottles",  7, 2, "fridge",        None),

    # ── Coffee Ingredients ────────────────────────────────────────────────────
    ("61",  "Coffee Beans",                   "Coffee Ingredients", "Coffee Beans",      "bags",       2, 1, "storage_room",  None),
    ("62",  "Vanilla Syrup",                  "Coffee Ingredients", "Syrups – Main",     "bottles",    9, 3, "front_counter", None),
    ("63",  "Caramel Syrup",                  "Coffee Ingredients", "Syrups – Main",     "bottles",    4, 3, "front_counter", None),
    ("64",  "Hazelnut Syrup",                 "Coffee Ingredients", "Syrups – Main",     "bottles",   10, 3, "front_counter", None),
    ("65",  "Blackberry Syrup",               "Coffee Ingredients", "Syrups – Main",     "bottles",   13, 3, "front_counter", None),
    ("66",  "Blueberry Syrup",                "Coffee Ingredients", "Syrups – Main",     "bottles",    4, 3, "front_counter", None),
    ("67",  "ToffeeNut Syrup",                "Coffee Ingredients", "Syrups – Main",     "bottles",   13, 3, "front_counter", None),
    ("68",  "Pistachio Syrup",                "Coffee Ingredients", "Syrups – Main",     "bottles",   11, 3, "front_counter", None),
    ("69",  "Raspberry Syrup",                "Coffee Ingredients", "Syrups – Main",     "bottles",   10, 3, "front_counter", None),
    ("70",  "Lavender Syrup",                 "Coffee Ingredients", "Syrups – Main",     "bottles",    6, 3, "front_counter", None),
    ("71",  "Salted Caramel Syrup",           "Coffee Ingredients", "Syrups – Main",     "bottles",    2, 2, "front_counter", None),
    ("72",  "Coconut Syrup",                  "Coffee Ingredients", "Syrups – Main",     "bottles",    3, 2, "front_counter", None),
    ("73",  "Peppermint Syrup",               "Coffee Ingredients", "Syrups – Main",     "bottles",    4, 2, "front_counter", None),
    ("74",  "Mango Syrup (Coffee)",           "Coffee Ingredients", "Syrups – Main",     "bottles",    1, 2, "front_counter", None),
    ("75",  "Torani Butter Pecan Syrup",      "Coffee Ingredients", "Syrups – Main",     "bottles",    1, 2, "front_counter", None),
    ("76",  "Spiced Brown Sugar Syrup",       "Coffee Ingredients", "Syrups – Main",     "bottles",    0, 2, "front_counter", None),
    ("77",  "Cookie Butter Syrup",            "Coffee Ingredients", "Syrups – Main",     "bottles",    5, 2, "front_counter", None),
    ("78",  "Strawberry Syrup (Coffee)",      "Coffee Ingredients", "Syrups – Main",     "bottles",   11, 3, "front_counter", None),
    ("79",  "Gingerbread Syrup",              "Coffee Ingredients", "Syrups – Main",     "bottles",    0, 2, "storage_room",  None),
    ("80",  "Creme Caramel Syrup",            "Coffee Ingredients", "Syrups – Main",     "bottles",    2, 2, "front_counter", None),
    ("81",  "Vanilla Syrup (Sugar Free)",     "Coffee Ingredients", "Syrups – Sugar Free","bottles",   1, 1, "front_counter", None),
    ("82",  "Caramel Syrup (Sugar Free)",     "Coffee Ingredients", "Syrups – Sugar Free","bottles",   3, 1, "front_counter", None),
    ("83",  "Hazelnut Syrup (Sugar Free)",    "Coffee Ingredients", "Syrups – Sugar Free","bottles",   3, 1, "front_counter", None),
    ("84",  "White Chocolate Sauce",          "Coffee Ingredients", "Mocha Sauces",      "bottles",    3, 2, "front_counter", None),
    ("85",  "Dark Chocolate Sauce",           "Coffee Ingredients", "Mocha Sauces",      "bottles",    7, 2, "front_counter", None),
    ("86",  "Caramel Sauce (Ghiradelli)",     "Coffee Ingredients", "Mocha Sauces",      "bottles",    5, 2, "front_counter", None),
    ("87",  "Pumpkin Pie Sauce",              "Coffee Ingredients", "Mocha Sauces",      "bottles",    1, 1, "storage_room",  None),
    ("88",  "Condensed Milk",                 "Milk & Dairy Alternatives", "Pantry",            "tins",      30, 5, "storage_room",  None),
    ("89",  "Date Syrup",                     "Coffee Ingredients", "Special Syrups",    "bottles",    5, 2, "storage_room",  None),
    ("90",  "Raw Honey",                      "Coffee Ingredients", "Special Syrups",    "bottles",    3, 1, "storage_room",  None),
    ("91",  "Tonic Water",                    "Coffee Ingredients", "Special Syrups",    "bottles",    1, 2, "storage_room",  None),
    ("92",  "Cinnamon Powder",                "Coffee Ingredients", "Spice Powders",     "containers", 0, 1, "storage_room",  None),
    ("93",  "Cardamom Powder",                "Coffee Ingredients", "Spice Powders",     "containers", 4, 1, "storage_room",  None),
    ("94",  "Pumpkin Spice Powder",           "Coffee Ingredients", "Spice Powders",     "containers", 1, 1, "storage_room",  None),
    ("95",  "Cinnamon Sugar",                 "Coffee Ingredients", "Spice Powders",     "containers", 2, 1, "storage_room",  None),
    ("96",  "Half & Half",                    "Milk & Dairy Alternatives", "Creamers",          "boxes",      1, 2, "fridge",        None),
    ("97",  "Delight – Hazelnut Creamer",     "Milk & Dairy Alternatives", "Creamers",          "boxes",      1, 1, "fridge",        None),
    ("98",  "Delight – French Vanilla Creamer","Milk & Dairy Alternatives","Creamers",          "boxes",      0, 1, "fridge",        None),
    ("99",  "Delight – Caramel Macchiato Creamer","Milk & Dairy Alternatives","Creamers",       "boxes",      0, 1, "fridge",        None),
    ("100", "Coffee Mate Creamer",            "Milk & Dairy Alternatives", "Creamers",          "boxes",      1, 1, "storage_room",  None),

    # ── Sweeteners ────────────────────────────────────────────────────────────
    ("101", "Brown Sugar (Packets)", "Sweeteners", None, "boxes", 0, 1, "front_counter", None),
    ("102", "C & H Pure Cane Sugar", "Sweeteners", None, "boxes", 1, 1, "front_counter", None),
    ("103", "US Foods Sugar",         "Sweeteners", None, "boxes", 1, 1, "storage_room",  None),
    ("104", "Splenda (0 cal sweetener)","Sweeteners",None,"boxes", 2, 1, "front_counter", None),
    ("105", "Stevia in the Raw",      "Sweeteners", None, "boxes", 1, 1, "front_counter", None),
    ("106", "White Sugar Sacks",      "Sweeteners", None, "sacks", 0, 1, "storage_room",  None),
    ("107", "Brown Sugar Sacks",      "Sweeteners", None, "sacks", 0, 1, "storage_room",  None),
    ("108", "Yellow Sugar Sacks",     "Sweeteners", None, "sacks", 2, 1, "storage_room",  None),

    # ── Toppings & Add-ins ────────────────────────────────────────────────────
    ("109", "M&M's",                         "Toppings & Add-ins", None, "bags",       0, 1, "storage_room",  None),
    ("110", "Marshmallows",                  "Toppings & Add-ins", None, "bags",       7, 2, "storage_room",  None),
    ("111", "Rainbow Sprinkles",             "Toppings & Add-ins", None, "containers", 0, 1, "storage_room",  None),
    ("112", "Cashews",                       "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("113", "Almonds",                       "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("114", "Pralines",                      "Toppings & Add-ins", None, "bags",       0, 1, "storage_room",  None),
    ("115", "Heath Toffee Nut",              "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("116", "Dark Chocolate Chips",          "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("117", "White Chocolate Chips",         "Toppings & Add-ins", None, "bags",       0, 1, "storage_room",  None),
    ("118", "Milk Chocolate Chips",          "Toppings & Add-ins", None, "bags",       1, 1, "storage_room",  None),
    ("119", "Sev (Falooda)",                 "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("120", "Tutti Frutti",                  "Toppings & Add-ins", None, "bags",       0, 1, "storage_room",  None),
    ("121", "Rooh Afza",                     "Toppings & Add-ins", None, "bottles",    4, 1, "storage_room",  None),
    ("122", "Lemons",                        "Toppings & Add-ins", None, "units",      8, 5, "fridge",        None),
    ("123", "Mint",                          "Toppings & Add-ins", None, "bunches",    3, 2, "fridge",        None),
    ("124", "Basil Seeds",                   "Toppings & Add-ins", None, "bags",       7, 2, "storage_room",  None),
    ("125", "Malai",                         "Toppings & Add-ins", None, "containers", 9, 3, "fridge",        None),
    ("126", "Mango Pulp",                    "Toppings & Add-ins", None, "cans",       8, 2, "storage_room",  None),
    ("127", "Whipped Cream",                 "Toppings & Add-ins", None, "cans",       6, 3, "fridge",        None),
    ("128", "Waffle Cone Mix – Chocolate",   "Toppings & Add-ins", None, "bags",       3, 1, "storage_room",  None),
    ("129", "Waffle Cone Mix – Vanilla",     "Toppings & Add-ins", None, "bags",       2, 1, "storage_room",  None),
    ("130", "Waffle Cone Mix – Old Fashioned","Toppings & Add-ins",None,"bags",        0, 1, "storage_room",  None),
    ("131", "Tajin Powder",                  "Toppings & Add-ins", None, "containers", 4, 1, "storage_room",  None),
    ("132", "Chamoy Sauce",                  "Toppings & Add-ins", None, "bottles",    0, 1, "storage_room",  None),
    ("133", "Chilli Powder",                 "Toppings & Add-ins", None, "containers", 1, 1, "storage_room",  None),
    ("134", "Sea Salt",                      "Toppings & Add-ins", None, "containers", 0, 1, "storage_room",  None),
    ("135", "Hershey's Chocolate Syrup",     "Toppings & Add-ins", None, "bottles",    6, 2, "storage_room",  None),
    ("136", "Oreo Cookies",                  "Toppings & Add-ins", None, "packs",      1, 1, "storage_room",  None),
    ("137", "Lavender Buds",                 "Toppings & Add-ins", None, "jars",       0, 1, "storage_room",  None),
    ("138", "Tajin Straws",                  "Toppings & Add-ins", None, "packs",      2, 1, "storage_room",  None),
    ("139", "Brownie Plates",                "Toppings & Add-ins", None, "boxes",      0, 1, "storage_room",  None),
    ("140", "Hershey's Cocoa",               "Toppings & Add-ins", None, "containers", 2, 1, "storage_room",  None),

    # ── Disposables & Utensils ────────────────────────────────────────────────
    ("141", "Gloves S",                          "Disposables & Utensils", None, "boxes",  3, 1, "storage_room", None),
    ("142", "Gloves M",                          "Disposables & Utensils", None, "boxes", 20, 3, "storage_room", None),
    ("143", "Gloves L",                          "Disposables & Utensils", None, "boxes",  6, 2, "storage_room", None),
    ("144", "Gloves XL",                         "Disposables & Utensils", None, "boxes",  7, 2, "storage_room", None),
    ("145", "Hair Nets",                         "Disposables & Utensils", None, "boxes", 13, 3, "storage_room", None),
    ("146", "Cup Holders (With handle)",         "Disposables & Utensils", None, "packs",  5, 2, "storage_room", None),
    ("147", "Cup Holders (Without handle)",      "Disposables & Utensils", None, "packs",  3, 2, "storage_room", None),
    ("148", "Coffee Straws (White Paper)",       "Disposables & Utensils", None, "boxes", 11, 3, "storage_room", None),
    ("149", "Boba Straws (Plastic Wrapped)",     "Disposables & Utensils", None, "boxes", 13, 3, "storage_room", None),
    ("150", "Hot Cup Sleeves / Jackets",         "Disposables & Utensils", None, "packs",  2, 2, "storage_room", None),
    ("151", "Hot Cup Sleeves (Karafa Brand)",    "Disposables & Utensils", None, "packs",  4, 2, "storage_room", None),
    ("152", "Wooden Coffee Stirrers",            "Disposables & Utensils", None, "boxes", 17, 3, "storage_room", None),
    ("153", "Coffee Plastic Stoppers",           "Disposables & Utensils", None, "packs",  2, 2, "storage_room", None),
    ("154", "Colour Changing Spoons",            "Disposables & Utensils", None, "packs",  0, 1, "storage_room", None),
    ("155", "Normal Colour Spoons (Rainbow)",    "Disposables & Utensils", None, "packs",  8, 2, "storage_room", None),
    ("156", "Normal Colour Spoons (White)",      "Disposables & Utensils", None, "packs",  1, 2, "storage_room", None),
    ("157", "Yogurt Spoons",                     "Disposables & Utensils", None, "packs",  2, 1, "storage_room", None),
    ("158", "Cutlery Kits",                      "Disposables & Utensils", None, "packs",  2, 2, "storage_room", None),
    ("159", "Ice Cream Tasting Spoons (White)",  "Disposables & Utensils", None, "packs",  2, 2, "storage_room", None),
    ("160", "Ice Cream Tasting Spoons (Pink)",   "Disposables & Utensils", None, "packs",  4, 2, "storage_room", None),
    ("161", "Dumont Orange Bags",                "Disposables & Utensils", None, "packs",  2, 2, "storage_room", None),
    ("162", "Pastry Bags (White/Brown)",         "Disposables & Utensils", None, "packs",  1, 2, "storage_room", None),
    ("163", "Baking Wax Papers",                 "Disposables & Utensils", None, "packs",  5, 2, "storage_room", None),
    ("164", "Plastic Wrap",                      "Disposables & Utensils", None, "rolls",  2, 1, "storage_room", None),
    ("165", "Customer Paper Napkins (Brown)",    "Disposables & Utensils", None, "packs",  4, 2, "front_counter",None),
    ("166", "Customer Paper Napkins (White)",    "Disposables & Utensils", None, "packs",  0, 2, "front_counter",None),
    ("167", "Multifold Napkins (Brown)",         "Disposables & Utensils", None, "packs",  1, 2, "storage_room", None),
    ("168", "2 Ply Jumbo Roll Tissue",           "Disposables & Utensils", None, "rolls",  3, 2, "storage_room", None),

    # ── Cleaning & Sanitation ─────────────────────────────────────────────────
    ("169", "Sanitizer for Dishes",              "Cleaning & Sanitation", None, "bottles",    0, 1, "storage_room", None),
    ("170", "Dish Soap",                         "Cleaning & Sanitation", None, "bottles",    3, 1, "storage_room", None),
    ("171", "Sponges",                           "Cleaning & Sanitation", None, "packs",      2, 2, "storage_room", None),
    ("172", "Cleaning Brush for Dishes",         "Cleaning & Sanitation", None, "units",      1, 1, "storage_room", None),
    ("173", "Disinfectant Liquid",               "Cleaning & Sanitation", None, "bottles",    5, 2, "storage_room", None),
    ("174", "All Purpose Liquid",                "Cleaning & Sanitation", None, "bottles",    1, 1, "storage_room", None),
    ("175", "Lizol",                             "Cleaning & Sanitation", None, "bottles",    2, 1, "storage_room", None),
    ("176", "Liquid Gel Hand Sanitizer",         "Cleaning & Sanitation", None, "bottles",    0, 2, "storage_room", None),
    ("177", "Bleach",                            "Cleaning & Sanitation", None, "bottles",    3, 1, "storage_room", None),
    ("178", "Floor Cleaning Liquid",             "Cleaning & Sanitation", None, "bottles",    2, 1, "storage_room", None),
    ("179", "Hand Soap",                         "Cleaning & Sanitation", None, "bottles",    5, 2, "storage_room", None),
    ("180", "Glass Cleaner",                     "Cleaning & Sanitation", None, "bottles",    6, 2, "storage_room", None),
    ("181", "Drain Cleaner",                     "Cleaning & Sanitation", None, "bottles",    3, 1, "storage_room", None),
    ("182", "Espresso Machine Cleaning Powder",  "Cleaning & Sanitation", None, "containers", 5, 1, "storage_room", None),
    ("183", "Toilet Paper Rolls",                "Cleaning & Sanitation", None, "rolls",      6, 3, "storage_room", None),
    ("184", "Toilet Seat Covers",                "Cleaning & Sanitation", None, "boxes",      1, 1, "storage_room", None),
    ("185", "Paper Towels (Brown Roll)",         "Cleaning & Sanitation", None, "rolls",      1, 2, "storage_room", None),
    ("186", "Air Freshener",                     "Cleaning & Sanitation", None, "bottles",    2, 1, "storage_room", None),
    ("187", "Toilet Liquid",                     "Cleaning & Sanitation", None, "bottles",    1, 1, "storage_room", None),

    # ── Packaging & Misc ─────────────────────────────────────────────────────
    ("188", "Sales Area Trash Bags",  "Packaging & Misc", None, "boxes", 2, 1, "storage_room", None),
    ("189", "Coffee Powder Trash Bags","Packaging & Misc",None, "boxes", 3, 1, "storage_room", None),
    ("190", "55 GAL Large Trash Bags","Packaging & Misc", None, "boxes", 3, 1, "storage_room", None),
    ("191", "20-30 GAL Trash Bags",   "Packaging & Misc", None, "boxes", 1, 1, "storage_room", None),
    ("192", "65 GAL Trash Bags",      "Packaging & Misc", None, "boxes", 1, 1, "storage_room", None),

    # ── Ice Creams ────────────────────────────────────────────────────────────
    ("193", "Apple & Honey",               "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("194", "Autumn Spice Shortbread",     "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("195", "Banana",                      "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("196", "Berry Yogurt",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("197", "Birthday Cake",               "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("198", "Biscoff",                     "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("199", "Butterscotch",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("200", "Cake & Jam",                  "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("201", "Classic Chocolate",           "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("202", "Festive Cake",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("203", "Filter Coffee",               "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("204", "Hazelnut Sugarfree",          "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("205", "Hokey Pokey",                 "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("206", "Jamaican Rum",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("207", "Kheer",                       "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("208", "La Ferrero",                  "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("209", "Lemon Pie",                   "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("210", "Lots of Nuts",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("211", "Lucky Charms",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("212", "Malted Milk",                 "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("213", "Mango",                       "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("214", "Maple Cinnamon Short Bread",  "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("215", "Mint Basil Sorbet",           "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("216", "Mint Chocolate Chip",         "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("217", "Oreo Caramel Fudge",          "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("218", "Peanut Butter Chocolate Chunk","Ice Creams",None, "tubs", 0, 1, "freezer", None),
    ("219", "Pistachio",                   "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("220", "Pumpkin Spice",               "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("221", "Raspberry Mascarpone",        "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("222", "Ruby Cheese",                 "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("223", "Salted Caramel",              "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("224", "Strawberry Chunks",           "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("225", "Vanilla Bean",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("226", "White Chocolate Blondie",     "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("227", "Cookie and Snow",             "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("228", "Chocolate Chip Cookie Dough", "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("229", "Hazelnut Brownie",            "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("230", "Dumont Chocolate",            "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("231", "Chocolate Mudslide",          "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("232", "Vanilla Custard",             "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("233", "Peach",                       "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("234", "G-H-Pie",                     "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("235", "Butter Pecan",                "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("236", "Wild Berry Lavender",         "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("237", "Pandan",                      "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("238", "Mandarin Orange Sorbet",      "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("239", "Caramelized Pineapple",       "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("240", "Sitapal",                     "Ice Creams", None, "tubs", 0, 1, "freezer", None),
    ("241", "Red Guava",                   "Ice Creams", None, "tubs", 0, 1, "freezer", None),

    # ── Milk & Dairy Alternatives (pourable + plant milks; also see 88, 96–100 above) ──
    ("242", "Whole milk (½ gal)",              "Milk & Dairy Alternatives", "Dairy",       "half gallons", 6,  2, "fridge", None),
    ("243", "1% milk",                         "Milk & Dairy Alternatives", "Dairy",       "half gallons", 3,  2, "fridge", None),
    ("244", "2% milk",                         "Milk & Dairy Alternatives", "Dairy",       "half gallons", 6,  2, "fridge", None),
    ("245", "Heavy cream",                     "Milk & Dairy Alternatives", "Dairy",       "containers",   4,  2, "fridge", None),
    ("246", "Oat milk – Chobani (original)",   "Milk & Dairy Alternatives", "Plant milks", "half gallons", 3,  2, "fridge", None),
    ("247", "Oat milk – Chobani Extra Creamy", "Milk & Dairy Alternatives", "Plant milks", "half gallons", 13, 3, "fridge", None),
    ("248", "Soy milk",                        "Milk & Dairy Alternatives", "Plant milks", "half gallons", 10, 3, "fridge", None),
    ("249", "Almond milk",                     "Milk & Dairy Alternatives", "Plant milks", "half gallons", 3,  2, "fridge", None),
    ("250", "Coconut milk",                    "Milk & Dairy Alternatives", "Plant milks", "half gallons", 11, 3, "fridge", None),
    ("251", "Coconut water",                   "Milk & Dairy Alternatives", "Plant milks", "containers",   12, 3, "fridge", None),
]


# ── Runner ────────────────────────────────────────────────────────────────────

def run(*, reset_quantities: bool = False):
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL not set in .env")

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    print("Creating tables...")
    cur.execute(SCHEMA)
    cur.execute(SCHEMA_ALTER)

    print("Seeding users...")
    for uid, name, email, phone, plain_pin, role in USERS:
        cur.execute(
            """INSERT INTO users (id, name, email, phone, pin_hash, role)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
                 pin_hash=EXCLUDED.pin_hash, role=EXCLUDED.role""",
            (uid, name, email, phone, hash_pin(plain_pin), role),
        )
    print(f"  {len(USERS)} users inserted/updated.")

    if reset_quantities:
        print("Seeding inventory items (including quantities from seed — full reset)...")
        conflict_items_sql = """INSERT INTO inventory_items
               (id, name, category, sub_category, unit, current_quantity, low_stock_threshold, storage_location, note)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, category=EXCLUDED.category,
                 sub_category=EXCLUDED.sub_category, unit=EXCLUDED.unit,
                 current_quantity=EXCLUDED.current_quantity,
                 low_stock_threshold=EXCLUDED.low_stock_threshold,
                 storage_location=EXCLUDED.storage_location,
                 note=EXCLUDED.note"""
    else:
        print("Seeding inventory items (preserving existing quantities, offsite, sort order)...")
        conflict_items_sql = """INSERT INTO inventory_items
               (id, name, category, sub_category, unit, current_quantity, low_stock_threshold, storage_location, note)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, category=EXCLUDED.category,
                 sub_category=EXCLUDED.sub_category, unit=EXCLUDED.unit,
                 low_stock_threshold=EXCLUDED.low_stock_threshold,
                 storage_location=EXCLUDED.storage_location,
                 note=EXCLUDED.note"""

    for row in ITEMS:
        item_id, name, category, sub_cat, unit, qty, threshold, loc, note = row
        cur.execute(conflict_items_sql, (item_id, name, category, sub_cat, unit, qty, threshold, loc, note))
    print(f"  {len(ITEMS)} items inserted/updated.")

    conn.commit()
    cur.close()
    conn.close()
    print("Migration complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create tables and seed Dumont inventory data.")
    parser.add_argument(
        "--reset-quantities",
        action="store_true",
        help="Overwrite current_quantity with seed file values (full reset). Default: keep live counts.",
    )
    args = parser.parse_args()
    run(reset_quantities=args.reset_quantities)
