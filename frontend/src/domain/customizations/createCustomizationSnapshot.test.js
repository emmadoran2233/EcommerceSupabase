import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  createCustomizationSnapshot,
  DEFAULT_CUSTOMIZATION_COLOR,
} from "./createCustomizationSnapshot.js";

describe("customization snapshot", () => {
  test("normalizes a cart-owned customization without user or order ids", () => {
    const snapshot = createCustomizationSnapshot(
      { lines: [" HELLO ", "WORLD"], color: "#2563eb" },
      { createId: () => "custom-1" }
    );

    assert.deepEqual(snapshot, {
      id: "custom-1",
      lines: ["HELLO", "WORLD", ""],
      color: "#2563eb",
    });
    assert.equal(Object.isFrozen(snapshot), true);
  });

  test("keeps the existing id when a customization is edited", () => {
    const snapshot = createCustomizationSnapshot({
      id: "custom-1",
      lines: ["UPDATED"],
    });

    assert.equal(snapshot.id, "custom-1");
    assert.equal(snapshot.color, DEFAULT_CUSTOMIZATION_COLOR);
  });

  test("rejects an empty customization", () => {
    assert.throws(
      () =>
        createCustomizationSnapshot(
          { lines: [" ", ""] },
          { createId: () => "custom-1" }
        ),
      /at least one custom line/i
    );
  });

  test("enforces the domain length limit outside the modal", () => {
    assert.throws(
      () =>
        createCustomizationSnapshot(
          { lines: ["1234567890123456"] },
          { createId: () => "custom-1" }
        ),
      /15 characters or fewer/i
    );
  });
});
