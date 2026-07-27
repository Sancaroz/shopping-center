import { requireOwner } from "../../chatgpt-auth";
import AuditLogCenter from "./audit-log-center";
import "../admin.css";
import "./audit-log-center.css";

export const dynamic="force-dynamic";

export default async function AuditLogPage() {
  await requireOwner("/admin/islem-gecmisi");
  return <AuditLogCenter/>;
}
