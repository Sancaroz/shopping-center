import { requireChatGPTUser } from "../../chatgpt-auth";
import ShippingSettings from "./shipping-settings";
import "./shipping-settings.css";

export const dynamic="force-dynamic";
export default async function ShippingSettingsPage(){await requireChatGPTUser("/admin/teslimat-ayarlari");return <ShippingSettings/>;}
