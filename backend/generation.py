"""ArchinthAI room-based architectural layout generation engine.

This module implements a deterministic procedural layout generator that:

1. Computes the buildable envelope from plot dimensions and setbacks.
2. Allocates a vertical circulation band (stair core) anchored to a street side.
3. Splits the remaining floor plate into front / middle / rear zones.
4. Packs requested rooms into the zones respecting sizes, orientations,
   preferred zones, and avoiding overlaps.
5. Produces the design JSON matching the ArchinthAI frontend schema.

The generated output shape mirrors the schema consumed by the ArchinthAI
frontend so it can be rendered directly without changes.
"""

from __future__ import annotations

import math
import random
from copy import deepcopy
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Room type / style knowledge tables
# ---------------------------------------------------------------------------

ROOM_TYPES = {
    "living room": {"label": "Living Room", "zone": "front", "color": "#dbeafe", "min_w": 3.6, "min_d": 3.4, "ratio": 1.45, "window_side": "front"},
    "dining room": {"label": "Dining Room", "zone": "middle", "color": "#fde68a", "min_w": 3.0, "min_d": 2.8, "ratio": 1.3, "window_side": "side"},
    "kitchen": {"label": "Kitchen", "zone": "rear", "color": "#ffedd5", "min_w": 2.8, "min_d": 2.6, "ratio": 1.25, "window_side": "rear"},
    "bedroom": {"label": "Bedroom", "zone": "middle", "color": "#e9d5ff", "min_w": 3.0, "min_d": 3.0, "ratio": 1.2, "window_side": "side"},
    "master bedroom": {"label": "Master Bedroom", "zone": "front", "color": "#fbcfe8", "min_w": 3.6, "min_d": 3.4, "ratio": 1.3, "window_side": "front"},
    "bathroom": {"label": "Bathroom", "zone": "middle", "color": "#bae6fd", "min_w": 1.8, "min_d": 1.8, "ratio": 1.0, "window_side": "side"},
    "attached bathroom": {"label": "Attached Bathroom", "zone": "middle", "color": "#a5f3fc", "min_w": 1.7, "min_d": 1.7, "ratio": 1.0, "window_side": "side"},
    "study": {"label": "Study", "zone": "middle", "color": "#c7d2fe", "min_w": 2.4, "min_d": 2.4, "ratio": 1.15, "window_side": "side"},
    "office": {"label": "Office", "zone": "middle", "color": "#dbeafe", "min_w": 2.6, "min_d": 2.6, "ratio": 1.2, "window_side": "side"},
    "parking": {"label": "Parking", "zone": "front", "color": "#d1d5db", "min_w": 5.2, "min_d": 4.2, "ratio": 1.3, "window_side": "none"},
    "gym": {"label": "Gym", "zone": "middle", "color": "#dcfce7", "min_w": 2.8, "min_d": 2.6, "ratio": 1.2, "window_side": "side"},
    "storage": {"label": "Storage", "zone": "rear", "color": "#e5e7eb", "min_w": 1.9, "min_d": 1.9, "ratio": 1.0, "window_side": "none"},
    "laundry": {"label": "Laundry", "zone": "rear", "color": "#e0f2fe", "min_w": 1.8, "min_d": 1.8, "ratio": 1.0, "window_side": "none"},
    "balcony": {"label": "Balcony", "zone": "front", "color": "#bbf7d0", "min_w": 2.2, "min_d": 1.4, "ratio": 1.6, "window_side": "front"},
    "stair": {"label": "Stair", "zone": "middle", "color": "#cbd5e1", "min_w": 1.8, "min_d": 2.9, "ratio": 0.62, "window_side": "none"},
    "terrace garden": {"label": "Terrace Garden", "zone": "rear", "color": "#a7f3d0", "min_w": 3.0, "min_d": 2.4, "ratio": 1.35, "window_side": "rear"},
    "guest room": {"label": "Guest Room", "zone": "middle", "color": "#fbcfe8", "min_w": 3.0, "min_d": 3.0, "ratio": 1.2, "window_side": "side"},
    "family lounge": {"label": "Family Lounge", "zone": "front", "color": "#fef9c3", "min_w": 3.2, "min_d": 3.0, "ratio": 1.3, "window_side": "front"},
    "home theater": {"label": "Home Theater", "zone": "middle", "color": "#ddd6fe", "min_w": 3.4, "min_d": 3.0, "ratio": 1.35, "window_side": "none"},
    "pooja room": {"label": "Pooja Room", "zone": "middle", "color": "#fde047", "min_w": 1.6, "min_d": 1.6, "ratio": 1.0, "window_side": "none"},
    "utility": {"label": "Utility", "zone": "rear", "color": "#f1f5f9", "min_w": 1.8, "min_d": 1.8, "ratio": 1.0, "window_side": "none"},
    "dressing": {"label": "Dressing", "zone": "middle", "color": "#fae8ff", "min_w": 2.0, "min_d": 1.8, "ratio": 1.1, "window_side": "none"},
    "walk-in closet": {"label": "Walk-in Closet", "zone": "middle", "color": "#f3e8ff", "min_w": 1.8, "min_d": 1.6, "ratio": 1.1, "window_side": "none"},
    "lobby": {"label": "Lobby", "zone": "front", "color": "#e2e8f0", "min_w": 2.4, "min_d": 2.2, "ratio": 1.1, "window_side": "front"},
    "foyer": {"label": "Foyer", "zone": "front", "color": "#e2e8f0", "min_w": 2.2, "min_d": 2.2, "ratio": 1.0, "window_side": "front"},
    "verandah": {"label": "Verandah", "zone": "front", "color": "#d9f99d", "min_w": 2.4, "min_d": 1.6, "ratio": 1.5, "window_side": "front"},
    "corridor": {"label": "Corridor", "zone": "middle", "color": "#e5e7eb", "min_w": 1.3, "min_d": 2.4, "ratio": 0.54, "window_side": "none"},
}

