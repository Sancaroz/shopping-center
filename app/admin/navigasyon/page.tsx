import {requireChatGPTUser} from "../../chatgpt-auth";
import NavigationEditor from "./navigation-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function NavigationPage(){await requireChatGPTUser("/admin/navigasyon");return <NavigationEditor/>;}
