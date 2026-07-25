import {requireChatGPTUser} from "../../chatgpt-auth";
import InventoryCenter from "./inventory-center";
import "./inventory-center.css";

export const dynamic="force-dynamic";
export default async function InventoryPage(){await requireChatGPTUser("/admin/stok");return <InventoryCenter/>;}
