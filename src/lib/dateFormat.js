export function parseDateValue(value) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatAdministrativeDate(value) {
  const date = parseDateValue(value);
  if (!date) {
    return { day: '', month: '', year: '' };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const monthValue = date.getMonth() + 1;
  const month = monthValue <= 2 ? String(monthValue).padStart(2, '0') : String(monthValue);
  const year = String(date.getFullYear());

  return { day, month, year };
}

export function formatAdministrativeDateString(value) {
  const date = formatAdministrativeDate(value);
  if (!date.day || !date.month || !date.year) return '';
  return `${date.day}/${date.month}/${date.year}`;
}
