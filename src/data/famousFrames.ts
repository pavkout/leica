// Famous frames: well-known photographs made with a Leica, told in words (no
// reproductions), with only the gear the sources state. Settings weren't
// recorded for these pictures, so none are given. Where the camera or lens
// isn't in the simulator's catalogue, "Try it" uses a stand-in that is named
// as such. Sources read 2026-09-29.

export interface FamousFrame {
  id: string;
  title: string;
  photographer: string;
  year: number;
  place: string;
  /** The scene, in this app's own words. */
  scene: string;
  /** What the sources say about the gear, and nothing more. */
  gear: { camera: string; lens?: string; film?: string };
  sources: { label: string; url: string }[];
  /** The nearest catalogue body and lens, and why they stand in. */
  standIn: { bodyId: string; lensId: string; note: string };
}

export const FAMOUS_FRAMES: FamousFrame[] = [
  {
    id: "gare-saint-lazare",
    title: "Behind the Gare Saint-Lazare",
    photographer: "Henri Cartier-Bresson",
    year: 1932,
    place: "Paris",
    scene: "A man leaps across a flooded yard behind the station, caught in the air above his own reflection, a ladder half sunk in the water.",
    gear: { camera: "A Leica (the model isn't recorded)" },
    sources: [{ label: "Wikipedia: Behind the Gare Saint-Lazare", url: "https://en.wikipedia.org/wiki/Behind_the_Gare_Saint-Lazare" }],
    standIn: { bodyId: "m3", lensId: "m-50-2-rigid", note: "The M3 and a 50 mm stand in: the Leica he used predates the catalogue." },
  },
  {
    id: "vj-day",
    title: "V-J Day in Times Square",
    photographer: "Alfred Eisenstaedt",
    year: 1945,
    place: "New York",
    scene: "A sailor kisses a woman in white in the middle of a crowded Times Square, on the day the end of the war was announced.",
    gear: { camera: "Leica IIIa", lens: "Leitz Summitar 5 cm f/2" },
    sources: [
      { label: "KEH: the history behind the image", url: "https://www.keh.com/expert-advice/photography/news-and-culture/v-j-day-in-times-square-the-history-behind-the-iconic-image/" },
      { label: "PetaPixel: the Leica that shot V-J Day sold at auction", url: "https://petapixel.com/2013/05/27/leica-that-shot-v-j-day-in-times-square-photo-fetches-150k-at-auction/" },
    ],
    standIn: { bodyId: "m3", lensId: "m-50-2-rigid", note: "The M3 and a Summicron 50 f/2 stand in for the screw-mount IIIa and its 5 cm f/2." },
  },
  {
    id: "the-americans",
    title: "The Americans",
    photographer: "Robert Frank",
    year: 1955,
    place: "Across the United States",
    scene: "Not one frame but a book: two years on the road through the United States, in jukeboxes, parades, diners and cars.",
    gear: { camera: "Leica III", lens: "Nikkor 50 mm f/1.4 (the camera and lens now held by the Swiss Camera Museum)" },
    sources: [{ label: "Swiss Camera Museum: the Leica of Robert Frank", url: "https://www.cameramuseum.ch/en/discover/permanent-exhibition/the-century-of-the-film/the-leica-of-robert-frank-and-the-americans/" }],
    standIn: { bodyId: "m3", lensId: "m-50-1.4-pre", note: "The M3 and a Summilux 50 f/1.4 stand in for the Leica III and its Nikkor 50 mm f/1.4." },
  },
  {
    id: "guerrillero-heroico",
    title: "Guerrillero Heroico",
    photographer: "Alberto Korda",
    year: 1960,
    place: "Havana",
    scene: "At a memorial service, a revolutionary steps to the edge of the platform for a moment, staring past the crowd; two frames, then he was gone.",
    gear: { camera: "Leica M2", lens: "a 90 mm lens", film: "Kodak Plus-X" },
    sources: [
      { label: "Wikipedia: Guerrillero Heroico", url: "https://en.wikipedia.org/wiki/Guerrillero_Heroico" },
      { label: "PetaPixel: the cameras behind famous photos", url: "https://petapixel.com/2022/12/30/the-cameras-that-captured-some-of-the-most-famous-photos-of-all-time/" },
    ],
    standIn: { bodyId: "m3", lensId: "m-90-2.8", note: "The M3 stands in for the M2 (not in the catalogue), with a 90 mm Elmarit for his 90 mm lens." },
  },
];
