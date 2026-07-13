import { requireChatGPTUser } from "../../../chatgpt-auth";
import CategoryEditor from "./category-editor";
import "../../admin.css";

export const dynamic="force-dynamic";
export default async function EditCategoryPage({params}:{params:Promise<{id:string}>}){const{id}=await params;await requireChatGPTUser(`/admin/kategori/${id}`);return <CategoryEditor id={Number(id)}/>;}
