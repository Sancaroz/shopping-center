import {requireOwner} from "../../chatgpt-auth";
import PaymentCenter from "./payment-center";
import "./payment-center.css";

export const dynamic="force-dynamic";
export default async function PaymentsPage(){await requireOwner("/admin/odemeler");return <PaymentCenter/>;}
