import {requireChatGPTUser} from "../../chatgpt-auth";
import SupportCenter from "./support-center";
import "./support-center.css";

export const dynamic="force-dynamic";
export default async function SupportPage(){await requireChatGPTUser("/admin/destek");return <SupportCenter/>;}
