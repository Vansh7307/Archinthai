// ArchinthAI preset project templates (ported from backend/templates_data.py)
window.ARCHINTHAI_TEMPLATES = [
  {
    id: "urban_family",
    name: "Urban Family Villa",
    summary: "Basement parking, social ground floor, bedroom-focused first floor.",
    config: {
      project_name: "ArchinthAI Project",
      plot_width: 20.0,
      plot_depth: 16.0,
      style: "Modern",
      include_basement: true,
      floor_count: 2,
      include_roof: true,
      facade_theme: "Glass + Concrete",
      road_side: "south",
      north_direction: "up",
      setback_front: 0.0,
      setback_rear: 0.0,
      setback_left: 0.0,
      setback_right: 0.0,
      levels: [
        {
          level_id: "basement",
          label: "Basement",
          level_type: "basement",
          enabled: true,
          room_requests: [
            { room_type: "Parking", count: 1, custom: false, preferred_zone: null },
            { room_type: "Storage", count: 1, custom: false, preferred_zone: null },
            { room_type: "Laundry", count: 1, custom: false, preferred_zone: null },
            { room_type: "Gym", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "ground",
          label: "Ground Floor",
          level_type: "ground",
          enabled: true,
          room_requests: [
            { room_type: "Living Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Dining Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Kitchen", count: 1, custom: false, preferred_zone: null },
            { room_type: "Study", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bathroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Stair", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "first_floor",
          label: "First Floor",
          level_type: "floor",
          enabled: true,
          room_requests: [
            { room_type: "Master Bedroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bedroom", count: 2, custom: false, preferred_zone: null },
            { room_type: "Attached Bathroom", count: 2, custom: false, preferred_zone: null },
            { room_type: "Balcony", count: 1, custom: false, preferred_zone: null },
            { room_type: "Family Lounge", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "roof",
          label: "Roof",
          level_type: "roof",
          enabled: true,
          room_requests: [
            { room_type: "Solar Panels", count: 1, custom: false, preferred_zone: null },
            { room_type: "Water Tank", count: 1, custom: false, preferred_zone: null },
            { room_type: "Sit-out Area", count: 1, custom: false, preferred_zone: null }
          ]
        }
      ]
    }
  },
  {
    id: "compact_duplex",
    name: "Compact Duplex",
    summary: "Small-plot duplex with efficient stacking and roof terrace.",
    config: {
      project_name: "ArchinthAI Project",
      plot_width: 14.0,
      plot_depth: 12.0,
      style: "Minimal",
      include_basement: false,
      floor_count: 2,
      include_roof: true,
      facade_theme: "Warm Minimal",
      road_side: "south",
      north_direction: "up",
      setback_front: 0.0,
      setback_rear: 0.0,
      setback_left: 0.0,
      setback_right: 0.0,
      levels: [
        {
          level_id: "ground",
          label: "Ground Floor",
          level_type: "ground",
          enabled: true,
          room_requests: [
            { room_type: "Living Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Dining Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Kitchen", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bathroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Stair", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "first_floor",
          label: "First Floor",
          level_type: "floor",
          enabled: true,
          room_requests: [
            { room_type: "Master Bedroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bedroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bathroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Balcony", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "roof",
          label: "Roof",
          level_type: "roof",
          enabled: true,
          room_requests: [
            { room_type: "Terrace Garden", count: 1, custom: false, preferred_zone: null },
            { room_type: "Sit-out Area", count: 1, custom: false, preferred_zone: null }
          ]
        }
      ]
    }
  },
  {
    id: "luxury_stack",
    name: "Luxury Stacked Home",
    summary: "Three levels, home office, theater, and curated roof use.",
    config: {
      project_name: "ArchinthAI Project",
      plot_width: 22.0,
      plot_depth: 18.0,
      style: "Contemporary",
      include_basement: true,
      floor_count: 3,
      include_roof: true,
      facade_theme: "Stone + Glass",
      road_side: "south",
      north_direction: "up",
      setback_front: 0.0,
      setback_rear: 0.0,
      setback_left: 0.0,
      setback_right: 0.0,
      levels: [
        {
          level_id: "basement",
          label: "Basement",
          level_type: "basement",
          enabled: true,
          room_requests: [
            { room_type: "Parking", count: 1, custom: false, preferred_zone: null },
            { room_type: "Home Theater", count: 1, custom: false, preferred_zone: null },
            { room_type: "Storage", count: 1, custom: false, preferred_zone: null },
            { room_type: "Gym", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "ground",
          label: "Ground Floor",
          level_type: "ground",
          enabled: true,
          room_requests: [
            { room_type: "Living Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Dining Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Kitchen", count: 1, custom: false, preferred_zone: null },
            { room_type: "Office", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bathroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Stair", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "first_floor",
          label: "First Floor",
          level_type: "floor",
          enabled: true,
          room_requests: [
            { room_type: "Master Bedroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bedroom", count: 2, custom: false, preferred_zone: null },
            { room_type: "Attached Bathroom", count: 2, custom: false, preferred_zone: null },
            { room_type: "Family Lounge", count: 1, custom: false, preferred_zone: null },
            { room_type: "Balcony", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "second_floor",
          label: "Second Floor",
          level_type: "floor",
          enabled: true,
          room_requests: [
            { room_type: "Guest Room", count: 1, custom: false, preferred_zone: null },
            { room_type: "Study", count: 1, custom: false, preferred_zone: null },
            { room_type: "Bathroom", count: 1, custom: false, preferred_zone: null },
            { room_type: "Terrace Garden", count: 1, custom: false, preferred_zone: null }
          ]
        },
        {
          level_id: "roof",
          label: "Roof",
          level_type: "roof",
          enabled: true,
          room_requests: [
            { room_type: "Solar Panels", count: 1, custom: false, preferred_zone: null },
            { room_type: "Sit-out Area", count: 1, custom: false, preferred_zone: null },
            { room_type: "Water Tank", count: 1, custom: false, preferred_zone: null }
          ]
        }
      ]
    }
  }
];
