import {requireOwner} from "../../chatgpt-auth";
import CustomerCenter from "./customer-center";
import "./customer-center.css";

export const dynamic="force-dynamic";
export default async function CustomersPage(){await requireOwner("/admin/musteriler");return <CustomerCenter/>;}
