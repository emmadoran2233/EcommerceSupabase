import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabaseClient';
import { ShopContext } from '../context/ShopContext';

const MostWantedRequest = () => {
  const { userId, navigate } = useContext(ShopContext);
  const [itemName, setItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [similarRequests, setSimilarRequests] = useState([]);
  const [showSimilarPrompt, setShowSimilarPrompt] = useState(false);
  const [pendingRequestName, setPendingRequestName] = useState('');
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [likingExisting, setLikingExisting] = useState({});
  const isFormDisabled = submitting || checkingSimilar;

  const resetFormState = () => {
    setItemName('');
    setPendingRequestName('');
    setSimilarRequests([]);
    setShowSimilarPrompt(false);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const searchSimilarRequests = async (term) => {
    const normalized = term.toLowerCase();
    const tokens = normalized
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/gi, ''))
      .filter((token) => token.length >= 3);

    let query = supabase
      .from('requests')
      .select('id, item_name, likes, created_at, image_url')
      .order('likes', { ascending: false })
      .limit(5);

    if (tokens.length > 0) {
      const uniqueTokens = [...new Set(tokens)].slice(0, 4);
      const orFilters = uniqueTokens
        .map((token) => `item_name.ilike.%${token}%`)
        .join(',');
      query = query.or(orFilters);
    } else {
      query = query.ilike('item_name', `%${normalized}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  };

  const createNewRequest = async (nameToCreate) => {
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
        .insert([{ item_name: nameToCreate, image_url: uploadedImageUrl }]);

      if (error) {
        throw error;
      }

      toast.success('Thanks! Your rental wish has been saved.');
      resetFormState();
    } catch (error) {
      toast.error(error.message || 'Unable to save your request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = itemName.trim();

    if (!trimmedName) {
      toast.error('Please describe the item you want to rent.');
      return;
    }

    setPendingRequestName(trimmedName);

    try {
      setCheckingSimilar(true);
      const matches = await searchSimilarRequests(trimmedName);

      if (matches.length > 0) {
        setSimilarRequests(matches);
        setShowSimilarPrompt(true);
        toast.info(
          'Looks like similar requests already exist. Support one or continue below.'
        );
        return;
      }

      await createNewRequest(trimmedName);
    } catch (error) {
      toast.error(
        error.message || 'Unable to check for similar requests right now.'
      );
    } finally {
      setCheckingSimilar(false);
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

  const handleProceedWithNewRequest = async () => {
    const fallbackName = pendingRequestName || itemName.trim();

    if (!fallbackName) {
      toast.error('Please describe the item you want to rent.');
      return;
    }

    await createNewRequest(fallbackName);
  };

  const handleAdoptExisting = async (request) => {
    if (!userId) {
      toast.info('Please sign in so we can track your likes.');
      navigate('/login');
      return;
    }

    try {
      setLikingExisting((prev) => ({ ...prev, [request.id]: true }));

      const { error: likeError } = await supabase
        .from('request_likes')
        .insert([{ request_id: request.id, user_id: userId }]);

      if (likeError && likeError.code !== '23505') {
        throw likeError;
      }

      if (!likeError) {
        const { error: updateError } = await supabase
          .from('requests')
          .update({ likes: (request.likes ?? 0) + 1 })
          .eq('id', request.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        toast.info('You have already liked this request.');
      }

      toast.success('Thanks! We added your support to the existing request.');
      resetFormState();
    } catch (error) {
      toast.error(error.message || 'Unable to register your like.');
    } finally {
      setLikingExisting((prev) => ({ ...prev, [request.id]: false }));
    }
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
            disabled={isFormDisabled}
            required
          />
          <button
            type="submit"
            disabled={isFormDisabled}
            className="bg-black text-white text-xs font-semibold px-8 py-3 rounded-full min-w-[150px] disabled:bg-gray-400"
          >
            {checkingSimilar
              ? 'Checking...'
              : submitting
                ? 'Submitting...'
                : 'SUBMIT'}
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
            disabled={isFormDisabled}
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

      {showSimilarPrompt && similarRequests.length > 0 && (
        <div className="w-full sm:w-3/4 lg:w-2/3 flex flex-col gap-4 mx-auto my-6 border border-amber-300 bg-amber-50/80 rounded-3xl p-5 text-left">
          <div>
            <p className="text-base font-semibold text-gray-900">
              We found similar requests
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Support an existing request below or continue to create a new one.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {similarRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-amber-200 bg-white rounded-2xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {request.image_url && (
                    <img
                      src={request.image_url}
                      alt={request.item_name}
                      className="w-16 h-16 object-cover rounded-xl border"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {request.item_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.likes ?? 0} likes · Added{' '}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdoptExisting(request)}
                  disabled={Boolean(likingExisting[request.id])}
                  className="text-xs font-semibold px-4 py-2 rounded-full bg-black text-white disabled:bg-gray-400"
                >
                  {likingExisting[request.id]
                    ? 'Saving...'
                    : 'Yes, this is what I want'}
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-600">
              Want something else? Update the text above or continue anyway.
            </p>
            <button
              type="button"
              onClick={handleProceedWithNewRequest}
              disabled={submitting}
              className="text-xs font-semibold px-5 py-2 rounded-full border border-gray-300 text-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'No, create new request'}
            </button>
          </div>
        </div>
      )}

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