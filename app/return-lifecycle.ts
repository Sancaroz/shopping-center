export const returnRequestStatusLabels = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  completed: "Tamamlandı",
} as const;

export type ReturnRequestStatus = keyof typeof returnRequestStatusLabels;

const transitions: Record<ReturnRequestStatus, readonly ReturnRequestStatus[]> = {
  new: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["completed"],
  rejected: [],
  completed: [],
};

export function isReturnRequestStatus(value: unknown): value is ReturnRequestStatus {
  return typeof value === "string" && value in returnRequestStatusLabels;
}

export function canTransitionReturnRequestStatus(current: unknown, next: unknown) {
  return isReturnRequestStatus(current) && isReturnRequestStatus(next) && (current === next || transitions[current].includes(next));
}

export function allowedReturnRequestStatusTargets(current: unknown): ReturnRequestStatus[] {
  if (!isReturnRequestStatus(current)) return [];
  return [current, ...transitions[current]];
}

export function isTerminalReturnRequestStatus(value: unknown) {
  return value === "rejected" || value === "completed";
}
