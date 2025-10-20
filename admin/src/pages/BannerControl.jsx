import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-toastify';

const BannerControl = () => {
  const [banner, setBanner] = useState({ message: '', active: true });

  const fetchBanner = async () => {
    const { data, error } = await supabase
      .from('banner')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) setBanner(data);
  };

  useEffect(() => {
    fetchBanner();
  }, []);

  const handleSave = async () => {
    const { error } = await supabase
      .from('banner')
      .update({
        message: banner.message,
        active: banner.active,
        updated_at: new Date(),
      })
      .eq('id', banner.id);

    if (error) toast.error('Error updating banner: ' + error.message);
    else toast.success('Banner updated!');
  };

  return (
    <div className='p-6'>
      <h2 className='text-2xl font-semibold mb-4'>🪧 Edit Banner Message</h2>

      <textarea
        value={banner.message}
        onChange={(e) => setBanner({ ...banner, message: e.target.value })}
        placeholder="Type banner message here..."
        className='w-full border p-3 rounded mb-4'
        rows='4'
      />

      <label className='flex items-center gap-2 mb-4'>
        <input
          type='checkbox'
          checked={banner.active}
          onChange={(e) => setBanner({ ...banner, active: e.target.checked })}
        />
        Show banner on website
      </label>

      <button
        onClick={handleSave}
        className='bg-black text-white px-6 py-2 rounded hover:bg-gray-800'
      >
        Save Changes
      </button>
    </div>
  );
};

export default BannerControl;
