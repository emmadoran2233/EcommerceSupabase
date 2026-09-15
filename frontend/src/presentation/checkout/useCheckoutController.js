import { useReducer, useRef } from "react";
import { buildOrderItems } from "../../domain/orders/buildOrderItems";
import { buildOrderPayload } from "../../domain/orders/buildOrderPayload";
import { createSingleFlight } from "../../application/checkout/createSingleFlight";
import { submitCheckout } from "../../application/checkout/submitCheckout";
import { validateCheckout } from "../../application/checkout/validateCheckout";
import {
  checkoutPhases,
  checkoutStateReducer,
  initialCheckoutState,
  isCheckoutBusy,
} from "../../application/checkout/checkoutState";
import {
  checkoutErrorCodes,
  toCheckoutError,
} from "../../application/checkout/checkoutError";
import { createRazorpayOptions } from "../../infrastructure/checkout/createRazorpayOptions";

export const useCheckoutController = ({
  gateway,
  razorpayKey,
  createRazorpay,
  redirect,
  navigateToOrders,
  clearCart,
  notify,
}) => {
  const [state, dispatch] = useReducer(
    checkoutStateReducer,
    initialCheckoutState
  );
  const guardRef = useRef(null);
  if (!guardRef.current) guardRef.current = createSingleFlight();

  const transition = (phase, error) =>
    dispatch({ type: "transition", phase, error });

  const fail = (error) => {
    transition(checkoutPhases.failed, error);
    notify.error(error.message);
  };

  const verifyRazorpayPayment = async (response) => {
    try {
      const verification = await gateway.verifyRazorpayPayment(response);
      if (verification.success) {
        transition(checkoutPhases.completed);
        clearCart();
        navigateToOrders();
        return;
      }

      fail(
        toCheckoutError(verification?.error, {
          code: checkoutErrorCodes.paymentVerificationFailed,
          fallbackMessage: "Razorpay verification failed.",
        })
      );
    } catch (error) {
      fail(
        toCheckoutError(error, {
          code: checkoutErrorCodes.paymentVerificationFailed,
          fallbackMessage: "Razorpay verification failed.",
        })
      );
    }
  };

  const openRazorpay = (order) => {
    const options = createRazorpayOptions({
      key: razorpayKey,
      order,
      onPayment: verifyRazorpayPayment,
      onDismiss: () => dispatch({ type: "reset" }),
    });
    createRazorpay(options).open();
  };

  const placeOrder = async ({
    userId,
    address,
    cartItems,
    products,
    subtotal,
    deliveryFee,
    paymentMethod,
  }) =>
    guardRef.current.run(async () => {
      transition(checkoutPhases.validating);
      try {
        if (!userId) {
          fail(
            toCheckoutError(null, {
              code: checkoutErrorCodes.authenticationRequired,
              fallbackMessage: "User not logged in — please login again!",
            })
          );
          return;
        }

        const items = buildOrderItems(cartItems, products);
        const validation = validateCheckout({
          items,
          subtotal,
          deliveryFee,
          paymentMethod,
        });
        if (!validation.valid) {
          fail({ code: validation.code, message: validation.message });
          return;
        }

        const orderData = buildOrderPayload({
          address,
          items,
          amount: subtotal,
          deliveryFee,
          paymentMethod,
          userId,
          checkoutRequestId: globalThis.crypto.randomUUID(),
        });
        const outcome = await submitCheckout({
          method: paymentMethod,
          orderData,
          gateway,
          onPhaseChange: (phase) => transition(phase),
        });

        if (outcome.kind === "completed") {
          transition(checkoutPhases.completed);
          clearCart();
          navigateToOrders();
          notify.success("Order placed successfully!");
        } else if (outcome.kind === "redirect") {
          transition(checkoutPhases.redirecting);
          redirect(outcome.url);
        } else if (outcome.kind === "razorpay") {
          transition(checkoutPhases.awaitingProvider);
          openRazorpay(outcome.order);
        } else if (outcome.kind === "error") {
          fail(outcome.error);
        }
      } catch (error) {
        fail(toCheckoutError(error));
      }
    });

  return {
    state,
    isSubmitting: isCheckoutBusy(state),
    placeOrder,
    reset: () => dispatch({ type: "reset" }),
  };
};
