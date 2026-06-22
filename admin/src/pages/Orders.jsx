import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { assets } from "../assets/assets";
import { currency } from "../App";
import { supabase } from "../supabaseClient.js";

const ORDER_STATUS_OPTIONS = [
  "Order Placed",
  "Packing",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
];

const SHIPPING_MODE_OPTIONS = [
  { label: "Manual tracking", value: "manual" },
  { label: "Shippo API label", value: "shippo" },
];

const DEFAULT_PARCEL = {
  length: "",
  width: "",
  height: "",
  distanceUnit: "in",
  weight: "",
  massUnit: "lb",
};

// Shippo needs complete sender contact and address details before it can
// price a shipment and USPS requires email/phone before purchasing a label.
// The seller can refine this per order without changing their store profile.
const createDefaultAddress = (user) => ({
  name: "",
  street1: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  phone: "",
  email: user?.email || "",
});

// Each order row owns an isolated shipping draft so edits do not leak across orders.
const createDefaultDraft = (user) => ({
  mode: "manual",
  trackingNumber: "",
  trackingUrl: "",
  fromAddress: createDefaultAddress(user),
  parcel: DEFAULT_PARCEL,
  rates: [],
  selectedRateId: "",
  shipmentId: "",
  loadingRates: false,
  purchasingLabel: false,
});

const inputClass = "border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black";
const labelClass = "text-xs font-semibold text-gray-700";
const helperClass = "text-[11px] leading-4 text-gray-500";

const getOrderDisplayId = (order) => order.order_id || order.id;

const formatAddressName = (address = {}) =>
  [address.firstName, address.lastName].filter(Boolean).join(" ");

const formatDate = (date) => {
  if (!date) return "";
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toLocaleDateString();
};

const getSellerItems = (order, sellerId) =>
  Array.isArray(order.items)
    ? order.items.filter((item) => item?.seller_id === sellerId)
    : [];

// Shippo responses can vary slightly by endpoint/version; normalize once so the UI
// only works with the small shape it needs for display and label purchase.
const normalizeRates = (rates = []) =>
  rates
    .map((rate) => ({
      id: rate.id || rate.object_id,
      carrier: rate.carrier || rate.provider || "Carrier",
      service: rate.service || rate.servicelevel?.name || "Service",
      amount: rate.amount || rate.amount_local || rate.rate,
      currency: rate.currency || rate.currency_local || "USD",
      estimatedDays: rate.estimatedDays || rate.estimated_days || null,
    }))
    .filter((rate) => rate.id);

// Rate lookup is intentionally locked until the minimum shipment data is present.
// This prevents avoidable Shippo API calls and avoids showing misleading rates.
const validateShippoDraft = (draft) => {
  const requiredAddressFields = [
    "name",
    "email",
    "phone",
    "street1",
    "city",
    "state",
    "zip",
    "country",
  ];
  const missingAddress = requiredAddressFields.find(
    (field) => !String(draft.fromAddress?.[field] || "").trim()
  );

  if (missingAddress) {
    return "Please complete the ship-from contact and address details.";
  }

  const requiredParcelFields = ["length", "width", "height", "weight"];
  const missingParcel = requiredParcelFields.find(
    (field) => !String(draft.parcel?.[field] || "").trim()
  );

  if (missingParcel) return "Please complete package size and weight.";

  return "";
};

const Field = ({ label, helper, children }) => (
  <label className="flex flex-col gap-1">
    <span className={labelClass}>{label}</span>
    {children}
    {helper && <span className={helperClass}>{helper}</span>}
  </label>
);

const TextInput = ({ label, helper, ...inputProps }) => (
  <Field label={label} helper={helper}>
    <input {...inputProps} className={inputClass} />
  </Field>
);

const SelectField = ({ label, helper, children, ...selectProps }) => (
  <Field label={label} helper={helper}>
    <select {...selectProps} className={inputClass}>
      {children}
    </select>
  </Field>
);

