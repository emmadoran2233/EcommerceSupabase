import React, { useEffect, useState } from 'react';
import { Alert, Collapse, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../supabaseClient';

const BannerAlert = () => {
  const [banner, setBanner] = useState(null);
  const [open, setOpen] = useState(true);

  // Fetch banner from Supabase
  const fetchBanner = async () => {
    const { data, error } = await supabase
      .from('banner')
      .select('*')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) setBanner(data);
  };

  useEffect(() => {
    fetchBanner();

    // Real-time listener (auto-refresh when admin updates banner)
    const channel = supabase
      .channel('banner-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banner' },
        () => fetchBanner()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!banner || !banner.active) return null;

  return (
    <Collapse in={open}>
      <Alert
        severity="info"
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => setOpen(false)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          borderRadius: 0,
          zIndex: 2000,
          textAlign: 'center',
        }}
      >
        {banner.message}
      </Alert>
    </Collapse>
  );
};

export default BannerAlert;
