import React, { useEffect, useState } from "react";
import { currency } from "../App";
import { toast } from "react-toastify";
import { supabase } from "../supabaseClient";

const List = ({ token, user }) => {
  const [list, setList] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  // ---------------- Fetch Seller’s Products ----------------
  const fetchList = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setList(data);
    } catch (error) {
      console.error("Fetch list error:", error);
      toast.error(error.message);
    }
  };

  // ---------------- Toggle Customizable ----------------
  const toggleCustomizable = async (productId, currentValue) => {
    if (!user?.id) return;

    setUpdatingId(productId);
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_customizable: !currentValue })
        .eq("id", productId)
        .eq("seller_id", user.id);

      if (error) throw error;

      setList((prev) =>
        prev.map((item) =>
          item.id === productId
            ? { ...item, is_customizable: !currentValue }
            : item
        )
      );
      toast.success(
        `Customization ${!currentValue ? "enabled" : "disabled"} for this product.`
      );
    } catch (error) {
      console.error("Toggle customizable error:", error);
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // ---------------- Remove Product ----------------
  const removeProduct = async (id) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      toast.success("Product removed successfully!");
      await fetchList();
    } catch (error) {
      console.error("Remove error:", error);
      toast.error(error.message);
    }
  };

  // ---------------- Lifecycle ----------------
  useEffect(() => {
    if (user?.id) {
      fetchList();
    }
  }, [user]);

  // ---------------- Render ----------------
  return (
    <>
      <p className="mb-2 font-semibold text-lg">All Products List</p>
      <div className="flex flex-col gap-2">
        {/* ------- List Table Title ---------- */}
        <div className="hidden md:grid grid-cols-[1fr_3fr_1fr_1fr_1fr_1fr_1.5fr] items-center py-1 px-2 border bg-gray-100 text-sm">
          <b>Image</b>
          <b>Name</b>
          <b>Category</b>
          <b>Price</b>
          <b>Stock</b>
          <b>Customizable</b>
          <b className="text-center">Action</b>
        </div>

        {/* ------ Product List ------ */}
        {list.map((item, index) => (
          <div
            className="grid grid-cols-[1fr_3fr_1fr] md:grid-cols-[1fr_3fr_1fr_1fr_1fr_1fr_1.5fr] items-center gap-2 py-1 px-2 border text-sm"
            key={index}
          >
            <img className="w-12" src={item.images && item.images[0]} alt="" />
            <p>{item.name}</p>
            <p>{item.category}</p>
            <p>
              {currency}
              {item.price}
            </p>
            <p>{item.stock ?? 0}</p>
            <div className="flex items-center gap-2">
              <label
                htmlFor={`customizable-${item.id}`}
                className="text-xs text-gray-500"
              >
                {item.is_customizable ? "Yes" : "No"}
              </label>
              <input
                id={`customizable-${item.id}`}
                type="checkbox"
                checked={!!item.is_customizable}
                onChange={() => toggleCustomizable(item.id, !!item.is_customizable)}
                disabled={updatingId === item.id}
                className="cursor-pointer"
              />
            </div>
            <p
              onClick={() => removeProduct(item.id)}
              className="text-right md:text-center cursor-pointer text-lg text-red-500"
            >
              ×
            </p>
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-center text-gray-500 py-10">
            You haven’t added any products yet.
          </p>
        )}
      </div>
    </>
  );
};

export default List;

