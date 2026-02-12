export const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

export const toDateInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export const computeExpiresAt = (openedAt: string | Date, hours?: number | null) => {
  if (!hours || hours <= 0) return null;
  const base = openedAt instanceof Date ? openedAt : new Date(openedAt);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();
};

export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const suggestFefoBatch = <T extends { expiry_date?: string | null }>(batches: T[]) => {
  if (!Array.isArray(batches) || batches.length === 0) return null;
  return batches
    .filter((b) => b.expiry_date)
    .sort((a, b) => {
      const aTime = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })[0] || null;
};
