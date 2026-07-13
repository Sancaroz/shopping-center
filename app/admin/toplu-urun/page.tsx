import { requireChatGPTUser } from "../../chatgpt-auth";
import Importer from "./product-importer";
import "../admin.css";
import "./product-importer.css";

export const dynamic="force-dynamic";
export default async function BulkImportPage(){await requireChatGPTUser("/admin/toplu-urun");return <Importer/>;}
