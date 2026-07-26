import type { categories } from "../db/schema";

type Category=typeof categories.$inferSelect;

export function descendantIds(allCategories:Category[],rootId:number) {
  const ids=[rootId];
  for(let index=0;index<ids.length;index++)for(const category of allCategories)if(category.parentId===ids[index]&&!ids.includes(category.id))ids.push(category.id);
  return ids;
}

export function categoryParentIssue(allCategories:Category[],parentId:number|null,currentId?:number,candidateActive=true) {
  if(parentId===null)return null;
  if(parentId===currentId)return "Kategori kendisinin üst kategorisi olamaz.";
  const parent=allCategories.find(category=>category.id===parentId);if(!parent)return "Üst kategori bulunamadı.";
  if(parent.parentId!==null)return "Kategori ağacı en fazla iki seviye olabilir.";
  if(currentId&&allCategories.some(category=>category.parentId===currentId))return "Alt kategorileri bulunan kategori başka bir kategorinin altına taşınamaz.";
  if(candidateActive&&!parent.active)return "Yayındaki bir alt kategorinin üst kategorisi de yayında olmalıdır.";
  return null;
}
