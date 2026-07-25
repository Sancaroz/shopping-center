import {requireChatGPTUser} from "../../chatgpt-auth";
import CustomerCenter from "./customer-center";
import "./customer-center.css";

export const dynamic="force-dynamic";
export default async function CustomersPage(){await requireChatGPTUser("/admin/musteriler");return <CustomerCenter/>;}
