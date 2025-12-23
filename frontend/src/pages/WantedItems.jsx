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

const ThumbIcon = ({ active }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-4 h-4 transition-colors ${
      active ? 'text-white' : 'text-gray-500'
    }`}
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      d="M2 10.25A1.25 1.25 0 0 1 3.25 9h2.5A1.25 1.25 0 0 1 7 10.25v8.5A1.25 1.25 0 0 1 5.75 20h-2.5A1.25 1.25 0 0 1 2 18.75z"
    />
    <path
      fill="currentColor"
      d="M9.5 10.5 11 4.83A2 2 0 0 1 12.92 3h.58A2 2 0 0 1 15 5v4h4.36a1.5 1.5 0 0 1 1.39 2.06l-2.12 6a3 3 0 0 1-2.82 2H9.75A1.75 1.75 0 0 1 8 17.25v-5.5a1.75 1.75 0 0 1 1.5-1.72Z"
    />
  </svg>
);

const WantedItems = () => {
  const { userId, navigate } = useContext(ShopContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState({});
  const [sortBy, setSortBy] = useState('likes');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [likedIds, setLikedIds] = useState(new Set());
  const [optimisticLikes, setOptimisticLikes] = useState({});

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
        setOptimisticLikes({});

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

    const alreadyLiked = likedIds.has(requestId);

    try {
      setLiking((prev) => ({ ...prev, [requestId]: true }));

      if (!alreadyLiked) {
        const { error: likeError } = await supabase
          .from('request_likes')
          .insert([{ request_id: requestId, user_id: userId }]);

        if (likeError && likeError.code !== '23505') {
          throw likeError;
        }

        if (likeError && likeError.code === '23505') {
          toast.info('You have already liked this request.');
          setLikedIds((prev) => new Set(prev).add(requestId));
        } else {
          const { error: updateError } = await supabase
            .from('requests')
            .update({ likes: (currentLikes ?? 0) + 1 })
            .eq('id', requestId);

          if (updateError) {
            throw updateError;
          }

          toast.success('Thanks for supporting this request!');
          setLikedIds((prev) => {
            const next = new Set(prev);
            next.add(requestId);
            return next;
          });
          setOptimisticLikes((prev) => ({
            ...prev,
            [requestId]:
              (prev[requestId] ?? (currentLikes ?? 0)) + 1,
          }));
        }
      } else {
        const { error: deleteError } = await supabase
          .from('request_likes')
          .delete()
          .eq('request_id', requestId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        const nextLikes = Math.max((currentLikes ?? 1) - 1, 0);
        const { error: updateError } = await supabase
          .from('requests')
          .update({ likes: nextLikes })
          .eq('id', requestId);

        if (updateError) {
          throw updateError;
        }

        toast.info('Removed your like.');
        setLikedIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
        setOptimisticLikes((prev) => ({
          ...prev,
          [requestId]: Math.max(
            (prev[requestId] ?? (currentLikes ?? 1)) - 1,
            0
          ),
        }));
      }
      await fetchRequests({ silent: true });
    } catch (error) {
      toast.error(
        error.message ||
          (alreadyLiked
            ? 'Unable to remove your like.'
            : 'Unable to register your like.')
      );
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
          {requests.map((request) => {
            const isLiked = likedIds.has(request.id);
            const isSaving = Boolean(liking[request.id]);
            const displayLikes = Math.max(
              0,
              optimisticLikes[request.id] ?? request.likes ?? 0
            );

            return (
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
                <div className="flex items-center">
                  <button
                    onClick={() => handleLike(request.id, displayLikes)}
                    disabled={isSaving}
                    className={`flex items-center gap-3 text-xs font-semibold px-4 py-2 rounded-full border transition-colors disabled:cursor-not-allowed ${
                      isLiked
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 disabled:bg-gray-200 disabled:text-gray-400'
                    }`}
                  >
                    <span className="text-base font-bold">{displayLikes}</span>
                    <ThumbIcon active={isLiked} />
                    <span className="text-[11px] uppercase tracking-wide">
                      {isLiked
                        ? 'Liked'
                        : isSaving
                          ? 'Saving...'
                          : '+1 Like'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WantedItems;