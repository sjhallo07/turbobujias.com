import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function serializeUserDoc(data: any) {
  const sanitized = { ...data };
  for (const key in sanitized) {
    const val = sanitized[key];
    if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
      sanitized[key] = val.toDate().toISOString();
    } else if (val && typeof val === 'object' && Object.keys(val).includes('_methodName')) {
      sanitized[key] = new Date().toISOString();
    }
  }
  return sanitized;
}

export function formatPrice(usdPrice: number, currency: 'USD' | 'VES' | 'EUR', rates: { VES: number; EUR: number }) {
  let price = usdPrice;
  let symbol = '$';
  
  if (currency === 'VES') {
    price = usdPrice * rates.VES;
    symbol = 'Bs.';
  } else if (currency === 'EUR') {
    // Assuming rates are: 1 USD = X VES, and BCV also gives 1 EUR = Y VES
    // So 1 USD = (X/Y) EUR
    price = (usdPrice * rates.VES) / rates.EUR;
    symbol = '€';
  }

  return `${symbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
