export const createCheckoutGateway = ({
  supabase,
  httpClient,
  fetchImpl,
  supabaseUrl,
  backendUrl,
  token,
  logger = console,
}) => ({
  async createOrder(orderData) {
    const { data, error } = await supabase.rpc("create_order_with_items", {
      p_order: orderData,
    });

    return { order: data == null ? null : { id: data }, error };
  },

  async notifyOrderSubmitted(orderId) {
    if (!orderId) return;

    try {
      const { data, error } = await supabase.functions.invoke("sendOrderEmails", {
        body: { orderId, eventType: "order_submitted" },
      });

      if (error) {
        logger.warn("Order email notification failed:", error.message || error);
        return;
      }
      if (data?.success === false) {
        logger.warn("Order email notification failed:", data.error || data);
        return;
      }

      const failedResult = Array.isArray(data?.results)
        ? data.results.find(
            (result) =>
              result?.sent === false ||
              (result?.skipped && result.reason !== "already_sent")
          )
        : null;
      if (failedResult) {
        logger.warn("Order email notification failed:", failedResult);
      }
    } catch (error) {
      logger.warn("Order email notification failed:", error);
    }
  },

  async startHostedPayment({ functionName, orderId, amount }) {
    const response = await fetchImpl(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, amount }),
      }
    );
    return response.json();
  },

  async requestRazorpayOrder(orderData) {
    const response = await httpClient.post(
      `${backendUrl}/api/order/razorpay`,
      orderData,
      { headers: { token } }
    );
    return response.data;
  },

  async verifyRazorpayPayment(response) {
    const verification = await httpClient.post(
      `${backendUrl}/api/order/verifyRazorpay`,
      response,
      { headers: { token } }
    );
    return verification.data;
  },
});
