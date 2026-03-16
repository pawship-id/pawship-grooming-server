// function untuk ubah huruf pertama disetiap kata menjadi kapital
export function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// function untuk ubah semua huruf menjadi huruf kecil
export function toLowerCase(value: string) {
  if (typeof value !== 'string') return value;

  return value.trim().toLowerCase();
}
