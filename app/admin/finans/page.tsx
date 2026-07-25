import {requireChatGPTUser} from "../../chatgpt-auth";
import FinanceCenter from "./finance-center";
import "./finance-center.css";

export const dynamic="force-dynamic";
export default async function FinancePage(){await requireChatGPTUser("/admin/finans");return <FinanceCenter/>;}
