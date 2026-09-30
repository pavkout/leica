// Moving through the museum (#39): a room is a deck of exhibits, one at a
// time; the unattended display loops through hero exhibits from every room.
// Pure logic.

import type { Exhibit, Room, RoomId } from "./exhibits";

/** Anywhere in the app, this long without a touch starts the museum's display loop. */
export const ATTRACT_IDLE_MS = 120_000;

/** The next exhibit index in a room; stays at the ends (the room ends, it doesn't wrap). */
export function step(index: number, count: number, dir: 1 | -1): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + dir));
}

/**
 * The display loop: every exhibit, the rooms taken in turn (a camera, a lens,
 * a part, an accessory, then the next camera…), so a passer-by sees the
 * variety. A room's hero pieces come first, so the best-known pieces show
 * early. Your collection is private and stays out of the loop.
 */
export function attractSequence(rooms: Room[]): Exhibit[] {
  const lists = rooms
    .filter((r) => r.id !== "collection")
    .map((r) => [...r.exhibits.filter((e) => e.hero), ...r.exhibits.filter((e) => !e.hero)]);
  const out: Exhibit[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export interface MuseumPath {
  display: boolean;
  room?: RoomId;
  exhibit?: string;
  /** The exhibit's story is open. */
  story: boolean;
}

const ROOMS: RoomId[] = ["cameras", "lenses", "inside", "accessories", "collection"];

/** `#/museum`, `#/museum/display`, `#/museum/cameras`, `#/museum/cameras/m3`, `#/museum/cameras/m3/story`. */
export function parseMuseumPath(hash: string): MuseumPath {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] !== "museum") return { display: false, story: false };
  if (parts[1] === "display") return { display: true, story: false };
  const room = ROOMS.find((r) => r === parts[1]);
  if (!room) return { display: false, story: false };
  return { display: false, room, exhibit: parts[2] ? decodeURIComponent(parts[2]) : undefined, story: parts[3] === "story" };
}

export function museumHash(p: MuseumPath): string {
  if (p.display) return "#/museum/display";
  if (!p.room) return "#/museum";
  if (!p.exhibit) return `#/museum/${p.room}`;
  return `#/museum/${p.room}/${encodeURIComponent(p.exhibit)}${p.story ? "/story" : ""}`;
}
