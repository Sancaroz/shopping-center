import { requireOwner } from "../../chatgpt-auth";
import LaunchReadiness from "./launch-readiness";
import "../admin.css";
import "./launch-readiness.css";

export const dynamic="force-dynamic";

export default async function LaunchReadinessPage() {
  await requireOwner("/admin/yayina-hazirlik");
  return <LaunchReadiness/>;
}
