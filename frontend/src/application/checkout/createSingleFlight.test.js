import { test } from "vitest";
import assert from "node:assert/strict";
import { createSingleFlight } from "./createSingleFlight.js";

test("allows only one in-flight checkout task", async () => {
  const guard = createSingleFlight();
  let release;
  let calls = 0;
  const pending = guard.run(async () => {
    calls += 1;
    await new Promise((resolve) => {
      release = resolve;
    });
    return "done";
  });

  assert.equal(guard.isActive(), true);
  assert.deepEqual(await guard.run(async () => "duplicate"), { executed: false });
  assert.equal(calls, 1);

  release();
  assert.deepEqual(await pending, { executed: true, value: "done" });
  assert.equal(guard.isActive(), false);
});

test("releases the lock when the checkout task throws", async () => {
  const guard = createSingleFlight();
  await assert.rejects(
    guard.run(async () => {
      throw new Error("failed");
    }),
    /failed/
  );
  assert.equal(guard.isActive(), false);
  assert.deepEqual(await guard.run(async () => "retry"), {
    executed: true,
    value: "retry",
  });
});
