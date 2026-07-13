import {requireChatGPTUser} from "../../../chatgpt-auth";
import VariantEditor from "./variant-editor";
import "../../admin.css";

export const dynamic="force-dynamic";
export default async function EditVariantPage({params}:{params:Promise<{id:string}>}){const{id}=await params;await requireChatGPTUser(`/admin/varyant/${id}`);return <VariantEditor id={Number(id)}/>;}
