import { createId } from "@paralleldrive/cuid2";
export const newId = (prefix = "") => `${prefix}${createId()}`;
