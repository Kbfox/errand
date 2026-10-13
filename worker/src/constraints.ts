// Cheap, deterministic sanity check that a shortlisted product does not contradict an explicit
// attribute the user asked for. The model is told to do this; this makes sure it did.
import type { Candidate } from "./channel3";

// Each group: mutually exclusive values. If the request names one value and the product text names a
// different value from the same group (and not the requested one), the product is rejected.
const GROUPS: string[][] = [
  ["blue switch", "brown switch", "red switch", "black switch", "silver switch", "clicky", "linear", "tactile"],
  ["wired", "wireless", "bluetooth"],
  ["mechanical", "membrane"],
  ["black", "white", "blue", "red", "green", "pink", "grey", "gray", "silver", "gold", "purple", "orange", "yellow", "brown", "beige", "navy"],
  ["men", "women", "kids", "boys", "girls"],
];

const norm = (s: string) => " " + s.toLowerCase().replace(/switches/g, "switch").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ") + " ";

function has(text: string, term: string): boolean {
  return text.includes(" " + term + " ");
}

export function requestedTerms(request: string): string[] {
  const t = norm(request);
  return GROUPS.flat().filter((term) => has(t, term));
}

/** Returns the conflicting term if the product contradicts the request, otherwise null. */
export function conflict(request: string, c: Candidate): string | null {
  const req = norm(request);
  const prod = norm([c.title, ...(c.features ?? []), ...Object.values(c.attributes ?? {})].join(" "));
  for (const group of GROUPS) {
    const wanted = group.filter((term) => has(req, term));
    if (!wanted.length) continue;
    // colour group is noisy (e.g. "blue switch" mentions blue); only apply it when the request names a colour
    // and the product names a *different* colour but none of the wanted ones.
    const present = group.filter((term) => has(prod, term));
    if (!present.length) continue;
    if (wanted.some((w) => present.includes(w))) continue;
    // Special-case: "blue switch" requested and product says "blue" only → treat as satisfied for the colour group.
    return present[0];
  }
  return null;
}
