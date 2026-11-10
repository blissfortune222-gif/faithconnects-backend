// Compatibility scoring logic, isolated so it can be replaced later with a
// more advanced matching algorithm.

export const calculateCompatibility = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map((s) => s.toLowerCase().trim()));
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));
  const shared = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  // Jaccard-style ratio of shared to total unique interests.
  return Math.round((shared.length / union.size) * 100);
};

export const sharedInterests = (a: string[], b: string[]): string[] => {
  const setA = new Set(a.map((s) => s.toLowerCase().trim()));
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));
  return [...setA].filter((x) => setB.has(x));
};
