/**
 * Tunisian "matricule fiscal" — 7 digits, a control key, two code letters and
 * the establishment number. Mirrors `users/tax-id.ts` on the API.
 */
export const TAX_ID_EXAMPLE = '1234567R/A/M/000';

export const compactTaxId = (v) => String(v ?? '').replace(/[\s/.\-_]/g, '').toUpperCase();

export const isTunisianTaxId = (v) => /^[0-9]{7}[A-Z]{3}([0-9]{3})?$/.test(compactTaxId(v));

/** Canonical display form; '' for a blank value. */
export function formatTaxId(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const c = compactTaxId(raw);
  if (!isTunisianTaxId(c)) return raw;
  return `${c.slice(0, 8)}/${c[8]}/${c[9]}/${c.slice(10) || '000'}`;
}

export const TAX_ID_HINT =
  `Format attendu : 7 chiffres, 3 lettres, puis le n° d'établissement — ex. ${TAX_ID_EXAMPLE}`;
