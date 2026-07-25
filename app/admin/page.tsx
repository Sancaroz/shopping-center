import { requireChatGPTUser } from "../chatgpt-auth";
import AdminPanel from "./panel";
import "./admin.css";
import "./bulk-import-link.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  return <><AdminPanel userName={user.displayName} /><a className="bulk-import-fab" href="/admin/toplu-urun">CSV ile ürün aktar</a><a className="inventory-fab" href="/admin/stok">Stok ve tedarik</a><a className="finance-fab" href="/admin/finans">Finans özeti</a><a className="promotion-fab" href="/admin/kampanyalar">Kampanyalar</a><a className="customer-fab" href="/admin/musteriler">Müşteriler</a></>;
}
