import { latLngToCell } from "h3-js";
import type { Hotspot } from "../types/hotspot";

const RESOLUTION = 6 as const;

function createHotspot(
  lat: number,
  lon: number,
  editsCount: number,
  usersCount: number,
  lastEventAt: string
) {
  return {
    h3: latLngToCell(lat, lon, RESOLUTION),
    resolution: RESOLUTION,
    edits_count: editsCount,
    users_count: usersCount,
    last_event_at: lastEventAt,
  };
}

export const hotspotSnapshots: [Hotspot[], Hotspot[]] = [
  [
    createHotspot(
      55.7558,
      37.6176,
      18,
      11,
      "2026-08-08T10:00:00Z",
    ),
    createHotspot(
      55.8941,
      37.4439,
      8,
      5,
      "2026-08-08T10:00:02Z",
    ),
    createHotspot(
      55.7963,
      37.9382,
      31,
      20,
      "2026-08-08T10:00:04Z",
    ),
  ],
  [
    // Та же ячейка, но счётчики выросли.
    createHotspot(
      55.7558,
      37.6176,
      46,
      24,
      "2026-08-08T10:00:07Z",
    ),

    // Эта ячейка осталась почти без изменений.
    createHotspot(
      55.8941,
      37.4439,
      10,
      6,
      "2026-08-08T10:00:06Z",
    ),

    // Балашиха исчезла, вместо неё появился Подольск.
    createHotspot(
      55.4312,
      37.5451,
      25,
      14,
      "2026-08-08T10:00:08Z",
    ),
  ],
];