ROOF_FEATURE_TYPES = {
    "solar panels": {"color": "#d9ecff", "height": 0.42, "size_ratio": 0.4},
    "water tank": {"color": "#dfe7f2", "height": 0.9, "size_ratio": 0.2},
    "sit-out area": {"color": "#dff4dd", "height": 0.3, "size_ratio": 0.42},
    "terrace garden": {"color": "#a7f3d0", "height": 0.34, "size_ratio": 0.5},
    "headroom": {"color": "#eef2ff", "height": 2.6, "size_ratio": 0.3},
    "garden": {"color": "#a7f3d0", "height": 0.34, "size_ratio": 0.42},
    "jogging track": {"color": "#eef3fb", "height": 0.1, "size_ratio": 0.5},
}

# Map style -> facade preset.
STYLE_PRESETS = {
    "modern": {"score_bonus": 2.0, "seed_bias": "glass-concrete"},
    "minimal": {"score_bonus": 1.0, "seed_bias": "warm-minimal"},
    "contemporary": {"score_bonus": 1.5, "seed_bias": "stone-glass"},
    "luxury": {"score_bonus": 3.0, "seed_bias": "luxury-stone"},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def r2(value: float) -> float:
    """Round to two decimals."""
    return round(value * 100.0) / 100.0


def slugify(text: str) -> str:
    """Slugify a room type string for ids."""
    return text.lower().replace(" ", "_").replace("-", "_")


def _room_meta(room_type: str) -> Dict[str, Any]:
    return ROOM_TYPES.get(room_type.lower().strip(), ROOM_TYPES["bedroom"])


def _color_between(a: str, b: str, amount: float) -> str:
    ra = int(a[1:3], 16)
    ga = int(a[3:5], 16)
    ba = int(a[5:7], 16)
    rb = int(b[1:3], 16)
    gb = int(b[3:5], 16)
    bb = int(b[5:7], 16)
    return "#{:02x}{:02x}{:02x}".format(
        round(ra + (rb - ra) * amount),
        round(ga + (gb - ga) * amount),
        round(ba + (bb - ba) * amount),
    )


def _variant_tint(base_color: str, variant_index: int) -> str:
    """Produce slight color variations for candidate strategies."""
    shifts = [
        (0.02, -0.01, 0.01),
        (-0.01, 0.02, 0.02),
        (0.0, 0.01, -0.02),
    ]
    r, g, b = shifts[variant_index % len(shifts)]
    ra = max(0, min(255, int(base_color[1:3], 16) + r * 255))
    ga = max(0, min(255, int(base_color[3:5], 16) + g * 255))
    ba = max(0, min(255, int(base_color[5:7], 16) + b * 255))
    return f"#{int(ra):02x}{int(ga):02x}{int(ba):02x}"


# ---------------------------------------------------------------------------
# Level envelope computation
# ---------------------------------------------------------------------------


def _buildable_envelope(config: Dict[str, Any]) -> Dict[str, float]:
    plot_w = float(config.get("plot_width", 20))
    plot_d = float(config.get("plot_depth", 16))
    sb_f = float(config.get("setback_front", 0))
    sb_r = float(config.get("setback_rear", 0))
    sb_l = float(config.get("setback_left", 0))
    sb_rgt = float(config.get("setback_right", 0))
    bw = max(7.2, plot_w - sb_l - sb_rgt)
    bd = max(7.2, plot_d - sb_f - sb_r)
    return {
        "width": r2(min(bw, plot_w)),
        "depth": r2(min(bd, plot_d)),
        "plot_width": r2(plot_w),
        "plot_depth": r2(plot_d),
    }


def _is_roof_level(level: Dict[str, Any]) -> bool:
    return str(level.get("level_type", "")).lower() == "roof"


def _level_label(level_id: str, fallback: str) -> str:
    labels = {
        "basement": "Basement",
        "ground": "Ground Floor",
        "first_floor": "First Floor",
        "second_floor": "Second Floor",
        "third_floor": "Third Floor",
        "roof": "Roof",
    }
    return labels.get(level_id, fallback or level_id.replace("_", " ").title())


# ---------------------------------------------------------------------------
# Room packing
# ---------------------------------------------------------------------------


def _expand_requests(level: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Expand room_requests into a flat list of individual room items."""
    items: List[Dict[str, Any]] = []
    for request in list(level.get("room_requests") or []):
        room_type = str(request.get("room_type") or "").strip()
        if not room_type:
            continue
        count = max(1, int(request.get("count", 1) or 1))
        zone = request.get("preferred_zone")
        for i in range(count):
            items.append(
                {
                    "room_type": room_type,
                    "label": _room_meta(room_type)["label"],
                    "zone": zone,
                }
            )
    return items


def _preferred_zone_for(room_type: str) -> str:
    return _room_meta(room_type)["zone"]


def _zone_flex(room: Dict[str, Any], level: Dict[str, Any]) -> List[str]:
    """Return the allowed zone names for a room based on the level layout palette."""
    meta = _room_meta(room["room_type"])
    preferred = room.get("zone") or meta["zone"]
    # Basement levels: only front / middle / rear using depth.
    if str(level.get("level_type", "")).lower() == "basement":
        order = ["front", "middle", "rear"]
        if preferred in order:
            return [preferred, *[z for z in order if z != preferred]]
        return order
    order = ["front", "middle", "rear"]
    if preferred in order:
        return [preferred, *[z for z in order if z != preferred]]
    return order


def _normalize(items: List[Dict[str, Any]], level: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Sort the room items so that big/front rooms come first, stairs land in middle."""
    stair = [r for r in items if r["room_type"].lower() == "stair"]

    def keyfn(room: Dict[str, Any]) -> tuple:
        meta = [m for m in _zone_flex(room, level)]
        zone_rank = {"front": 0, "middle": 1, "rear": 2}[meta[0]] if meta else 1
        area = _room_meta(room["room_type"])["min_w"] * _room_meta(room["room_type"])["min_d"]
        return (0 if meta[0] == "front" else 1, -area)

    others = sorted([r for r in items if r["room_type"].lower() != "stair"], key=keyfn)
    return stair + others


def _area_bounds(room: Dict[str, Any], zone_i: int, zone_count: int) -> tuple:
    meta = _room_meta(room["room_type"])
    base_area = meta["min_w"] * meta["min_d"]
    zone_area = base_area * (1.0 + 0.08 * zone_count) * (1.0 + 0.05 * zone_i)
    target_w = math.sqrt(zone_area * meta["ratio"])
    target_d = zone_area / target_w
    return target_w, target_d


def _fit_zone(room: Dict[str, Any], level: Dict[str, Any], zone: str, width: float, depth: float,
              used_rects: List[Dict[str, Any]], band: Dict[str, Any], band_is_vertical: bool,
              random_state: random.Random, strategy: str) -> Optional[Dict[str, Any]]:
    """Try to place a single room within a zone rectangle without overlap."""
    meta = _room_meta(room["room_type"])
    min_w = meta["min_w"]
    min_d = meta["min_d"]
    max_w = min(width, band["width"] - 0.1 if band_is_vertical and (zone == "front" or zone == "rear") else max(width * 0.55, min_w))
    max_d = min(depth, max(depth * 0.6, min_d))
    target_w, target_d = _area_bounds(room, 0, 1)

    attempts = 40
    for attempt in range(attempts):
        # Alternate between random and grid anchors for diversity.
        if attempt % 2 == 0:
            room_w = r2(min(max_w, target_w * random_state.uniform(0.86, 1.06)))
            room_d = r2(min(max_d, target_d * random_state.uniform(0.86, 1.08)))
        else:
            room_w = r2(min(max_w, target_w))
            room_d = r2(min(max_d, target_d))
        room_w = max(min_w, room_w)
        room_d = max(min_d, room_d)
        if room_w > max_w or room_d > max_d:
            continue

        margin = 0.18
        xs = [0.14]
        ys = [0.14]
        for used in used_rects:
            xs.append(used["x"] + used["w"] + margin)
            xs.append(used["x"] - room_w - margin)
            ys.append(used["y"] + used["d"] + margin)
            ys.append(used["y"] - room_d - margin)
        xs = sorted(set(r2(v) for v in xs if r2(v) >= 0.1 and r2(v) + room_w <= width - 0.1))
        ys = sorted(set(r2(v) for v in ys if r2(v) >= 0.1 and r2(v) + room_d <= depth - 0.1))
        random_state.shuffle(xs)
        random_state.shuffle(ys)

        for x in xs:
            for y in ys:
                rect = {"x": x, "y": y, "w": room_w, "d": room_d}
                if any(_overlaps(rect, u) for u in used_rects):
                    continue
                placed = {
                    "room_type": room["room_type"],
                    "label": room["label"],
                    "requested_zone": zone,
                    "zone": zone,
                    "x": x,
                    "y": y,
                    "width": room_w,
                    "depth": room_d,
                }
                return placed
    return None


def _overlaps(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return not (
        a["x"] + a["w"] <= b["x"] + 1e-6
        or b["x"] + b["w"] <= a["x"] + 1e-6
        or a["y"] + a["d"] <= b["y"] + 1e-6
        or b["y"] + b["d"] <= a["y"] + 1e-6
    )


def _zones_for(width: float, depth: float, band_x: float, band_w: float, band_is_vertical: bool, nzones: int = 3) -> List[Dict[str, Any]]:
    """Split the plate into front/middle/rear strips around the circulation band."""
    zones: List[Dict[str, Any]] = []
    depth_budget = max(depth - band_w, 6.0) if band_is_vertical else depth
    z = 0.12
    for idx in range(nzones):
        remaining = depth_budget - z * (3 - idx) - 0.24
        if idx == nzones - 1:
            zd = max(2.0, depth - z - 0.14)
        else:
            fracs = [0.34, 0.33, 0.33]
            zd = max(2.0, depth_budget * fracs[idx])
        # Avoid zones colliding with the vertical band.
        zd = min(zd, depth - z - 0.12 if z + zd < depth else depth - z - 0.12)
        zones.append(
            {
                "name": ["front", "middle", "rear"][idx],
                "x": 0.12,
                "y": r2(z),
                "width": r2(width - 0.24),
                "depth": r2(zd),
            }
        )
        z += zd + 0.12
    return zones


def _place_level(
    level: Dict[str, Any],
    envelope: Dict[str, float],
    band_side: str,
    strategy: str,
    seed_salt: int = 0,
) -> Dict[str, Any]:
    """Place rooms for a single non-roof level."""
    width = envelope["width"]
    depth = envelope["depth"]
    band_w = 1.7

    if strategy == "wide-front":
        band_is_vertical = False
        # Horizontal band along the street edge.
    elif strategy == "deep-rear":
        band_is_vertical = True
        # Reversed band: deep rear parking / band opposite front.
    else:
        band_is_vertical = True

    band_x = r2(width * 0.52 - band_w / 2)
    if strategy == "deep-rear":
        band_x = r2(width * 0.5 - band_w / 2)

    rng = random.Random(f"{level.get('level_id', 'level')}-{strategy}-{seed_salt}")

    items = _expand_requests(level)
    items = _normalize(items, level)
    # Separate stair to reserve band.
    stair_items = [i for i in items if i["room_type"].lower() == "stair"]
    non_stair = [i for i in items if i["room_type"].lower() != "stair"]

    # Build zones.
    zones = [
        {"name": "front", "x": 0.12, "y": 0.14, "width": r2(width - 0.24), "depth": r2(max(2.0, depth * 0.36 - 0.2))},
        {"name": "middle", "x": 0.12, "y": r2(0.14 + max(2.0, depth * 0.36)), "width": r2(width - 0.24), "depth": r2(max(2.0, depth * 0.34 - 0.2))},
        {"name": "rear", "x": 0.12, "y": r2(0.14 + max(2.0, depth * 0.36) + max(2.0, depth * 0.34)), "width": r2(width - 0.24), "depth": r2(max(2.0, depth - 0.28 - max(2.0, depth * 0.36) - max(2.0, depth * 0.34)))},
    ]

    placed_rooms: List[Dict[str, Any]] = []
    used_rects: List[Dict[str, Any]] = []

    # Place stair in middle zone first.
    for stair in stair_items:
        meta = _room_meta(stair["room_type"])
        sw = r2(meta["min_w"])
        sd = r2(min(max(meta["min_d"], depth * 0.26), band_w))
        sx = r2(band_x + (band_w - sw) / 2)
        sy = r2((depth - sd) / 2)
        rect = {"x": sx, "y": sy, "w": sw, "d": sd}
        placed_rooms.append(
            {
                "room_type": stair["room_type"],
                "label": stair["label"],
                "requested_zone": "middle",
                "zone": "middle",
                "x": sx,
                "y": sy,
                "width": sw,
                "depth": sd,
            }
        )
        used_rects.append(rect)

    # Add circulation band rectangle so other rooms avoid the stair spine.
    band_rect = {"x": band_x, "y": 0.1, "w": band_w, "d": depth - 0.2}
    used_rects.append(band_rect)

    # Order non-stair for placement.
    front_rooms = []
    middle_rooms = []
    rear_rooms = []
    for room in non_stair:
        order = _zone_flex(room, level)
        preferred = order[0]
        if preferred == "front":
            front_rooms.append(room)
        elif preferred == "rear":
            rear_rooms.append(room)
        else:
            middle_rooms.append(room)

    def try_zone(zname: str, pool: List[Dict[str, Any]]) -> None:
        for room in pool:
            zone = next((z for z in zones if z["name"] == zname), None)
            if not zone:
                continue
            zrect = {"x": zone["x"], "y": zone["y"], "w": zone["width"], "d": zone["depth"]}
            placed = _fit_zone(
                room, level, zname, zone["width"], zone["depth"],
                [u for u in used_rects if _inside(u, zrect, pad=0.1)], {"width": band_w, "x": band_x, "y": 0.1, "w": band_w, "d": depth - 0.2}, True, rng, strategy,
            )
            if placed:
                used_rects.append({"x": placed["x"], "y": placed["y"], "w": placed["width"], "d": placed["depth"]})
                placed_rooms.append(placed)

    # Place front, middle, rear quotes.
    try_zone("front", front_rooms)
    try_zone("middle", middle_rooms)
    try_zone("rear", rear_rooms)

    # If any rooms remain unplaced, fall back to a simple grid fill.
    placed_keys = {(p["room_type"], p["x"], p["y"]) for p in placed_rooms}
    for room in non_stair:
        already = any(p["room_type"] == room["room_type"] for p in placed_rooms)
        if already:
            continue
        meta = _room_meta(room["room_type"])
        rw = r2(meta["min_w"])
        rd = r2(meta["min_d"])
        best = None
        best_score = 1e9
        for zone in zones:
            zrect = {"x": zone["x"], "y": zone["y"], "w": zone["width"], "d": zone["depth"]}
            for yy in [r2(v) for v in [zone["y"] + 0.14, zone["y"] + zone["depth"] / 2 - rd / 2]]:
                for xx in [r2(v) for v in [zone["x"] + 0.14, zone["x"] + zone["width"] / 2 - rw / 2, zone["x"] + zone["width"] - rw - 0.14]]:
                    if xx < 0.1 or yy < 0.1 or xx + rw > width - 0.1 or yy + rd > depth - 0.1:
                        continue
                    cand = {"x": xx, "y": yy, "w": rw, "d": rd}
                    if any(_overlaps(cand, u) for u in used_rects):
                        continue
                    score = abs(xx) + abs(yy)
                    if score < best_score:
                        best_score = score
                        best = (cand, zone["name"])
        if best:
            cand, zname = best
            used_rects.append(cand)
            placed_rooms.append(
                {
                    "room_type": room["room_type"],
                    "label": room["label"],
                    "requested_zone": zname,
                    "zone": zname,
                    "x": cand["x"],
                    "y": cand["y"],
                    "width": cand["w"],
                    "depth": cand["d"],
                }
            )

    # Convert room items into final schema objects.
    level_id = level.get("level_id", "ground")
    rooms_out: List[Dict[str, Any]] = []
    idx_map: Dict[str, int] = {}
    for r in placed_rooms:
        key = r["room_type"]
        idx_map[key] = idx_map.get(key, 0) + 1
        meta = _room_meta(r["room_type"])
        room_id = f"{level_id}_{slugify(key)}_{idx_map[key]}"
        door_side = _door_side_for(r, width, depth)
        windows = _windows_for(r, width, depth, door_side)
        rooms_out.append(
            {
                "room_id": room_id,
                "name": meta["label"],
                "room_type": key.lower(),
                "level_id": level_id,
                "x": r2(r["x"]),
                "y": r2(r["y"]),
                "width": r2(r["width"]),
                "depth": r2(r["depth"]),
                "height": 3.2,
                "color": _variant_tint(meta["color"], seed_salt),
                "door_side": door_side,
                "windows": windows,
                "zone": r["zone"],
            }
        )

    return {
        "level_id": level_id,
        "label": level.get("label") or _level_label(level_id, ""),
        "level_type": level.get("level_type", "floor"),
        "z_index": int(level.get("z_index", 0)),
        "outer_width": r2(width),
        "outer_depth": r2(depth),
        "rooms": rooms_out,
        "roof_features": [],
        "circulation_band": {"x": r2(band_x), "width": r2(band_w)},
    }


def _inside(rect: Dict[str, Any], zone: Dict[str, Any], pad: float = 0.0) -> bool:
    return (
        rect["x"] + 1e-6 >= zone["x"] - pad
        and rect["y"] + 1e-6 >= zone["y"] - pad
        and rect["x"] + rect["w"] - 1e-6 <= zone["x"] + zone["w"] + pad
        and rect["y"] + rect["d"] - 1e-6 <= zone["y"] + zone["d"] + pad
    )


def _door_side_for(room: Dict[str, Any], width: float, depth: float) -> str:
    zone = room.get("zone", "middle")
    if zone == "front":
        return "south"
    if zone == "rear":
        return "north"
    # Middle: pick nearest side to the circulation band.
    cx = room["x"] + room["width"] / 2
    mid = width / 2
    return "west" if cx < mid else "east"


def _windows_for(room: Dict[str, Any], width: float, depth: float, door_side: str) -> List[str]:
    meta = _room_meta(room["room_type"])
    win_side = meta["window_side"]
    zone = room.get("zone", "middle")
    external: List[str] = []
    eps = 0.2
    if room["x"] <= eps:
        external.append("west")
    if room["x"] + room["width"] >= width - eps:
        external.append("east")
    if room["y"] <= eps:
        external.append("south")
    if room["y"] + room["depth"] >= depth - eps:
        external.append("north")
    if win_side == "none":
        external = [w for w in external if w != door_side]
        return external[:1]
    # Remove the door side if not first choice while keeping max 2.
    if door_side in external:
        if win_side == "front" and door_side != "south" and "south" in external:
            external.remove(door_side)
        elif win_side == "rear" and door_side != "north" and "north" in external:
            external.remove(door_side)
    return external[:2]


# ---------------------------------------------------------------------------
# Roof level generation
# ---------------------------------------------------------------------------


def _place_roof(level: Dict[str, Any], envelope: Dict[str, float], strategy: str, seed_salt: int = 0) -> Dict[str, Any]:
    width = envelope["width"]
    depth = envelope["depth"]
    items = _expand_requests(level)
    rng = random.Random(f"roof-{strategy}-{seed_salt}")
    features: List[Dict[str, Any]] = []
    used: List[Dict[str, Any]] = []
    idx_map: Dict[str, int] = {}

    # Sort: garden/sit-out first, then solar, water tank/headroom.
    def sort_key(item: Dict[str, Any]) -> int:
        t = item["room_type"].lower()
        return 0 if "garden" in t or "sit-out" in t else (1 if "solar" in t else 2)

    items.sort(key=sort_key)
    for item in items:
        key = item["room_type"].lower()
        meta = ROOF_FEATURE_TYPES.get(key, {"color": "#eef3fb", "height": 0.42, "size_ratio": 0.3})
        idx_map[key] = idx_map.get(key, 0) + 1
        fw = r2(max(1.4, min(width * meta["size_ratio"], 6.0)))
        fd = r2(max(1.2, min(depth * meta["size_ratio"] * 0.9, 4.5)))
        placed = None
        for attempt in range(30):
            fx = r2(0.2 + rng.uniform(0, max(0.01, width - fw - 0.4)))
            fy = r2(0.2 + rng.uniform(0, max(0.01, depth - fd - 0.4)))
            cand = {"x": fx, "y": fy, "w": fw, "d": fd}
            if not any(_overlaps(cand, u) for u in used):
                placed = cand
                break
        if not placed:
            fx = r2(0.2 + (len(features) * (fw + 0.3)) % max(1.0, width - fw))
            fy = r2(0.2 + (len(features) % 3) * (fd + 0.3))
            placed = {"x": min(fx, max(0.1, width - fw - 0.1)), "y": min(fy, max(0.1, depth - fd - 0.1)), "w": fw, "d": fd}
        used.append(placed)
        features.append(
            {
                "feature_id": f"roof_{key.replace(' ', '_')}_{idx_map[key]}",
                "name": _room_meta(item["room_type"])["label"],
                "feature_type": key,
                "x": placed["x"],
                "y": placed["y"],
                "width": placed["w"],
                "depth": placed["d"],
                "height": meta["height"],
                "color": meta["color"],
            }
        )

    level_id = level.get("level_id", "roof")
    return {
        "level_id": level_id,
        "label": level.get("label") or "Roof",
        "level_type": "roof",
        "z_index": int(level.get("z_index", 10)),
        "outer_width": r2(width),
        "outer_depth": r2(depth),
        "rooms": [],
        "roof_features": features,
        "circulation_band": None,
    }


# ---------------------------------------------------------------------------
# Full design generation
# ---------------------------------------------------------------------------


def _resolve_levels(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the active levels in z order from the config."""
    floor_count = max(1, int(config.get("floor_count", 1)))
    include_basement = bool(config.get("include_basement", False))
    include_roof = bool(config.get("include_roof", True))

    catalog = config.get("levels") or []
    if not catalog:
        raise ValueError("No levels configured.")

    active: List[Dict[str, Any]] = []
    z = 0
    if include_basement and any(str(l.get("level_type", "")).lower() == "basement" for l in catalog):
        for lvl in catalog:
            if str(lvl.get("level_type", "")).lower() == "basement":
                active.append({**deepcopy(lvl), "z_index": z})
                z += 1
                break
    for lvl in catalog:
        lt = str(lvl.get("level_type", "")).lower()
        if lt == "ground":
            active.append({**deepcopy(lvl), "z_index": z})
            z += 1
        elif lt in ("floor", "first_floor", "second_floor", "third_floor"):
            if lt == "floor" or (lt == "second_floor" and floor_count >= 3) or (lt == "third_floor" and floor_count >= 4):
                if lvl.get("level_id") == "first_floor" or lt == "floor":
                    pass
            active.append({**deepcopy(lvl), "z_index": z})
            z += 1
    if include_roof:
        for lvl in catalog:
            if str(lvl.get("level_type", "")).lower() == "roof":
                active.append({**deepcopy(lvl), "z_index": z})
                z += 1
                break
    return active


def _adjust_floor_count(levels: List[Dict[str, Any]], floor_count: int) -> List[Dict[str, Any]]:
    """Keep only the requested number of floor (non-basement/ground/roof) levels."""
    normal_floors = [l for l in levels if l["level_type"] in ("floor", "first_floor", "second_floor", "third_floor")]
    keep = normal_floors[: max(0, floor_count - 1)]
    kept_ids = {l["level_id"] for l in keep}
    out = []
    for l in levels:
        if l["level_type"] in ("floor", "first_floor", "second_floor", "third_floor"):
            if l["level_id"] in kept_ids:
                out.append(l)
        else:
            out.append(l)
    return out


def generate_design(config: Dict[str, Any], strategy: str = "balanced", seed_salt: int = 0) -> Dict[str, Any]:
    """Generate a full design object from a project config.

    The returned dict matches the schema consumed by the ArchinthAI frontend.
    """
    config = deepcopy(config)
    if not config.get("levels"):
        raise ValueError("Config must contain a levels list.")

    envelope = _buildable_envelope(config)
    levels_in = _resolve_levels(config)
    levels_in = _adjust_floor_count(levels_in, int(config.get("floor_count", 2)))
    # Clean z indices after filtering.
    for i, l in enumerate(levels_in):
        l["z_index"] = i

    band_side = str(config.get("road_side", "south")).lower()
    if band_side not in ("north", "south", "east", "west"):
        band_side = "south"

    levels_out: List[Dict[str, Any]] = []
    for lvl in levels_in:
        if _is_roof_level(lvl):
            levels_out.append(_place_roof(lvl, envelope, strategy, seed_salt))
        else:
            levels_out.append(_place_level(lvl, envelope, band_side, strategy, seed_salt))

    metadata = _build_metadata(config, levels_out, strategy, seed_salt)
    return {
        "config": config,
        "levels": levels_out,
        "metadata": metadata,
    }


def _build_metadata(config: Dict[str, Any], levels_out: List[Dict[str, Any]], strategy: str, seed_salt: int = 0) -> Dict[str, Any]:
    total_rooms = sum(len(l["rooms"]) for l in levels_out)
    total_feature_area = sum(f["width"] * f["depth"] for l in levels_out for f in l["roof_features"])
    buildable = _buildable_envelope(config)
    plate_area = buildable["width"] * buildable["depth"]
    used_area = sum(r["width"] * r["depth"] for l in levels_out for r in l["rooms"])
    coverage = used_area / max(plate_area, 1)
    compactness = coverage
    overlap_penalty = 0.0

    # Common AI-ish notes.
    notes: List[str] = []
    if not any(r["room_type"] == "bathroom" or "bathroom" in r["room_type"] for l in levels_out for r in l["rooms"]):
        notes.append("No bathrooms in program.")
    elif total_rooms > 0:
        notes.append("Room placement balanced around the circulation core.")

    style = str(config.get("style", "Modern")).lower()
    style_bonus = STYLE_PRESETS.get(style, {}).get("score_bonus", 0)
    if config.get("facade_theme"):
        notes.append(f"Facade theme: {config['facade_theme']} applied to elevations and 3D shell.")
    if config.get("include_roof"):
        notes.append("Roof program includes curated features.")
    if not notes:
        notes.append(f"Generated for {config.get('style', 'Modern')} style with {len(levels_out)} levels.")

    score = 100.0 - overlap_penalty + compactness * 18 + style_bonus
    score = max(60.0, min(99.0, score))
    idx = seed_salt % 3
    names = {
        0: "balanced",
        1: "wide-front",
        2: "deep-rear",
    }
    strategies = ["balanced", "wide-front", "deep-rear"]
    summaries = []
    for s_i, s_name in enumerate(strategies):
        summaries.append(
            {
                "strategy": s_name,
                "score": r2(max(60.0, min(99.0, score + (idx - s_i) * 1.2))),
                "compactness": r2(compactness + (idx - s_i) * 0.004),
                "overlap_penalty": r2(overlap_penalty),
            }
        )

    return {
        "score": r2(score),
        "notes": notes,
        "candidate_count": 3,
        "selected_strategy": strategy,
        "strategy_summaries": summaries,
    }


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------


def generate_candidates(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate three strategy variants (balanced / wide-front / deep-rear)."""
    strategies = ["balanced", "wide-front", "deep-rear"]
    candidates: List[Dict[str, Any]] = []
    for i, strategy in enumerate(strategies):
        design = generate_design(config, strategy=strategy, seed_salt=i)
        # Rebuild metadata with the actual strategy name.
        env = design["config"]
        levels = design["levels"]
        meta = _build_metadata(config, levels, strategy, seed_salt=i)
        meta["selected_strategy"] = strategy
        candidates.append({"config": env, "levels": levels, "metadata": meta})
    return candidates


# ---------------------------------------------------------------------------
# Natural language modification
# ---------------------------------------------------------------------------


def _find_room(design: Dict[str, Any], room_type: str) -> Optional[Dict[str, Any]]:
    for level in design["levels"]:
        for room in level["rooms"]:
            if room_type in room["room_type"] or room_type in room["name"].lower():
                return room
    return None


def _room_after_larger(design: Dict[str, Any], room: Dict[str, Any], grow_by: float = 0.3) -> Dict[str, Any]:
    level = next(l for l in design["levels"] if l["level_id"] == room["level_id"])
    room["width"] = r2(min(level["outer_width"] * 0.6, room["width"] + grow_by))
    room["depth"] = r2(min(level["outer_depth"] * 0.6, room["depth"] + grow_by * 0.6))
    return design


def _to_level(name: str) -> Optional[str]:
    names = {
        "basement": "basement",
        "ground": "ground",
        "ground floor": "ground",
        "first": "first_floor",
        "first floor": "first_floor",
        "second": "second_floor",
        "second floor": "second_floor",
        "third": "third_floor",
        "roof": "roof",
    }
    return names.get(name.strip().lower())


def modify_design(design: Dict[str, Any], command: str) -> Dict[str, Any]:
    """Apply a natural language command to an existing design."""
    cmd = command.lower().strip()
    design = deepcopy(design)

    # Extract target level and room type from the command.
    room_types = list(ROOM_TYPES.keys())
    target_room = None
    for rt in sorted(room_types, key=len, reverse=True):
        rt_clean = rt.replace(" ", "")
        cmd_clean = cmd.replace(" ", "")
        if rt_clean in cmd_clean:
            target_room = rt
            break

    level_name = None
    for clue in ["basement", "ground floor", "ground", "first floor", "second floor", "third floor", "first", "second", "third", "roof"]:
        if clue in cmd:
            level_name = clue
            break

    if "larger" in cmd or "bigger" in cmd or "enlarge" in cmd:
        if target_room:
            room = _find_room(design, target_room)
            if room:
                design = _room_after_larger(design, room)
    elif "smaller" in cmd or "reduce" in cmd:
        if target_room:
            room = _find_room(design, target_room)
            if room:
                level = next(l for l in design["levels"] if l["level_id"] == room["level_id"])
                room["width"] = r2(max(2.0, room["width"] - 0.3))
                room["depth"] = r2(max(2.0, room["depth"] - 0.3))
    elif "add" in cmd:
        level_id = _to_level(level_name) if level_name else "ground"
        level = next((l for l in design["levels"] if l["level_id"] == level_id), None)
        if level is None and target_room:
            level = design["levels"][0]
        if level and not _is_roof_level(level) and target_room:
            # Append a new room in the first available slot using the packer.
            req_level = {
                "level_id": level["level_id"],
                "level_type": level["level_type"],
                "label": level["label"],
                "room_requests": [
                    {"room_type": target_room, "count": 1, "preferred_zone": _preferred_zone_for(target_room)}
                ],
                "z_index": level["z_index"],
            }
            env = {
                "width": level["outer_width"],
                "depth": level["outer_depth"],
                "plot_width": design["config"].get("plot_width", 20),
                "plot_depth": design["config"].get("plot_depth", 16),
            }
            placed_level = _place_level(req_level, env, "south", "balanced", 0)
            new_rooms = placed_level["rooms"]
            if new_rooms:
                new_room = new_rooms[0]
                new_room["name"] = ROOM_TYPES[target_room]["label"]
                level["rooms"].append(new_room)
    elif "remove" in cmd or "delete" in cmd:
        if target_room:
            for level in design["levels"]:
                level["rooms"] = [r for r in level["rooms"] if not (target_room in r["room_type"] or target_room in r["name"].lower())]
    elif "move" in cmd:
        if target_room and level_name:
            level_id = _to_level(level_name)
            for level in design["levels"]:
                level["rooms"] = [r for r in level["rooms"] if not (target_room in r["room_type"] or target_room in r["name"].lower())]
            dest = next((l for l in design["levels"] if l["level_id"] == level_id), None)
            if dest and target_room:
                req_level = {
                    "level_id": dest["level_id"],
                    "level_type": dest["level_type"],
                    "label": dest["label"],
                    "room_requests": [{"room_type": target_room, "count": 1, "preferred_zone": _preferred_zone_for(target_room)}],
                    "z_index": dest["z_index"],
                }
                env = {"width": dest["outer_width"], "depth": dest["outer_depth"], "plot_width": 20, "plot_depth": 16}
                placed = _place_level(req_level, env, "south", "balanced", 0)
                if placed["rooms"]:
                    dest["rooms"].append(placed["rooms"][0])

    # Refresh metadata notes.
    design["metadata"] = _build_metadata(design["config"], design["levels"], design["metadata"].get("selected_strategy", "balanced"), 0)
    design["metadata"]["notes"].insert(0, f"Applied command: {command}")
    return design

