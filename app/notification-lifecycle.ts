export type NotificationQueueStatus = "draft" | "dismissed" | "sending" | "sent" | "failed" | "cancelled";

export function canManageNotificationStatus(current: string, next: string, attempts: number) {
  if (current === "draft" && next === "dismissed") return true;
  if (current === "dismissed" && next === "draft") return true;
  if (current === "failed" && next === "draft" && attempts < 3) return true;
  return false;
}

export function notificationStatusLabel(status: string, attempts: number) {
  if (status === "draft") return "Gönderim için hazır";
  if (status === "dismissed") return "Arşivlendi";
  if (status === "sending") return "Gönderiliyor";
  if (status === "sent") return "Gönderildi";
  if (status === "cancelled") return "Geçersiz bağlantı · yeniden gönderilemez";
  if (status === "failed") return attempts >= 3 ? "Gönderilemedi · deneme sınırı doldu" : "Gönderilemedi · yeniden denenebilir";
  return "Bilinmeyen durum";
}
