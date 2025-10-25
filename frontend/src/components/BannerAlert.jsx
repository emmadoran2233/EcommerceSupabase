import React, { useEffect, useState } from "react";
import { Alert } from "@mui/material";
import { supabase } from "../supabaseClient";

const BannerAlert = () => {
  const [banner, setBanner] = useState(null);

  // ✅ Fetch latest active banner
  const fetchBanner = async () => {
    try {
      const { data, error } = await supabase
        .from("banner")
        .select("*")
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) setBanner(data);
      else setBanner(null);
    } catch (err) {
      console.error("Failed to fetch banner:", err);
    }
  };

  useEffect(() => {
    fetchBanner();

    // ✅ (Optional) Auto-refresh every 60 seconds
    const interval = setInterval(fetchBanner, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!banner?.active || !banner?.message) return null;

  return (
    <Alert
      severity="info"
      sx={{
        mb: 1,
        borderRadius: 0,
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      {banner.message}
    </Alert>
  );
};

export default BannerAlert;
