export type ItemCategory = "electronics" | "furniture" | "clothing" | "collectibles" | "tools" | "misc";

export type ItemTemplate = {
    name: string;
    category: ItemCategory;
    internalValue: number;
};

export const ITEM_TEMPLATES: ItemTemplate[] = [
    // Electronics
    { name: "Broken Laptop", category: "electronics", internalValue: 45 },
    { name: "Old CRT Monitor", category: "electronics", internalValue: 30 },
    { name: "Vintage Radio", category: "electronics", internalValue: 65 },
    { name: "Tangled Headphones", category: "electronics", internalValue: 12 },
    { name: "Cracked Tablet", category: "electronics", internalValue: 38 },
    { name: "Digital Camera (No Charger)", category: "electronics", internalValue: 55 },
    { name: "Old Gaming Console", category: "electronics", internalValue: 80 },
    { name: "Wireless Keyboard", category: "electronics", internalValue: 18 },

    // Furniture
    { name: "Wobbly Bar Stool", category: "furniture", internalValue: 20 },
    { name: "Scratched Coffee Table", category: "furniture", internalValue: 35 },
    { name: "Fold-out Lawn Chair", category: "furniture", internalValue: 14 },
    { name: "Vintage Lamp", category: "furniture", internalValue: 50 },
    { name: "Bookshelf (Missing Shelf)", category: "furniture", internalValue: 25 },
    { name: "Rocking Chair", category: "furniture", internalValue: 60 },

    // Clothing
    { name: "Leather Jacket (Worn)", category: "clothing", internalValue: 40 },
    { name: "Vintage Band Tee", category: "clothing", internalValue: 22 },
    { name: "Cowboy Boots", category: "clothing", internalValue: 55 },
    { name: "Fur Coat (Faux)", category: "clothing", internalValue: 30 },
    { name: "Denim Overalls", category: "clothing", internalValue: 18 },

    // Collectibles
    { name: "Baseball Card (Unknown Player)", category: "collectibles", internalValue: 15 },
    { name: "Porcelain Figurine", category: "collectibles", internalValue: 45 },
    { name: "Old Comic Book", category: "collectibles", internalValue: 35 },
    { name: "Coin Collection (Partial)", category: "collectibles", internalValue: 70 },
    { name: "Signed Poster (Unverified)", category: "collectibles", internalValue: 28 },
    { name: "Snow Globe", category: "collectibles", internalValue: 12 },
    { name: "Vintage Lunchbox", category: "collectibles", internalValue: 40 },

    // Tools
    { name: "Rusty Hand Saw", category: "tools", internalValue: 10 },
    { name: "Power Drill (No Bits)", category: "tools", internalValue: 32 },
    { name: "Toolbox (Half Empty)", category: "tools", internalValue: 28 },
    { name: "Vintage Pocket Knife", category: "tools", internalValue: 48 },
    { name: "Level & Square Set", category: "tools", internalValue: 20 },

    // Misc
    { name: "Box of Old VHS Tapes", category: "misc", internalValue: 8 },
    { name: "Jigsaw Puzzle (Possibly Incomplete)", category: "misc", internalValue: 5 },
    { name: "Framed Painting (Unknown Artist)", category: "misc", internalValue: 55 },
    { name: "Typewriter", category: "misc", internalValue: 90 },
    { name: "Sewing Machine (Vintage)", category: "misc", internalValue: 75 },
    { name: "Rotary Phone", category: "misc", internalValue: 42 },
    { name: "Bag of Miscellaneous Cables", category: "misc", internalValue: 3 },
];
