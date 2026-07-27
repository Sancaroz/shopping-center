import { requireChatGPTUser } from "../chatgpt-auth";
import AdminPanel from "./panel";
import "./admin.css";
import "./bulk-import-link.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const isOwner=user.role==="owner";
  return <><AdminPanel userName={user.displayName} isOwner={isOwner}/><a className="bulk-import-fab" href="/admin/toplu-urun">CSV ile ürün aktar</a><a className="inventory-fab" href="/admin/stok">Stok ve tedarik</a>{isOwner&&<a className="finance-fab" href="/admin/finans">Finans özeti</a>}<a className="promotion-fab" href="/admin/kampanyalar">Kampanyalar</a>{isOwner&&<a className="customer-fab" href="/admin/musteriler">Müşteriler</a>}</>;
}
