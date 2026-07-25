import {requireChatGPTUser} from "../../chatgpt-auth";
import ReplenishmentCenter from "./replenishment-center";
import "./replenishment-center.css";

export const dynamic="force-dynamic";
export default async function ReplenishmentPage(){await requireChatGPTUser("/admin/tedarik");return <ReplenishmentCenter/>;}
