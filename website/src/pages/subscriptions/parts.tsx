/**
 * Small pieces the Subscriptions page and its dialogs share.
 *
 * The rules (what a status means today, what counts, the wording) all come
 * from the app's module through @app; only the drawing lives here.
 */
import { monogram, readableOn, tileColor } from '@app/modules/subscriptions/brand';
import type { Tone } from '@app/modules/subscriptions/lifecycle';

/** A rounded square in the service's colour with its monogram. Decorative. */
export function BrandTile({
  sub,
  size = 32,
}: {
  sub: { name: string; color: string | null; service_key: string | null };
  size?: number;
}) {
  const color = tileColor(sub);
  return (
    <span
      className="sub-tile"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: color,
        color: readableOn(color),
        fontSize: Math.round(size * 0.38),
      }}
    >
      {monogram(sub.name)}
    </span>
  );
}

/** A countdown's tone as a token. The countdown's words carry the meaning. */
export const TONE_COLOR: Record<Tone, string> = {
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  muted: 'var(--text-muted)',
};

/** Minor units as an input's value: "649", or "649.50" - no ".00" to delete first. */
export function amountInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}
