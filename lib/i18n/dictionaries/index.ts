import type { Locale } from "../config";
import { en, type Dictionary } from "./en";
import { zh } from "./zh";

export type { Dictionary };

/** Both dictionaries are small (~10 KB), so they ship together and switching needs no extra fetch. */
export const dictionaries: Record<Locale, Dictionary> = { en, zh };
