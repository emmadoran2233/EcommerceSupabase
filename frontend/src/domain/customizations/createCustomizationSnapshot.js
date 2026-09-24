export const MAX_CUSTOMIZATION_LINES = 3;
export const MAX_CUSTOMIZATION_LINE_LENGTH = 15;
export const DEFAULT_CUSTOMIZATION_COLOR = "#111827";

const defaultCreateId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error("A customization id generator is required");
};

export const createCustomizationSnapshot = (
  { id, lines, color },
  { createId = defaultCreateId } = {}
) => {
  const normalizedLines = (Array.isArray(lines) ? lines : [])
    .slice(0, MAX_CUSTOMIZATION_LINES)
    .map((line) => String(line || "").trim());

  while (normalizedLines.length < MAX_CUSTOMIZATION_LINES) {
    normalizedLines.push("");
  }

  if (!normalizedLines.some(Boolean)) {
    throw new Error("Enter at least one custom line.");
  }

  if (
    normalizedLines.some(
      (line) => line.length > MAX_CUSTOMIZATION_LINE_LENGTH
    )
  ) {
    throw new Error(
      `Each custom line must be ${MAX_CUSTOMIZATION_LINE_LENGTH} characters or fewer.`
    );
  }

  return Object.freeze({
    id: id || createId(),
    lines: Object.freeze(normalizedLines),
    color: color || DEFAULT_CUSTOMIZATION_COLOR,
  });
};
