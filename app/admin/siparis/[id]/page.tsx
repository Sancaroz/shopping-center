import { requireChatGPTUser } from "../../../chatgpt-auth";
import OrderDetail from "./order-detail";
import "../../admin.css";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }:{ params:Promise<{id:string}> }) {
  const { id } = await params;
  await requireChatGPTUser(`/admin/siparis/${id}`);
  return <OrderDetail id={Number(id)}/>;
}
