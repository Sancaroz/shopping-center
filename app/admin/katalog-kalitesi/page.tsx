import { requireChatGPTUser } from "../../chatgpt-auth";
import CatalogQualityCenter from "./catalog-quality-center";
import "./catalog-quality.css";

export const dynamic="force-dynamic";
export default async function CatalogQualityPage(){await requireChatGPTUser("/admin/katalog-kalitesi");return <CatalogQualityCenter/>;}
