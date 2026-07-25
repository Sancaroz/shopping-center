import { requireChatGPTUser } from "../../chatgpt-auth";
import ReturnRequestCenter from "./return-request-center";
import "../admin.css";
import "./return-request-center.css";

export const dynamic="force-dynamic";

export default async function ReturnRequestsPage() {
  await requireChatGPTUser("/admin/iade-talepleri");
  return <ReturnRequestCenter/>;
}
