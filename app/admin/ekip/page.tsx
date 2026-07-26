import { requireOwner } from "../../chatgpt-auth";
import TeamCenter from "./team-center";
import "../admin.css";
import "./team-center.css";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireOwner("/admin/ekip");
  return <TeamCenter currentEmail={user.email} />;
}