const Orders = ({ token, user }) => {
  const [orders, setOrders] = useState([]);
  const [shippingDrafts, setShippingDrafts] = useState({});

  // ---------------- Shipping Draft Helpers ----------------
  // Merge stored row state with defaults so older orders still render safely when
  // new shipping fields are added later.
  const getDraft = (orderId) => ({
    ...createDefaultDraft(user),
    ...(shippingDrafts[orderId] || {}),
  });

  const updateShippingDraft = (orderId, updates) => {
    setShippingDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...createDefaultDraft(user),
        ...(prev[orderId] || {}),
        ...updates,
      },
    }));
  };

  const updateNestedShippingDraft = (orderId, section, field, value) => {
    setShippingDrafts((prev) => {
      const draft = {
        ...createDefaultDraft(user),
        ...(prev[orderId] || {}),
      };

      return {
        ...prev,
        [orderId]: {
          ...draft,
          // Any sender address or package edit invalidates previously returned rates.
          rates: [],
          selectedRateId: "",
          shipmentId: "",
          [section]: {
            ...draft[section],
            [field]: value,
          },
        },
      };
    });
  };

  // ---------------- Fetch Orders ----------------
  const fetchAllOrders = async () => {
    if (!token || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // The database policy already scopes access, but the UI still filters orders
      // down to the current seller's line items before rendering totals/actions.
      const sellerOrders = (data || []).filter(
        (order) => getSellerItems(order, user.id).length > 0
      );

      setOrders(sellerOrders);
      setShippingDrafts(
        sellerOrders.reduce((drafts, order) => {
          drafts[order.id] = {
            ...createDefaultDraft(user),
            mode: order.shipping_provider === "shippo" ? "shippo" : "manual",
            trackingNumber: order.shipping_tracking_number || "",
            trackingUrl: order.shipping_tracking_url || "",
          };
          return drafts;
        }, {})
      );
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error(error.message);
    }
  };

  // ---------------- Shippo Rates ----------------
  const getShippoRates = async (order) => {
    const orderId = order.id;
    const draft = getDraft(orderId);
    const validationError = validateShippoDraft(draft);

    // Keep this client-side guard in sync with the disabled button below. The
    // Edge Function also validates server-side before calling Shippo.
    if (validationError) {
      toast.error(validationError);
      return;
    }

    updateShippingDraft(orderId, { loadingRates: true });

    try {
      // Shippo calls live in an Edge Function so the API token never reaches the browser.
      const { data, error } = await supabase.functions.invoke("shippoShipping", {
        body: {
          action: "get_rates",
          orderId,
          fromAddress: draft.fromAddress,
          parcel: draft.parcel,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "Failed to get rates");
      }

      const rates = normalizeRates(data?.rates || []);
      updateShippingDraft(orderId, {
        loadingRates: false,
        rates,
        selectedRateId: rates[0]?.id || "",
        shipmentId: data?.shipmentId || "",
      });
      toast.success("Shipping rates loaded.");
    } catch (error) {
      console.error("Shippo rate error:", error);
      updateShippingDraft(orderId, { loadingRates: false });
      toast.error(error.message || "Failed to get Shippo rates");
    }
  };

  // ---------------- Purchase Shipping Label ----------------
  const purchaseShippoLabel = async (order) => {
    const orderId = order.id;
    const draft = getDraft(orderId);
    const selectedRate = draft.rates.find((rate) => rate.id === draft.selectedRateId);

    // A label purchase must be tied to a specific rate returned by Shippo.
    if (!selectedRate) {
      toast.error("Please select a shipping rate first.");
      return;
    }

    updateShippingDraft(orderId, { purchasingLabel: true });

    try {
      // The function buys the label and persists tracking/label metadata on the order.
      const { data, error } = await supabase.functions.invoke("shippoShipping", {
        body: {
          action: "buy_label",
          orderId,
          rateId: selectedRate.id,
          selectedRate,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "Failed to buy label");
      }

      updateShippingDraft(orderId, {
        purchasingLabel: false,
        trackingNumber: data.trackingNumber || "",
        trackingUrl: data.trackingUrl || "",
        mode: "shippo",
      });
      toast.success("Shipping label purchased.");
      await fetchAllOrders();
    } catch (error) {
      console.error("Shippo label error:", error);
      updateShippingDraft(orderId, { purchasingLabel: false });
      toast.error(error.message || "Failed to buy Shippo label");
    }
  };

  // ---------------- Update Order Status ----------------
  const statusHandler = async (event, order) => {
    const status = event.target.value;
    const orderId = order.id;

    if (status === "Cancelled") {
      const confirmed = window.confirm(
        `Cancel order #${getOrderDisplayId(order)}? This will notify the customer.`
      );

      if (!confirmed) {
        event.target.value = order.status;
        return;
      }
    }

    const shippingDraft = getDraft(orderId);
    const updatePayload = {
      status,
      shipping_tracking_number: shippingDraft.trackingNumber.trim() || null,
      shipping_tracking_url: shippingDraft.trackingUrl.trim() || null,
    };

    try {
      // Manual tracking details are saved with the status update so sellers can
      // fill tracking first and then mark the order as shipped in one action.
      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);

      if (error) throw error;

      const eventType =
        status === "Cancelled" ? "order_cancelled" : "order_status_updated";

      const { data: emailData, error: emailError } =
        await supabase.functions.invoke("sendOrderEmails", {
          body: {
            orderId,
            eventType,
            status,
          },
        });

      if (emailError) {
        console.warn("Order status email failed:", emailError.message || emailError);
      } else if (emailData?.success === false) {
        console.warn("Order status email failed:", emailData.results || emailData.error);
      }

      toast.success("Order status updated!");
      await fetchAllOrders();
    } catch (error) {
      console.error("Status update error:", error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, [token, user]);

  // ---------------- Render ----------------
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Orders</h3>

      <div>
        {orders.map((order) => {
          const sellerItems = getSellerItems(order, user?.id);
          const address = order.address || {};
          const draft = getDraft(order.id);
          const shippoValidationMessage = validateShippoDraft(draft);
          // The same readiness flag controls the note, button state, and rate selector.
          const shippoReady = !shippoValidationMessage;

          return (
            <div
              key={order.id}
              className="my-3 grid grid-cols-1 items-start gap-4 border-2 border-gray-200 p-5 text-xs text-gray-700 sm:grid-cols-[0.5fr_2fr_1fr] sm:text-sm md:my-4 md:p-8 lg:grid-cols-[0.5fr_2fr_1fr_1fr_1.2fr]"
            >
              <img className="w-12" src={assets.parcel_icon} alt="parcel" />

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  Order ID: {getOrderDisplayId(order)}
                </p>

                <div>
                  {sellerItems.map((item, index) => (
                    <p key={`${item.id || item.name}-${index}`} className="py-0.5">
                      {item.name} x {item.quantity}{" "}
                      {item.size && item.size !== "One Size" && (
                        <span className="text-gray-500">{item.size}</span>
                      )}
                    </p>
                  ))}
                </div>

                <p className="mb-2 mt-3 font-medium">{formatAddressName(address)}</p>
                <div>
                  <p>{address.street},</p>
                  <p>
                    {address.city}, {address.state}, {address.country},{" "}
                    {address.zipcode}
                  </p>
                </div>
                <p>{address.phone}</p>
              </div>

              <div>
                <p className="text-sm sm:text-[15px]">Items: {sellerItems.length}</p>
                <p className="mt-3">Method: {order.paymentmethod || order.paymentMethod}</p>
                <p>Payment: {order.payment ? "Done" : "Pending"}</p>
                <p>Date: {formatDate(order.date)}</p>
              </div>

              <p className="text-sm font-medium sm:text-[15px]">
                {currency}
                {sellerItems
                  .reduce((sum, item) => sum + item.price * item.quantity, 0)
                  .toFixed(2)}
              </p>

              <div className="flex flex-col gap-3">
                <SelectField
                  label="Order status"
                  value={order.status}
                  onChange={(event) => statusHandler(event, order)}
                >
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Shipping method"
                  value={draft.mode}
                  onChange={(event) =>
                    updateShippingDraft(order.id, { mode: event.target.value })
                  }
                >
                  {SHIPPING_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>

                <TextInput
                  label="Tracking number"
                  helper="Enter manually or let Shippo fill this after label purchase."
                  type="text"
                  value={draft.trackingNumber}
                  onChange={(event) =>
                    updateShippingDraft(order.id, { trackingNumber: event.target.value })
                  }
                  placeholder="Tracking number"
                />

                <TextInput
                  label="Tracking link"
                  helper="This link is shown to the buyer for shipment tracking."
                  type="url"
                  value={draft.trackingUrl}
                  onChange={(event) =>
                    updateShippingDraft(order.id, { trackingUrl: event.target.value })
                  }
                  placeholder="https://..."
                />

                {draft.mode === "shippo" && (
                  <div className="flex flex-col gap-3 border border-gray-200 bg-gray-50 p-3">
                    <div>
                      <p className="font-semibold text-gray-800">Shippo label</p>
                      <p className={helperClass}>
                        Service options and shipping rate estimates appear after the
                        ship-from address and package information are completed.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className={labelClass}>Ship-from address</p>
                      <TextInput
                        label="Sender name"
                        type="text"
                        value={draft.fromAddress.name}
                        onChange={(event) =>
                          updateNestedShippingDraft(
                            order.id,
                            "fromAddress",
                            "name",
                            event.target.value
                          )
                        }
                        placeholder="Store or sender name"
                      />

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <TextInput
                          label="Sender email"
                          helper="Required by USPS before a label can be purchased."
                          type="email"
                          value={draft.fromAddress.email}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "email",
                              event.target.value
                            )
                          }
                          placeholder="seller@example.com"
                        />
                        <TextInput
                          label="Sender phone"
                          helper="Required by USPS before a label can be purchased."
                          type="tel"
                          value={draft.fromAddress.phone}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "phone",
                              event.target.value
                            )
                          }
                          placeholder="555-555-5555"
                        />
                      </div>

                      <TextInput
                        label="Street address"
                        type="text"
                        value={draft.fromAddress.street1}
                        onChange={(event) =>
                          updateNestedShippingDraft(
                            order.id,
                            "fromAddress",
                            "street1",
                            event.target.value
                          )
                        }
                        placeholder="Street address"
                      />

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <TextInput
                          label="City"
                          type="text"
                          value={draft.fromAddress.city}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "city",
                              event.target.value
                            )
                          }
                          placeholder="City"
                        />
                        <TextInput
                          label="State"
                          type="text"
                          value={draft.fromAddress.state}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "state",
                              event.target.value
                            )
                          }
                          placeholder="State"
                        />
                        <TextInput
                          label="ZIP code"
                          type="text"
                          value={draft.fromAddress.zip}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "zip",
                              event.target.value
                            )
                          }
                          placeholder="ZIP"
                        />
                        <TextInput
                          label="Country"
                          type="text"
                          value={draft.fromAddress.country}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "fromAddress",
                              "country",
                              event.target.value
                            )
                          }
                          placeholder="US"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                      <div>
                        <p className={labelClass}>Package information</p>
                        <p className={helperClass}>
                          Use the packed box size. Dimensions are in inches and
                          weight is in pounds.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <TextInput
                          label="Length (in)"
                          type="number"
                          min="0"
                          value={draft.parcel.length}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "parcel",
                              "length",
                              event.target.value
                            )
                          }
                          placeholder="Length"
                        />
                        <TextInput
                          label="Width (in)"
                          type="number"
                          min="0"
                          value={draft.parcel.width}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "parcel",
                              "width",
                              event.target.value
                            )
                          }
                          placeholder="Width"
                        />
                        <TextInput
                          label="Height (in)"
                          type="number"
                          min="0"
                          value={draft.parcel.height}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "parcel",
                              "height",
                              event.target.value
                            )
                          }
                          placeholder="Height"
                        />
                        <TextInput
                          label="Weight (lb)"
                          type="number"
                          min="0"
                          value={draft.parcel.weight}
                          onChange={(event) =>
                            updateNestedShippingDraft(
                              order.id,
                              "parcel",
                              "weight",
                              event.target.value
                            )
                          }
                          placeholder="Weight"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => getShippoRates(order)}
                      disabled={!shippoReady || draft.loadingRates}
                      className="border border-black px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {draft.loadingRates ? "Loading rates..." : "Get Shippo rates"}
                    </button>

                    {!shippoReady && (
                      <p className={helperClass}>
                        Complete the ship-from contact, address, and package information
                        before viewing service options and shipping rate estimates.
                      </p>
                    )}

                    {/* Show carrier services only after Shippo returns rates for complete shipment details. */}
                    {shippoReady && draft.rates.length > 0 && (
                      <>
                        <SelectField
                          label="Service and estimated rate"
                          helper="Estimates come from Shippo and may change when package details change."
                          value={draft.selectedRateId}
                          onChange={(event) =>
                            updateShippingDraft(order.id, {
                              selectedRateId: event.target.value,
                            })
                          }
                        >
                          {draft.rates.map((rate) => (
                            <option key={rate.id} value={rate.id}>
                              {rate.carrier} {rate.service} - {rate.currency}{" "}
                              {rate.amount}
                              {rate.estimatedDays
                                ? ` (${rate.estimatedDays} days)`
                                : ""}
                            </option>
                          ))}
                        </SelectField>

                        <button
                          type="button"
                          onClick={() => purchaseShippoLabel(order)}
                          disabled={draft.purchasingLabel}
                          className="bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {draft.purchasingLabel ? "Purchasing..." : "Purchase label"}
                        </button>
                      </>
                    )}

                    {order.shipping_label_url && (
                      <a
                        href={order.shipping_label_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 underline"
                      >
                        Open shipping label
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <p className="mt-10 text-center text-gray-500">
            No orders found for your products.
          </p>
        )}
      </div>
    </div>
  );
};

export default Orders;
