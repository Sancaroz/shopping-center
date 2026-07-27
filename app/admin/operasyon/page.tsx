import { requireChatGPTUser } from "../../chatgpt-auth";
import OperationsCenter from "./operations-center";
import "../admin.css";
import "./operations-center.css";

export const dynamic="force-dynamic";

export default async function OperationsPage() {
  const user=await requireChatGPTUser("/admin/operasyon");
  return <OperationsCenter isOwner={user.role==="owner"}/>;
}
