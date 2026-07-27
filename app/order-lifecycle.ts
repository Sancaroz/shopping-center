export const orderStatusLabels = {
  new: "Yeni",
  confirmed: "Onaylandı",
  preparing: "Hazırlanıyor",
  shipped: "Kargoya verildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
} as const;

export type OrderStatus = keyof typeof orderStatusLabels;

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && value in orderStatusLabels;
}

export function canTransitionOrderStatus(current: string, next: string) {
  if (!isOrderStatus(current) || !isOrderStatus(next)) return false;
  return current === next || transitions[current].includes(next);
}

export function allowedOrderStatusTargets(current: string) {
  if (!isOrderStatus(current)) return [] as OrderStatus[];
  return [current, ...transitions[current]];
}
