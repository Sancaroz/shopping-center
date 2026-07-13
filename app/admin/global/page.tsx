import {requireChatGPTUser} from "../../chatgpt-auth";
import GlobalEditor from "./global-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function GlobalPage(){await requireChatGPTUser("/admin/global");return <GlobalEditor/>;}
