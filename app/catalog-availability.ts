export type StockVariant = { stock: number; active?: boolean };

export function availableVariants<T extends StockVariant>(variants: T[]) {
  return variants.filter(variant => variant.active !== false);
}

export function sellableStock(productStock: number, variants: StockVariant[]) {
  const active = availableVariants(variants);
  return active.length
    ? active.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0)
    : Math.max(0, productStock);
}

export function firstAvailableVariant<T extends StockVariant>(variants: T[]) {
  const active = availableVariants(variants);
  return active.find(variant => variant.stock > 0) ?? active[0] ?? null;
}
