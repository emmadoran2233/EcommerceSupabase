import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import ProductCard from "../components/ProductCard";
import { assets } from "../assets/assets";

const StorePage = () => {
  const { sellerId } = useParams();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [lends, setLends] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---------------- Fetch all store data ----------------
  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // 1️⃣ Fetch seller profile info
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, bio, intro")
        .eq("id", sellerId)
        .maybeSingle();

      if (profileError) throw profileError;
      setSeller(profile);

      // 2️⃣ Fetch seller’s products
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (productError) throw productError;
      setProducts(productData || []);

      // 3️⃣ Fetch seller’s lend items
      const { data: lendData, error: lendError } = await supabase
        .from("lend_items")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (lendError) throw lendError;
      setLends(lendData || []);
    } catch (error) {
      console.error("Error loading store data:", error);
      toast.error("Failed to load store data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, [sellerId]);

  // ---------------- Loading / Empty states ----------------
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-[70vh] text-gray-500">
        Loading store...
      </div>
    );

  if (!seller)
    return (
      <div className="text-center py-20 text-gray-500">
        Seller not found or profile unavailable.
      </div>
    );

  // ---------------- Render ----------------
  return (
    <div className="py-10 max-w-6xl mx-auto px-4">
      {/* 🏪 Store Header */}
      <div className="border-b pb-6 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
        <img
          src={seller?.avatar_url || assets.user_icon}
          alt={seller?.name}
          className="w-24 h-24 rounded-full object-cover border shadow-sm"
        />
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-semibold text-gray-900">
            {seller?.name || "Seller Store"}
          </h1>
          <p className="text-gray-600 mt-2">
            {seller?.bio || "Verified seller on our marketplace"}
          </p>
        </div>
      </div>

      {/* 💬 Store Intro */}
      <div className="bg-gray-50 p-6 rounded-lg mb-10 border shadow-sm">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">
          Services I Offer
        </h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
          {seller?.intro ||
            "Welcome to my store! I offer high-quality products and friendly service."}
        </p>
      </div>

      {/* 🛍️ Seller’s Products */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Products for Sale
        </h2>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No products available yet.</p>
        )}
      </div>

      {/* 📦 Seller’s Lend Items */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Items for Rent
        </h2>
        {lends.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {lends.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  ...item,
                  price: item.price_per_day,
                  name: `${item.name} (Per Day)`,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No items available for rent.</p>
        )}
      </div>
    </div>
  );
};

export default StorePage;
