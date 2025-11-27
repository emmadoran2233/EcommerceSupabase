import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../supabaseClient';
import { ShopContext } from '../context/ShopContext';

const WantedItems = () => {
  const { userId, navigate } = useContext(ShopContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState({});
  const [sortBy, setSortBy] = useState('likes');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [likedIds, setLikedIds] = useState(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchRequests = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        let query = supabase
          .from('requests')
          .select('id, item_name, likes, created_at, image_url');

        if (debouncedSearch) {
          query = query.ilike('item_name', `%${debouncedSearch}%`);
        }

        if (sortBy === 'likes') {
          query = query
            .order('likes', { ascending: false })
            .order('created_at', { ascending: true });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        setRequests(data ?? []);

        if (userId) {
          const { data: likedData, error: likedError } = await supabase
            .from('request_likes')
            .select('request_id')
            .eq('user_id', userId);

          if (likedError) {
            throw likedError;
          }

          setLikedIds(new Set(likedData?.map((row) => row.request_id) || []));
        } else {
          setLikedIds(new Set());
        }
      } catch (error) {
        toast.error(error.message || 'Unable to load rental wishes.');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [debouncedSearch, sortBy, userId]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleLike = async (requestId, currentLikes) => {
    if (!userId) {
      toast.info('Please sign in so we can track your likes.');
      navigate('/login');
      return;
    }

    if (likedIds.has(requestId)) {
      toast.info('You have already liked this request.');
      return;
    }

    try {
      setLiking((prev) => ({ ...prev, [requestId]: true }));

      const { error: likeError } = await supabase
        .from('request_likes')
        .insert([{ request_id: requestId, user_id: userId }]);

      if (likeError && likeError.code !== '23505') {
        throw likeError;
      }

      if (likeError && likeError.code === '23505') {
        toast.info('You have already liked this request.');
        setLikedIds((prev) => new Set(prev).add(requestId));
        return;
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update({ likes: (currentLikes ?? 0) + 1 })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      toast.success('Thanks for supporting this request!');
      await fetchRequests({ silent: true });
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.add(requestId);
        return next;
      });
    } catch (error) {
      toast.error(error.message || 'Unable to register your like.');
    } finally {
      setLiking((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const filtersDescription = useMemo(() => {
    const parts = [];
    parts.push(sortBy === 'likes' ? 'sorted by likes' : 'sorted by newest');
    if (debouncedSearch) {
      parts.push(`matching "${debouncedSearch}"`);
    }
    return parts.join(', ');
  }, [debouncedSearch, sortBy]);

  return (
    <div className="my-12">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-3xl font-semibold text-gray-900">
          Most Wanted Rental Items
        </p>
        <p className="text-gray-600 mt-3">
          These are the community&apos;s most requested items. Add a +1 to let us
          know what we should source next.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by keyword"
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-700"
            >
              <option value="likes">Sort: Likes (high → low)</option>
              <option value="newest">Sort: Newest first</option>
            </select>
          </div>
          {filtersDescription && (
            <p className="text-xs text-gray-500">{filtersDescription}</p>
          )}
        </div>
        <button
          onClick={() => fetchRequests()}
          className="mt-6 text-sm font-medium text-gray-900 border border-gray-300 rounded-full px-6 py-2 hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh list'}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading rentals...</p>
      ) : requests.length === 0 ? (
        <p className="text-center text-gray-500">
          No requests yet. Be the first to submit a rental wish on the home page.
        </p>
      ) : (
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border rounded-xl px-5 py-4 bg-white shadow-sm"
            >
              <div className="flex items-center gap-4">
                {request.image_url && (
                  <img
                    src={request.image_url}
                    alt={request.item_name}
                    className="w-20 h-20 object-cover rounded-lg border"
                  />
                )}
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {request.item_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Added {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700">
                  {request.likes ?? 0} likes
                </p>
                <button
                  onClick={() => handleLike(request.id, request.likes ?? 0)}
                  disabled={
                    Boolean(liking[request.id]) || likedIds.has(request.id)
                  }
                  className={`text-xs font-semibold px-4 py-2 rounded-full ${
                    likedIds.has(request.id)
                      ? 'bg-red-500 text-white cursor-not-allowed'
                      : 'bg-black text-white disabled:bg-gray-400'
                  }`}
                >
                  {likedIds.has(request.id)
                    ? 'Liked'
                    : liking[request.id]
                      ? 'Saving...'
                      : '+1 LIKE'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WantedItems;
