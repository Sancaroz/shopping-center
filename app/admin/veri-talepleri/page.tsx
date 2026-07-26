import {requireChatGPTUser} from "../../chatgpt-auth";
import PrivacyRequestCenter from "./privacy-request-center";
import "./privacy-request-center.css";

export const dynamic="force-dynamic";
export default async function PrivacyRequestsPage(){await requireChatGPTUser("/admin/veri-talepleri");return <PrivacyRequestCenter/>;}
