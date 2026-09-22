import { useCallback, useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "../components/Title";
import { supabase } from "../supabaseClient";
import { createOrderRepository } from "../infrastructure/orders/orderRepository";

const orderRepository = createOrderRepository(supabase);

const PAGE_SIZE_OPTIONS = [5, 10, 20];
const ORDER_STATUS_OPTIONS = [
  "Order Placed",
  "Packing",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
];

const Orders = () => {
  const { user, token, getUserCart, userId, navigate } = useContext(ShopContext);
  const [orderData, setOrderData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [orderIdSearch, setOrderIdSearch] = useState("");

  // ✅ Load only orders for the current user
  const loadOrderData = useCallback(async () => {
    if (!user?.id) {
      setOrderData([]);
      setTotalOrders(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const trimmedOrderId = orderIdSearch.trim();

      const result = await orderRepository.findBuyerOrders({
        userId: user.id,
        page,
        pageSize,
        status: statusFilter,
        orderId: trimmedOrderId || null,
      });
      const formattedOrders = result.orders.map((order) => ({
        id: order.id,
        orderNumber: order.order_number || String(order.id),
        status: order.displayStatus || order.status,
        payment: order.payment,
        paymentmethod: order.paymentmethod,
        date: order.date || order.created_at,
        items: order.items || [],
        shipments: order.fulfillments || [],
      }));

      setOrderData(formattedOrders);
      setTotalOrders(result.count);
    } catch (error) {
      console.error("🔥 loadOrderData error:", error);
    } finally {
      setLoading(false);
    }
  }, [orderIdSearch, page, pageSize, statusFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [user?.id, pageSize, statusFilter, orderIdSearch]);

  useEffect(() => {
    loadOrderData();
  }, [loadOrderData]);

  const clearFilters = () => {
    setStatusFilter("");
    setOrderIdSearch("");
  };

  const totalPages = Math.max(Math.ceil(totalOrders / pageSize), 1);
  const firstVisibleOrder = totalOrders === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisibleOrder = Math.min(page * pageSize, totalOrders);
  const hasFilters = Boolean(statusFilter || orderIdSearch.trim());
  const shouldShowPagination = totalOrders > pageSize;

  const handleReorder = async (orderId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reorder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: orderId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        alert("🛒 Items added to your cart!");
        await getUserCart(userId);
        navigate("/cart");
      } else {
        alert(data.message || "Reorder failed");
      }
    } catch (err) {
      console.error("handleReorder error:", err);
      alert("Reorder failed: " + err.message);
    }
  };

  // ✅ UI Rendering
  if (!user)
    return (
      <div className="text-center py-20 text-gray-500 text-lg">
        Please log in to view your orders.
      </div>
    );

  return (
    <div className="border-t pt-16">
      <div className="text-2xl mb-6">
        <Title text1={"MY"} text2={"ORDERS"} />
      </div>

      <div className="mb-6 grid gap-3 border border-gray-200 bg-white p-4 text-sm md:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Order ID</span>
          <input
            type="search"
            value={orderIdSearch}
            onChange={(event) => setOrderIdSearch(event.target.value)}
            placeholder="20260921214530-ABCDEF-00000123"
            className="border border-gray-300 px-3 py-2 outline-none focus:border-black"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="border border-gray-300 px-3 py-2 outline-none focus:border-black"
          >
            <option value="">All statuses</option>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="border border-gray-300 px-3 py-2 outline-none focus:border-black"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="border border-gray-300 px-3 py-2 text-gray-700 hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 text-lg">
          Loading your orders...
        </div>
      ) : orderData.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-lg">
          {hasFilters
            ? "No orders match your filters."
            : "You haven’t placed any orders yet."}
        </div>
      ) : (
        <div>
          {orderData.map((order) => (
            <div key={order.id} className="py-4 border-t border-b text-gray-700">
              <p className="font-semibold mb-2">
                Order #{order.orderNumber}{" "}
                <span className="text-sm text-gray-500 ml-2">
                  {new Date(order.date).toLocaleDateString()}
                </span>
              </p>

              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-6 text-sm mb-3 bg-gray-50 p-3 rounded"
                >
                  <img
                    className="w-16 sm:w-20 rounded border"
                    src={item.images?.[0] || ""}
                    alt={item.name}
                  />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-gray-600">
                      {order.paymentmethod}
                      {item.size && item.size !== "One Size"
                        ? ` | Size: ${item.size}`
                        : ""}{" "}
                      | Qty: {item.quantity}
                    </p>
                    {item.customization && (
                      <p className="text-xs text-gray-500 mt-1">
                        ✏️ Custom:{" "}
                        {item.customization.lines
                          ?.filter(Boolean)
                          .join(" • ") || "None"}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-between items-center mt-3">
                <p className="text-sm text-gray-500">
                  Status:{" "}
                  <span className="font-medium text-black">{order.status}</span>
                </p>
                <button
                  onClick={() => handleReorder(order.id)}
                  className="border px-4 py-2 text-sm font-medium rounded-sm text-green-600 hover:bg-green-50"
                >
                  Reorder
                </button>
              </div>

              {order.shipments.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <p className="mb-2 text-sm font-semibold text-black">
                    Shipment progress
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {order.shipments.map((shipment, index) => (
                      <div
                        key={shipment.sellerId || `legacy-${index}`}
                        className="border border-gray-200 bg-white p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-black">
                              Shipment {index + 1} · {shipment.sellerName}
                            </p>
                            {shipment.items.length > 0 && (
                              <p className="mt-1 text-xs text-gray-500">
                                {shipment.items
                                  .map((item) => `${item.name} × ${item.quantity}`)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          <span className="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            {shipment.statusLabel}
                          </span>
                        </div>

                        {(shipment.carrier || shipment.service) && (
                          <p className="mt-2 text-gray-600">
                            {[shipment.carrier, shipment.service]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {shipment.trackingNumber && (
                          <p className="mt-2 text-gray-600">
                            Tracking #:{" "}
                            <span className="font-medium text-black">
                              {shipment.trackingNumber}
                            </span>
                          </p>
                        )}
                        {shipment.trackingUrl && (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-blue-600 underline"
                          >
                            Track this shipment
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {shouldShowPagination && (
        <div className="mt-6 flex flex-col gap-3 border-t pt-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {firstVisibleOrder}-{lastVisibleOrder} of {totalOrders} orders
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="border border-gray-300 px-3 py-2 hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="border border-gray-300 px-3 py-2 hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(current + 1, totalPages))
              }
              disabled={page >= totalPages || loading}
              className="border border-gray-300 px-3 py-2 hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
