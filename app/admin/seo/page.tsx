import {requireChatGPTUser} from "../../chatgpt-auth";
import SeoEditor from "./seo-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function SeoPage(){await requireChatGPTUser("/admin/seo");return <SeoEditor/>;}
