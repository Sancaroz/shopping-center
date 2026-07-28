import { eq, or } from "drizzle-orm";
import { products } from "../db/schema";

export function inventoryEligibleProduct() {
  return or(
    eq(products.active, true),
    eq(products.marketTr, true),
    eq(products.marketGlobal, true),
  )!;
}
