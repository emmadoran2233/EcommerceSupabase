import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

const EditStoreInfo = ({ user }) => {
  const [profile, setProfile] = useState({
    name: "",
    intro: "",
    bio: "",
    avatar_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ✅ Fetch store info for this seller
  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, intro, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          name: data.name || "",
          intro: data.intro || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
        });
      } else {
        // Create a blank profile if none exists
        const { error: insertError } = await supabase.from("profiles").insert([
          {
            id: user.id,
            name: user.email?.split("@")[0] || "Seller Store",
            intro: "Welcome to my store!",
            bio: "",
            avatar_url: "",
          },
        ]);
        if (insertError) throw insertError;
      }
    } catch (err) {
      toast.error("Error fetching profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // ✅ Handle image upload
  const handleUpload = async (event) => {
    try {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = fileName;

        // ✅ Upload the avatar
        const { error: uploadError } = await supabase.storage
        .from("store-avatars")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type,
        });

        if (uploadError) throw uploadError;

        // ✅ Retrieve the public URL
        const {
        data: { publicUrl },
        } = supabase.storage.from("store-avatars").getPublicUrl(filePath);

        // ✅ Update profile table
        const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

        if (updateError) throw updateError;

        setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
        toast.success("✅ Avatar updated successfully!");
    } catch (err) {
        console.error("Upload error:", err);
        toast.error("Error uploading image: " + err.message);
    } finally {
        setUploading(false);
    }
    };




  // ✅ Save updated store info
  const handleSave = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          intro: profile.intro,
          bio: profile.bio,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Store info updated!");
    } catch (err) {
      toast.error("Failed to update: " + err.message);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6">🛍️ Edit Store Info</h2>

      {loading ? (
        <p className="text-gray-500">Loading store information...</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ✅ Avatar upload */}
          <div className="flex items-center gap-4">
            <img
              src={
                profile.avatar_url ||
                "https://via.placeholder.com/100?text=No+Image"
              }
              alt="Store avatar"
              className="w-24 h-24 rounded-full object-cover border"
            />
            <div>
              <label className="cursor-pointer bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">
                {uploading ? "Uploading..." : "Change Avatar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* ✅ Name */}
          <label className="flex flex-col">
            <span className="text-sm mb-1 font-medium">Store Name</span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="border p-2 rounded"
              placeholder="Enter store name"
            />
          </label>

          {/* ✅ Intro */}
          <label className="flex flex-col">
            <span className="text-sm mb-1 font-medium">Services I Offer</span>
            <textarea
              value={profile.intro}
              onChange={(e) =>
                setProfile({ ...profile, intro: e.target.value })
              }
              className="border p-2 rounded"
              rows={3}
              placeholder="Write your store intro..."
            />
          </label>

          {/* ✅ Bio */}
          <label className="flex flex-col">
            <span className="text-sm mb-1 font-medium">About / Bio</span>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="border p-2 rounded"
              rows={4}
              placeholder="Tell customers about your store..."
            />
          </label>

          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-black text-white px-5 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
};

export default EditStoreInfo;
