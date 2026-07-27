import { requireOwner } from "../../chatgpt-auth";
import IntegrationCenter from "./integration-center";
import "../admin.css";
import "./integration-center.css";

export const dynamic="force-dynamic";

export default async function IntegrationsPage(){
  await requireOwner("/admin/entegrasyonlar");
  return <IntegrationCenter/>;
}
