import { requireChatGPTUser } from "../../chatgpt-auth";
import ManifestoEditor from "./manifesto-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function ManifestoPage(){await requireChatGPTUser("/admin/manifesto");return <ManifestoEditor/>;}
