import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

const BannerControl = () => {
  const [banner, setBanner] = useState({ message: "", active: true, id: null });
  const [loading, setLoading] = useState(false);

  // ✅ Fetch the one global banner
  const fetchBanner = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("banner")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // ✅ existing banner found
        setBanner(data);
      } else {
        // ✅ create one if none exists yet
        const { data: newData, error: insertError } = await supabase
          .from("banner")
          .insert([
            {
              message: "",
              active: false,
              updated_at: new Date(),
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        setBanner(newData);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch banner: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanner();
  }, []);

  // ✅ Save / update global banner
  const handleSave = async () => {
    if (!banner.id) return;

    try {
      const { error } = await supabase
        .from("banner")
        .update({
          message: banner.message,
          active: banner.active,
          updated_at: new Date(),
        })
        .eq("id", banner.id);

      if (error) throw error;
      toast.success("Banner updated successfully!");
    } catch (err) {
      toast.error("Error updating banner: " + err.message);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">🪧 Edit Global Banner</h2>

      {loading ? (
        <p className="text-gray-500">Loading banner...</p>
      ) : (
        <>
          <textarea
            value={banner.message}
            onChange={(e) => setBanner({ ...banner, message: e.target.value })}
            placeholder="Type your banner message here..."
            className="w-full border p-3 rounded mb-4"
            rows="4"
          />

          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={banner.active}
              onChange={(e) =>
                setBanner({ ...banner, active: e.target.checked })
              }
            />
            Show banner on website
          </label>

          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      )}
    </div>
  );
};

export default BannerControl;

