import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabaseClient';

const MostWantedRequest = () => {
  const [itemName, setItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = itemName.trim();

    if (!trimmedName) {
      toast.error('Please describe the item you want to rent.');
      return;
    }

    try {
      setSubmitting(true);
      let uploadedImageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `requests/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('request-images')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('request-images')
          .getPublicUrl(fileName);
        uploadedImageUrl = publicUrlData?.publicUrl || null;
      }

      const { error } = await supabase
        .from('requests')
        .insert([{ item_name: trimmedName, image_url: uploadedImageUrl }]);

      if (error) {
        throw error;
      }

      toast.success('Thanks! Your rental wish has been saved.');
      setItemName('');
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      toast.error(error.message || 'Unable to save your request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const maxSizeMb = 5;
    if (file.size / 1024 / 1024 > maxSizeMb) {
      toast.error(`Please upload an image smaller than ${maxSizeMb}MB.`);
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <div className="text-center border rounded-xl px-6 py-12 mt-16 bg-gray-50 shadow-sm">
      <p className="text-2xl font-semibold text-gray-900">
        Looking for something we don&apos;t have?
      </p>
      <p className="text-gray-600 mt-3 max-w-3xl mx-auto">
        Submit your rental wish below — we collect the most requested items.
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-3/4 lg:w-2/3 flex flex-col gap-4 mx-auto my-8 border border-gray-200 rounded-3xl p-5 bg-white"
      >
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <input
            className="w-full flex-1 outline-none text-sm text-gray-800 border border-gray-200 rounded-full px-5 py-3"
            type="text"
            placeholder="Tell us the item you'd like to rent"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            maxLength={120}
            disabled={submitting}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white text-xs font-semibold px-8 py-3 rounded-full min-w-[150px] disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'SUBMIT'}
          </button>
        </div>

        <div className="flex flex-col gap-2 text-left">
          <label className="text-xs font-semibold text-gray-600">
            Optional image (helps us source the exact item)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={submitting}
            className="text-sm text-gray-700"
          />
          {imagePreview && (
            <div className="flex items-center gap-4 mt-2">
              <img
                src={imagePreview}
                alt="Request preview"
                className="w-20 h-20 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={clearImage}
                className="text-xs font-medium text-red-500"
              >
                Remove image
              </button>
            </div>
          )}
        </div>
      </form>

      <Link
        to="/wanted-items"
        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-900"
      >
        Browse the community wish list →
      </Link>
    </div>
  );
};

export default MostWantedRequest;
