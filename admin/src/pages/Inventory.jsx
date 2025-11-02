import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

const Inventory = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);

  // ✅ Fetch only products for this seller
  const fetchProducts = async () => {
    if (!user?.id) return; // Wait until user is loaded

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user.id) // ✅ Filter by seller_id
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch inventory: " + err.message);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]); // ✅ refetch when seller changes

  // ✅ Update stock for a specific product
  const updateStock = async (id, newStock) => {
    if (newStock === "" || newStock < 0) {
      toast.error("Please enter a valid stock number");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", id)
        .eq("seller_id", user.id); // ✅ Prevent editing others’ products

      if (error) throw error;

      toast.success("Stock updated successfully!");
      await fetchProducts(); // Refresh list
    } catch (err) {
      toast.error("Failed to update stock: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Toggle customizable
  const toggleCustomizable = async (id, value) => {
    setToggleLoadingId(id);
    const { error } = await supabase
      .from("products")
      .update({ is_customizable: value })
      .eq("id", id);

    if (error) {
      alert("Failed to update customizable: " + error.message);
    } else {
      await fetchProducts(); // refresh list
    }
    setToggleLoadingId(null);
  };

  return (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-6">Inventory Management</h1>
    <table className="w-full border text-left">
      <thead>
        <tr className="bg-gray-200">
          <th className="p-2 border">Product</th>
          <th className="p-2 border">Price</th>
          <th className="p-2 border">Stock</th>
          <th className="p-2 border">Update Stock</th>
          <th className="p-2 border text-center">Customizable</th>
        </tr>
      </thead>

      <tbody>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="p-2 border">{p.name}</td>
            <td className="p-2 border">${p.price}</td>
            <td className="p-2 border">{p.stock}</td>

            <td className="p-2 border">
              <input
                type="number"
                min="0"
                defaultValue={p.stock}
                onChange={(e) => (p.newStock = e.target.value)}
                className="border p-1 w-20"
              />
              <button
                disabled={loading}
                onClick={() =>
                  updateStock(p.id, parseInt(p.newStock || p.stock))
                }
                className={`ml-2 px-3 py-1 rounded text-sm ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </td>

            <td className="p-2 border text-center">
              <input
                type="checkbox"
                checked={!!p.is_customizable}
                disabled={toggleLoadingId === p.id}
                onChange={() =>
                  toggleCustomizable(p.id, !p.is_customizable)
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
};

export default Inventory;
