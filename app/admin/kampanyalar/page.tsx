import {requireChatGPTUser} from "../../chatgpt-auth";
import PromotionCenter from "./promotion-center";
import "./promotion-center.css";

export const dynamic="force-dynamic";
export default async function PromotionsPage(){await requireChatGPTUser("/admin/kampanyalar");return <PromotionCenter/>;}
