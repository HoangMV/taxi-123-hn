export function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const dateValue = new Date(value.getTime());
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const dateValue = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      dateValue.getFullYear() === Number(year) &&
      dateValue.getMonth() === Number(month) - 1 &&
      dateValue.getDate() === Number(day)
    ) {
      return dateValue;
    }
  }

  const vietnameseDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (vietnameseDateMatch) {
    const [, day, month, year] = vietnameseDateMatch;
    const dateValue = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      dateValue.getFullYear() === Number(year) &&
      dateValue.getMonth() === Number(month) - 1 &&
      dateValue.getDate() === Number(day)
    ) {
      return dateValue;
    }
  }

  const parsed = new Date(text);
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

export function addDays(value, days) {
  const date = parseDateValue(value);
  if (!date) return null;

  const result = new Date(date.getTime());
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

export function calculateInclusiveEndDate(value, totalDays = 365) {
  const normalizedDays = Math.max(Number(totalDays || 0), 1);
  return addDays(value, normalizedDays - 1);
}
