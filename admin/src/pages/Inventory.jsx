import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all products
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Update stock
  const updateStock = async (id, stock) => {
    setLoading(true);
    const { error } = await supabase
      .from("products")
      .update({ stock })
      .eq("id", id);

    if (error) {
      alert("Failed to update stock: " + error.message);
    } else {
      await fetchProducts(); // refresh list
    }
    setLoading(false);
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
                  onClick={() => updateStock(p.id, parseInt(p.newStock || p.stock))}
                  className="ml-2 bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventory;
