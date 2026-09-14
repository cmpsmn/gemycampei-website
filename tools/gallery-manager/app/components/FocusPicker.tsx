/**
 * ============================================================================
 * COVER FOCUS PICKER  (app/components/FocusPicker.tsx)
 * ============================================================================
 *
 * Click the important spot of the cover photo (e.g. the couple's faces).
 * The dot marks it, and the small preview shows how the card on the website
 * will be cropped.
 *
 * The preview uses the same rule as the website (focusToPosition in
 * src/lib/galleries.ts): the crop keeps the start, middle or end of the photo,
 * whichever puts the chosen spot closest to the centre.
 * ============================================================================
 */
import type { MouseEvent } from 'react';

interface Props {
  /** URL of the cover thumbnail, or null when the gallery has no photos */
  src: string | null;
  /** photo size, to know which direction the card crop cuts */
  width: number;
  height: number;
  /** "50% 30%" or "" for centre */
  focus: string;
  onChange: (focus: string) => void;
}

/** Shape of the card image on the website (1200 × 1160, see coverImage in galleries.ts) */
const CARD_RATIO = 1200 / 1160;

/** Same logic as focusToPosition() on the website, returned as CSS background-position */
export function previewPosition(focus: string, width: number, height: number): string {
  const match = /^(\d{1,3})% (\d{1,3})%$/.exec(focus);
  if (!match) return '50% 50%';
  const ratio = width / height;
  const portraitCut = ratio < CARD_RATIO;
  const point = Number(portraitCut ? match[2] : match[1]) / 100;
  const visible = portraitCut ? ratio / CARD_RATIO : CARD_RATIO / ratio;
  const options = [
    { css: 0, center: visible / 2 },
    { css: 50, center: 0.5 },
    { css: 100, center: 1 - visible / 2 },
  ];
  const best = options.reduce((a, o) => (Math.abs(o.center - point) < Math.abs(a.center - point) ? o : a));
  return portraitCut ? `50% ${best.css}%` : `${best.css}% 50%`;
}

export default function FocusPicker({ src, width, height, focus, onChange }: Props) {
  if (!src) return <p className="muted small">Add photos to choose a cover.</p>;

  const match = /^(\d{1,3})% (\d{1,3})%$/.exec(focus);
  const x = match ? Number(match[1]) : 50;
  const y = match ? Number(match[2]) : 50;

  function pick(event: MouseEvent<HTMLDivElement>) {
    // Position of the click inside the photo, in percent
    const rect = event.currentTarget.getBoundingClientRect();
    const px = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const py = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    onChange(`${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`);
  }

  return (
    <div className="focus-picker">
      <div className="focus-image" onClick={pick} title="Click the most important spot">
        <img src={src} alt="Cover photo" />
        <span className="focus-dot" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
      <div className="focus-side">
        <div
          className="focus-preview"
          style={{ backgroundImage: `url("${src}")`, backgroundPosition: previewPosition(focus, width, height) }}
          aria-label="Card preview"
        />
        <p className="muted small">Card on the website</p>
        {focus && (
          <button className="link small" onClick={() => onChange('')}>
            Reset to centre
          </button>
        )}
      </div>
    </div>
  );
}
