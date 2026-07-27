import { requireChatGPTUser } from "../../chatgpt-auth";
import NotificationCenter from "./notification-center";
import "../admin.css";
import "./notification-center.css";

export const dynamic="force-dynamic";

export default async function NotificationsPage() {
  const user=await requireChatGPTUser("/admin/bildirimler");
  return <NotificationCenter isOwner={user.role==="owner"}/>;
}
