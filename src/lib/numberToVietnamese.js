const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function readTriple(number, isFull) {
  const hundreds = Math.floor(number / 100);
  const tensUnits = number % 100;
  const tens = Math.floor(tensUnits / 10);
  const units = tensUnits % 10;
  const parts = [];

  if (hundreds > 0 || isFull) {
    parts.push(`${DIGITS[hundreds]} trăm`);
  }

  if (tens > 1) {
    parts.push(`${DIGITS[tens]} mươi`);
    if (units === 1) parts.push('mốt');
    else if (units === 4) parts.push('tư');
    else if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGITS[units]);
    return normalizeSpaces(parts.join(' '));
  }

  if (tens === 1) {
    parts.push('mười');
    if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGITS[units]);
    return normalizeSpaces(parts.join(' '));
  }

  if (units > 0) {
    if (hundreds > 0 || isFull) {
      parts.push('lẻ');
    }
    if (units === 5 && (hundreds > 0 || isFull)) parts.push('năm');
    else parts.push(DIGITS[units]);
  }

  return normalizeSpaces(parts.join(' '));
}

export function numberToVietnameseWords(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  const normalized = digits.replace(/^0+/, '') || '0';
  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue)) return '';
  if (numericValue === 0) return 'Không';

  const groups = [];
  let remaining = normalized;
  while (remaining.length > 0) {
    groups.unshift(Number(remaining.slice(-3)));
    remaining = remaining.slice(0, -3);
  }

  const firstNonZeroIndex = groups.findIndex((group) => group > 0);
  const parts = [];

  groups.forEach((group, index) => {
    if (!group) return;
    const scaleIndex = groups.length - index - 1;
    const hasNonZeroBefore = index > firstNonZeroIndex;
    const text = readTriple(group, hasNonZeroBefore);
    parts.push(`${text}${SCALES[scaleIndex] || ''}`);
  });

  const sentence = normalizeSpaces(parts.join(' '));
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

