export function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
