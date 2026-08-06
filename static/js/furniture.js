// ArchinthAI furniture library
// Each furniture item has real-world-ish dimensions (meters) and a 3D shape type.
window.ARCHINTHAI_FURNITURE = {
  categories: [
    { id: "seating", label: "Seating" },
    { id: "tables", label: "Tables & Desks" },
    { id: "sleeping", label: "Sleeping" },
    { id: "storage", label: "Storage" },
    { id: "kitchen", label: "Kitchen" },
    { id: "bath", label: "Bath" },
    { id: "outdoor", label: "Outdoor" }
  ],
  items: [
    // Seating
    { id: "sofa", name: "Sofa", category: "seating", w: 2.2, d: 0.95, h: 0.85, color: "#7f9eb5", shape: "sofa" },
    { id: "loveseat", name: "Loveseat", category: "seating", w: 1.5, d: 0.9, h: 0.85, color: "#8fa3b8", shape: "sofa" },
    { id: "armchair", name: "Armchair", category: "seating", w: 0.9, d: 0.85, h: 0.9, color: "#a08bb0", shape: "chair" },
    { id: "chair", name: "Chair", category: "seating", w: 0.5, d: 0.5, h: 0.9, color: "#b0a08b", shape: "chair" },
    { id: "stool", name: "Stool", category: "seating", w: 0.4, d: 0.4, h: 0.6, color: "#b5a08a", shape: "box" },
    { id: "bench", name: "Bench", category: "seating", w: 1.4, d: 0.4, h: 0.45, color: "#9a8b6f", shape: "box" },
    // Tables & Desks
    { id: "coffee_table", name: "Coffee Table", category: "tables", w: 1.0, d: 0.6, h: 0.45, color: "#8b6f4e", shape: "table" },
    { id: "dining_table", name: "Dining Table", category: "tables", w: 1.8, d: 0.9, h: 0.75, color: "#7a5c3e", shape: "table" },
    { id: "desk", name: "Desk", category: "tables", w: 1.2, d: 0.6, h: 0.75, color: "#6f7a8a", shape: "table" },
    { id: "side_table", name: "Side Table", category: "tables", w: 0.5, d: 0.5, h: 0.55, color: "#8a7a6a", shape: "box" },
    { id: "console", name: "Console Table", category: "tables", w: 1.2, d: 0.4, h: 0.8, color: "#7f6e5c", shape: "table" },
    // Sleeping
    { id: "bed_double", name: "Double Bed", category: "sleeping", w: 1.6, d: 2.0, h: 0.5, color: "#a8b8c8", shape: "bed" },
    { id: "bed_single", name: "Single Bed", category: "sleeping", w: 0.9, d: 1.9, h: 0.5, color: "#b8c8d8", shape: "bed" },
    { id: "bed_king", name: "King Bed", category: "sleeping", w: 1.8, d: 2.0, h: 0.5, color: "#98a8b8", shape: "bed" },
    { id: "crib", name: "Crib", category: "sleeping", w: 0.7, d: 1.2, h: 0.9, color: "#c8b8a8", shape: "box" },
    // Storage
    { id: "wardrobe", name: "Wardrobe", category: "storage", w: 1.5, d: 0.6, h: 2.0, color: "#8a6a4a", shape: "box" },
    { id: "dresser", name: "Dresser", category: "storage", w: 1.2, d: 0.5, h: 1.0, color: "#9a7a5a", shape: "box" },
    { id: "bookshelf", name: "Bookshelf", category: "storage", w: 0.9, d: 0.3, h: 1.8, color: "#7a6a5a", shape: "box" },
    { id: "cabinet", name: "Cabinet", category: "storage", w: 0.8, d: 0.4, h: 0.9, color: "#8a7a6a", shape: "box" },
    { id: "shelf", name: "Shelf", category: "storage", w: 1.0, d: 0.3, h: 0.8, color: "#9a8a7a", shape: "box" },
    // Kitchen
    { id: "kitchen_counter", name: "Kitchen Counter", category: "kitchen", w: 2.0, d: 0.6, h: 0.9, color: "#b8c8d0", shape: "kitchen_counter" },
    { id: "kitchen_island", name: "Kitchen Island", category: "kitchen", w: 1.6, d: 1.0, h: 0.9, color: "#c0d0d8", shape: "kitchen_counter" },
    { id: "fridge", name: "Fridge", category: "kitchen", w: 0.7, d: 0.7, h: 1.8, color: "#cfd8e0", shape: "box" },
    { id: "stove", name: "Stove", category: "kitchen", w: 0.6, d: 0.6, h: 0.9, color: "#606060", shape: "box" },
    { id: "sink", name: "Sink", category: "kitchen", w: 0.8, d: 0.55, h: 0.9, color: "#d0d8e0", shape: "box" },
    // Bath
    { id: "bathtub", name: "Bathtub", category: "bath", w: 1.7, d: 0.75, h: 0.6, color: "#e8eff5", shape: "bathtub" },
    { id: "toilet", name: "Toilet", category: "bath", w: 0.4, d: 0.7, h: 0.75, color: "#f0f4f8", shape: "toilet" },
    { id: "vanity", name: "Vanity", category: "bath", w: 0.9, d: 0.5, h: 0.85, color: "#dfe7ee", shape: "box" },
    { id: "shower", name: "Shower", category: "bath", w: 0.9, d: 0.9, h: 2.0, color: "#cfdfee", shape: "box" },
    // Outdoor
    { id: "plant", name: "Plant", category: "outdoor", w: 0.5, d: 0.5, h: 1.2, color: "#5a9a5a", shape: "plant" },
    { id: "outdoor_chair", name: "Outdoor Chair", category: "outdoor", w: 0.6, d: 0.6, h: 0.85, color: "#8a9a7a", shape: "chair" },
    { id: "outdoor_table", name: "Outdoor Table", category: "outdoor", w: 1.0, d: 0.7, h: 0.7, color: "#7a8a6a", shape: "table" },
    { id: "bbq", name: "BBQ Grill", category: "outdoor", w: 0.8, d: 0.6, h: 0.9, color: "#555555", shape: "box" }
  ]
};

// Helper to get a furniture item by id
window.ArchinthaiFurniture = {
  getById: function (id) {
    return (window.ARCHINTHAI_FURNITURE.items || []).find((f) => f.id === id) || null;
  },
  getByCategory: function (catId) {
    return (window.ARCHINTHAI_FURNITURE.items || []).filter((f) => f.category === catId);
  }
};
