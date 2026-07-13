import {requireChatGPTUser} from "../../chatgpt-auth";
import BrandEditor from "./brand-editor";
import "../admin.css";

export const dynamic="force-dynamic";
export default async function BrandPage(){await requireChatGPTUser("/admin/marka");return <BrandEditor/>;}
