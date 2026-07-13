import { requireChatGPTUser } from "../../../chatgpt-auth";
import ProductEditor from "./product-editor";
import "../../admin.css";

export const dynamic="force-dynamic";
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){const {id}=await params;await requireChatGPTUser(`/admin/urun/${id}`);return <ProductEditor id={Number(id)}/>;}
