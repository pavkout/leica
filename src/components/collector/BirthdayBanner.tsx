import { useState } from "react";
import { langTag, t, tn, useLang } from "../../i18n";
import { getString, setString } from "../../services/persistence";
import { birthdayId, birthdays, type Birthday } from "../../state/birthdays";
import type { CollectionItem } from "../../state/collection";
import { drawPassportCard, shareOrDownload } from "./passportCard";

const SEEN_KEY = "rangefinder-birthdays-seen";

function seenIds(): string[] {
  try {
    const v = JSON.parse(getString(SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function sentence(b: Birthday): string {
  if (b.kind === "made") return tn(b.approx ? "bd.madeAbout" : "bd.made", b.years, { name: b.item.name, year: b.year });
  const date = new Date(`${b.date}T12:00:00`).toLocaleDateString(langTag(), { day: "numeric", month: "long" });
  if (b.inDays === 0) return tn("bd.ownedToday", b.years, { name: b.item.name });
  return b.inDays > 0 ? tn("bd.ownedSoon", b.years, { name: b.item.name, date }) : tn("bd.ownedYesterday", b.years, { name: b.item.name });
}

/** Camera birthdays (#63): the week's anniversaries and the year's milestones, at the top of the Collection. */
export default function BirthdayBanner({ items }: { items: CollectionItem[] }) {
  useLang();
  const today = new Date();
  const [seen, setSeen] = useState(seenIds);
  const [note, setNote] = useState("");
  const list = birthdays(items, today).filter((b) => !seen.includes(birthdayId(b, today)));
  if (!list.length) return null;
  const shown = list.slice(0, 3);

  async function card(b: Birthday) {
    const years = today.getFullYear();
    const blob = await drawPassportCard(
      {
        label: t("bd.cardLabel"),
        name: b.item.name,
        serial: b.item.serial,
        lines: b.kind === "made" ? [sentence(b), t("bd.cardSource")] : [sentence(b)],
        fingerprintLabel: b.kind === "made" ? t("bd.cardMade") : t("bd.cardOwned"),
        fingerprint: b.kind === "made" ? `${b.approx ? "~" : ""}${b.year} – ${years}` : `${b.date.slice(0, 4)} – ${years}`,
        footer: t("bd.cardFooter"),
      },
      b.item.photo,
    );
    if (!blob) return;
    const how = await shareOrDownload(blob, `birthday-${b.item.name.replace(/[^\w]+/g, "-").toLowerCase()}.png`, b.item.name);
    if (how === "downloaded") setNote(t("bd.saved"));
  }

  function dismiss() {
    // Keep only this year's dismissals, so next year's birthdays come round again.
    const year = `:${today.getFullYear()}`;
    const next = [...seen.filter((id) => id.endsWith(year)), ...shown.map((b) => birthdayId(b, today))];
    setString(SEEN_KEY, JSON.stringify(next));
    setSeen(next);
  }

  return (
    <div className="bd-banner" role="note">
      {shown.map((b) => (
        <div key={birthdayId(b, today)} className="bd-row">
          <p>{sentence(b)}</p>
          <button type="button" className="btn btn-small" onClick={() => card(b)}>
            {t("bd.card")}
          </button>
        </div>
      ))}
      {note && <p className="cx-quiet">{note}</p>}
      <button type="button" className="btn btn-small" onClick={dismiss}>
        {t("bd.seen")}
      </button>
    </div>
  );
}
