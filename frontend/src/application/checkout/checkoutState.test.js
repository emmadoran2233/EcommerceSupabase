import { test } from "vitest";
import assert from "node:assert/strict";
import {
  checkoutPhases,
  checkoutStateReducer,
  initialCheckoutState,
  isCheckoutBusy,
} from "./checkoutState.js";

const transition = (state, phase, error) =>
  checkoutStateReducer(state, { type: "transition", phase, error });

test("models the hosted payment lifecycle", () => {
  let state = transition(initialCheckoutState, checkoutPhases.validating);
  state = transition(state, checkoutPhases.creatingOrder);
  state = transition(state, checkoutPhases.initializingPayment);
  state = transition(state, checkoutPhases.redirecting);

  assert.equal(state.phase, "redirecting");
  assert.equal(isCheckoutBusy(state), true);
});

test("records stable errors and permits retry", () => {
  let state = transition(initialCheckoutState, checkoutPhases.validating);
  const error = { code: "validation_failed", message: "Invalid cart" };
  state = transition(state, checkoutPhases.failed, error);
  assert.deepEqual(state, { phase: "failed", error });
  assert.equal(isCheckoutBusy(state), false);

  state = transition(state, checkoutPhases.validating);
  assert.deepEqual(state, { phase: "validating", error: null });
});

test("ignores illegal transitions and can always be explicitly reset", () => {
  const illegal = transition(initialCheckoutState, checkoutPhases.completed);
  assert.equal(illegal, initialCheckoutState);

  const reset = checkoutStateReducer(
    { phase: checkoutPhases.awaitingProvider, error: null },
    { type: "reset" }
  );
  assert.equal(reset, initialCheckoutState);
});
