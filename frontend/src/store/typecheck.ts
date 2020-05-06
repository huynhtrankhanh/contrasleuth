export const Number = (value: any) => typeof value === "number";

type Predicate = (value: any) => boolean;
export const refinement = (predicate: Predicate, refinement: Predicate) => (
  value: any
) => predicate(value) && refinement(value);

export const list = (predicate: Predicate) => (value: any) =>
  Array.isArray(value) && value.every(predicate);

export const String = (value: any) => typeof value === "string";

export const maybe = (predicate: Predicate) => (value: any) =>
  value === null || predicate(value);

export const struct = (shape: Record<string, Predicate>) => (value: any) => {
  if (value === null || typeof value !== "object") return false;
  if (
    Object.keys(value).some(
      (key) => shape[key] === undefined || !shape[key](value[key])
    )
  )
    return false;
  if (Object.keys(shape).some((key) => value[key] === undefined)) return false;
  return true;
};

export const union = (predicates: Predicate[]) => (value: any) =>
  predicates.some((predicate) => predicate(value));
