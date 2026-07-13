import {requireChatGPTUser} from "../../chatgpt-auth";
import FooterEditor from "./footer-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function FooterPage(){await requireChatGPTUser("/admin/footer");return <FooterEditor/>;}
