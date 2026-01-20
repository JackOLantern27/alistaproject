import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, ScrollView, StyleSheet, Alert, TouchableOpacity, RefreshControl, BackHandler, Image } from 'react-native';
import { useIsFocused, useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { getSeriesDetails, getRecommendations, getDiscoverTV, searchMulti, getDiscoverWithProviders, getMovieCredits, getTVCredits, discoverByPerson, getMovieDetails, discoverAnimatedByGenre, getWatchProviders, TMDB_BACKDROP_BASE_URL } from '../../services/tmdb';
import { SeriesCard } from '../../components/SeriesCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RatingModal } from '../../components/RatingModal';
import { RecommendationCard } from '../../components/RecommendationCard';
import { SearchResultCard } from '../../components/SearchResultCard';
import { EditProgressModal } from '../../components/EditProgressModal';
import { SettingsModal } from '../../components/SettingsModal';
import { useAuth } from '../../contexts/AuthContext';
import { homeCache, watchlistCache, historyCache, seriesCache, CACHE_TTL, invalidateAllCaches } from '../../lib/dataCache';
import { addToWatchlist } from '../../services/libraryService';

export const HomeScreen = () => {
    const { session } = useAuth();
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();

    const [activeSeries, setActiveSeries] = useState<any[]>(homeCache.activeSeries || []);
    const [recommendations, setRecommendations] = useState<any[]>(homeCache.recommendations || []);
    const [directorRecs, setDirectorRecs] = useState<any[]>(homeCache.directorRecs || []);
    const [actorRecs, setActorRecs] = useState<any[]>(homeCache.actorRecs || []);
    const [animatedRecs, setAnimatedRecs] = useState<any[]>(homeCache.animatedRecs || []);
    const [movieRecs, setMovieRecs] = useState<any[]>(homeCache.movieRecs || []);
    const [watchlistSuggestions, setWatchlistSuggestions] = useState<any[]>(homeCache.watchlistSuggestions || []);
    const [dailyMovie, setDailyMovie] = useState<any | null>(homeCache.dailyMovie || null);
    const [topDirector, setTopDirector] = useState<string>(homeCache.topDirector || '');
    const [topActor, setTopActor] = useState<string>(homeCache.topActor || '');
    const [topAnimatedGenres, setTopAnimatedGenres] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [libraryDataMap, setLibraryDataMap] = useState<Record<string, any>>({});

    const searchTermRef = useRef('');
    useEffect(() => {
        searchTermRef.current = searchTerm;
    }, [searchTerm]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (searchTermRef.current.length > 0) {
                    setSearchTerm('');
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => {
                subscription.remove();
                setSearchTerm(''); // Clear when leaving the tab
            };
        }, [])
    );
    const [loadingSeries, setLoadingSeries] = useState<boolean>(true);
    const [loadingRecs, setLoadingRecs] = useState<boolean>(true);
    const [loadingPersonalized, setLoadingPersonalized] = useState<boolean>(true);
    const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Rating State
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [finishingSeriesId, setFinishingSeriesId] = useState<number | null>(null);
    const [finishedSeriesTitle, setFinishedSeriesTitle] = useState('');

    // Edit State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingSeries, setEditingSeries] = useState<any>(null);

    // Settings State
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [userProviders, setUserProviders] = useState<string[]>([]);
    const [userFilters, setUserFilters] = useState<any>({});
    const [refreshing, setRefreshing] = useState(false);

    const getFilterParams = (filters: any) => {
        const params: any = {};

        if (filters.maxCertification) {
            params.certification_country = 'BR';
            params.certification = filters.maxCertification;
        }

        if (filters.minRating) {
            params['vote_average.gte'] = filters.minRating.toString();
        }

        if (filters.releaseStatus === 'released') {
            params['release_date.lte'] = new Date().toISOString().split('T')[0];
        } else if (filters.releaseStatus === 'upcoming') {
            params['release_date.gte'] = new Date().toISOString().split('T')[0];
        }

        return params;
    };

    const enrichWithAvailability = async (items: any[]) => {
        return Promise.all(items.map(async (item) => {
            try {
                const providers = await getWatchProviders(item.media_type, item.tmdb_id);
                const br = providers?.results?.BR;

                let availability: 'streaming' | 'theater' | 'none' = 'none';
                let colors: string[] = [];

                if (br?.flatrate) {
                    availability = 'streaming';
                    const uniqueColors = new Set<string>();
                    br.flatrate.forEach((p: any) => {
                        const name = p.provider_name.toLowerCase();
                        if (name.includes('netflix')) uniqueColors.add('#E50914');
                        else if (name.includes('disney')) uniqueColors.add('#006E99');
                        else if (name.includes('max') || name.includes('hbo')) uniqueColors.add('#0000FF');
                        else if (name.includes('prime')) uniqueColors.add('#00A8E1');
                        else if (name.includes('apple')) uniqueColors.add('#ffffff');
                        else if (name.includes('globoplay')) uniqueColors.add('#FB0D1C');
                        else uniqueColors.add('#4CAF50');
                    });
                    colors = Array.from(uniqueColors).slice(0, 3);
                } else if (!br?.buy && !br?.rent) {
                    if (item.media_type === 'movie' && item.release_date) {
                        const releaseDate = new Date(item.release_date);
                        const now = new Date();
                        const diffDays = (now.getTime() - releaseDate.getTime()) / (1000 * 3600 * 24);
                        if (diffDays >= -7 && diffDays < 90) {
                            availability = 'theater';
                        }
                    }
                }

                return { ...item, availability, providerColors: colors };
            } catch (e) {
                return { ...item, availability: 'none' };
            }
        }));
    };

    // Search Debounce Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length >= 3) {
                setLoadingSearch(true);
                try {
                    const data = await searchMulti(searchTerm.trim());
                    const filtered = data?.results?.filter((r: any) => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv')) || [];
                    setSearchResults(filtered);

                    // Fetch full library data for these results
                    if (session?.user && filtered.length > 0) {
                        const { data: libData } = await supabase
                            .from('user_library')
                            .select('*, media:media_id(tmdb_id, media_type)')
                            .eq('user_id', session.user.id);

                        const map: Record<string, any> = {};
                        libData?.forEach((item: any) => {
                            if (item.media) {
                                map[`${item.media.tmdb_id}_${item.media.media_type}`] = item;
                            }
                        });
                        setLibraryDataMap(map);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingSearch(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // ... (fetchActiveSeries) ...

    const handleEditPress = (item: any) => {
        setEditingSeries(item);
        setEditModalVisible(true);
    };

    const handleSaveProgress = async (newCount: number) => {
        if (!editingSeries) return;

        // Optimistic
        setActiveSeries(prev => prev.map(item =>
            item.id === editingSeries.id ? { ...item, last_episode_seen: newCount } : item
        ));

        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    last_episode_seen: newCount,
                    // Auto-fix status if necessary could go here, but kept simple
                    last_watched_at: new Date().toISOString()
                })
                .eq('id', editingSeries.id);

            if (error) throw error;
            // Global Sync
            invalidateAllCaches();

            if (newCount >= (editingSeries.total_episodes || 0)) {
                setFinishingSeriesId(editingSeries.id);
                setFinishedSeriesTitle(editingSeries.media.title);
                setRatingModalVisible(true);
                setEditModalVisible(false); // Close edit modal
            } else {
                fetchActiveSeries(false);
            }

        } catch (error) {
            Alert.alert('Erro', 'Falha ao atualizar progresso.');
            fetchActiveSeries(false);
        }
    };


    const fetchActiveSeries = async (showLoading = true) => {
        if (showLoading) setLoadingSeries(true);
        try {
            if (!session?.user) return;

            // Exact logic from SeriesScreen prompt
            const { data: libraryData, error } = await supabase
                .from('user_library')
                .select(`*, media:media_id (*)`)
                .eq('user_id', session.user.id)
                .in('status', ['watching', 'awaiting_episodes', 'watchlist'])
                .order('last_watched_at', { ascending: false });

            if (error) throw error;

            const tvItems = libraryData?.filter((item: any) => item.media?.media_type === 'tv') || [];
            const enrichedItems: any[] = [];

            await Promise.all(tvItems.map(async (item) => {
                const details = await getSeriesDetails(item.media.tmdb_id);
                if (details) {
                    const actualTotal = details.number_of_episodes;
                    // FIX: Spread details FIRST, then item
                    let newItem = { ...details, ...item };

                    if (item.total_episodes !== actualTotal) {
                        await supabase.from('user_library').update({ total_episodes: actualTotal }).eq('id', item.id);
                        newItem.total_episodes = actualTotal;
                    }

                    let newStatus = 'active';
                    const isUpToDate = item.last_episode_seen >= actualTotal;
                    const isEnded = details.status === 'Ended' || details.status === 'Canceled';

                    if (isUpToDate && !isEnded) {
                        newStatus = 'waiting';
                    } else {
                        newStatus = 'active';
                    }

                    enrichedItems.push({ ...newItem, computedStatus: newStatus });
                }
            }));

            const active = enrichedItems
                .filter(i => {
                    // Refined criteria: at least 1 seen, at least 1 remaining
                    return i.last_episode_seen >= 1 && i.last_episode_seen < i.total_episodes;
                })
                .sort((a, b) => new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime());

            setActiveSeries(active);
            homeCache.activeSeries = active;

            // If empty, fetch watchlist suggestions
            if (active.length === 0) {
                await fetchWatchlistSuggestions();
            } else {
                setWatchlistSuggestions([]);
                homeCache.watchlistSuggestions = [];
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (showLoading) setLoadingSeries(false);
        }
    };

    const fetchWatchlistSuggestions = async () => {
        try {
            if (!session?.user) return;

            // Fetch oldest 2 series from watchlist
            const { data, error } = await supabase
                .from('user_library')
                .select(`*, media:media_id (*)`)
                .eq('user_id', session.user.id)
                .eq('status', 'watchlist')
                .eq('media.media_type', 'tv' as any) // Explicit cast if needed
                .order('created_at', { ascending: true })
                .limit(2);

            if (error) throw error;

            const filtered = (data || []).filter(i => i.media?.media_type === 'tv');

            const enriched = await Promise.all(filtered.map(async (item) => {
                const details = await getSeriesDetails(item.media.tmdb_id);
                return { ...details, ...item };
            }));

            setWatchlistSuggestions(enriched);
            homeCache.watchlistSuggestions = enriched;
        } catch (e) {
            console.error('Error fetching watchlist suggestions:', e);
        }
    };

    const fetchRecommendationsLogic = async (providersOverwrite?: string[], filtersOverwrite?: any) => {
        // Removed internal setLoadingRecs(true) to handle sequence better if called from master
        try {
            if (!session?.user) return;

            let recommendedItems: any[] = [];
            const providers = providersOverwrite || userProviders;
            const filters = filtersOverwrite || userFilters;
            const filterParams = getFilterParams(filters);

            // Hide providers filter if TeuspuloFlix is active
            const providerString = filters.teuspuloFlix ? '' : (providers?.length > 0 ? providers.join('|') : '');

            if (providerString) {
                const data = await getDiscoverWithProviders('tv', providerString, filterParams);
                if (data?.results) {
                    recommendedItems = data.results.map((rec: any) => ({
                        tmdb_id: rec.id,
                        title: rec.name || rec.title,
                        poster_url: rec.poster_path,
                        media_type: 'tv',
                        release_date: rec.first_air_date || rec.release_date
                    }));
                }
            } else if (filters.teuspuloFlix) {
                // If TeuspuloFlix active but no providers string (or empty), fetch generic discover with filters
                const data = await getDiscoverWithProviders('tv', '', filterParams);
                if (data?.results) {
                    recommendedItems = data.results.map((rec: any) => ({
                        tmdb_id: rec.id,
                        title: rec.name || rec.title,
                        poster_url: rec.poster_path,
                        media_type: 'tv',
                        release_date: rec.first_air_date || rec.release_date
                    }));
                }
            }

            // Fallback / Mix if no providers or few results
            if (recommendedItems.length < 5) {
                const { data: library, error } = await supabase
                    .from('user_library')
                    .select('media:media_id (tmdb_id)')
                    .eq('user_id', session.user.id);

                if (!error && library) {
                    const tmdbIds = library.map((l: any) => l.media?.tmdb_id).filter(Boolean);
                    const sampleIds = tmdbIds.sort(() => 0.5 - Math.random()).slice(0, 3);

                    for (const id of sampleIds) {
                        const data = await getRecommendations('tv', id);
                        data?.results?.forEach((rec: any) => {
                            if (rec.poster_path) {
                                recommendedItems.push({
                                    tmdb_id: rec.id,
                                    title: rec.name || rec.title,
                                    poster_url: rec.poster_path,
                                    media_type: 'tv',
                                    release_date: rec.first_air_date || rec.release_date
                                });
                            }
                        });
                    }
                }
            }

            // 3. Get ALL library items to filter from recommendations
            const { data: allLibrary } = await supabase
                .from('user_library')
                .select('media:media_id(tmdb_id)')
                .eq('user_id', session.user.id);

            const libraryTmdbIds = new Set(
                allLibrary?.map((item: any) => item.media?.tmdb_id).filter(Boolean) || []
            );

            // Deduplicate and filter out seen stuff
            const uniqueMap = new Map();
            recommendedItems.forEach(item => {
                if (!uniqueMap.has(item.tmdb_id) && !libraryTmdbIds.has(item.tmdb_id)) {
                    uniqueMap.set(item.tmdb_id, item);
                }
            });

            const finalRecs = await enrichWithAvailability(Array.from(uniqueMap.values()).slice(0, 15));
            setRecommendations(finalRecs);
            homeCache.recommendations = finalRecs;
            homeCache.lastFetched = Date.now();

        } catch (e) {
            console.error(e);
        } finally {
            // Internal set loading to false is okay for individual triggers
            setLoadingRecs(false);
        }
    };

    const fetchPersonalizedRecommendations = async (filtersOverwrite?: any) => {
        // Removed internal setLoadingPersonalized(true)
        try {
            if (!session?.user) return;

            const filters = filtersOverwrite || userFilters;
            const filterParams = getFilterParams(filters);

            // Fetch user's watched items with ratings
            const { data: watchedItems, error } = await supabase
                .from('user_library')
                .select('*, media:media_id (*)')
                .eq('user_id', session.user.id)
                .eq('status', 'watched')
                .order('watched_at', { ascending: false })
                .limit(20); // Analyze last 20 watched items

            if (error || !watchedItems || watchedItems.length === 0) {
                setLoadingPersonalized(false);
                return;
            }

            // Count directors, actors, and genres with rating weights
            const directorCount: Record<string, { name: string; id: number; count: number }> = {};
            const actorCount: Record<string, { name: string; id: number; count: number }> = {};
            const genreCount: Record<number, number> = {};
            const movieGenreCount: Record<number, number> = {};

            // Fetch credits for each watched item
            for (const item of watchedItems.slice(0, 15)) { // Limit API calls
                try {
                    const mediaType = item.media.media_type;
                    const tmdbId = item.media.tmdb_id;

                    // Calculate weight based on rating (higher rating = more influence)
                    const weight = item.rating
                        ? (item.rating >= 4 ? 2 : (item.rating >= 3 ? 1 : 0.5))
                        : 1; // Default weight if no rating

                    let credits;
                    let details;
                    if (mediaType === 'movie') {
                        credits = await getMovieCredits(tmdbId);
                        details = await getMovieDetails(tmdbId);
                    } else if (mediaType === 'tv') {
                        credits = await getTVCredits(tmdbId);
                        details = await getSeriesDetails(tmdbId);
                    }

                    // Check if it's animated (genre ID 16 is Animation)
                    const isAnimated = details?.genres?.some((g: any) => g.id === 16) || false;

                    // Track genres for animated content
                    if (isAnimated) {
                        details.genres?.forEach((genre: any) => {
                            if (genre.id !== 16) { // Don't count Animation genre itself
                                genreCount[genre.id] = (genreCount[genre.id] || 0) + weight;
                            }
                        });
                    }

                    // Track genres for movie recommendations
                    if (mediaType === 'movie') {
                        details.genres?.forEach((genre: any) => {
                            movieGenreCount[genre.id] = (movieGenreCount[genre.id] || 0) + weight;
                        });
                    }

                    if (credits) {
                        // Count directors (all content) with rating weight
                        const directors = credits.crew?.filter((c: any) => c.job === 'Director') || [];
                        directors.forEach((dir: any) => {
                            const key = dir.id.toString();
                            if (!directorCount[key]) {
                                directorCount[key] = { name: dir.name, id: dir.id, count: 0 };
                            }
                            directorCount[key].count += weight;
                        });

                        // Only count actors for non-animated content (live-action only)
                        if (!isAnimated) {
                            const actors = credits.cast?.slice(0, 5) || []; // Top 5 actors
                            actors.forEach((actor: any) => {
                                const key = actor.id.toString();
                                if (!actorCount[key]) {
                                    actorCount[key] = { name: actor.name, id: actor.id, count: 0 };
                                }
                                actorCount[key].count += weight;
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error fetching credits:', e);
                }
            }

            // Get ALL library items to filter from recommendations (not just watched)
            const { data: allLibrary } = await supabase
                .from('user_library')
                .select('media:media_id(tmdb_id)')
                .eq('user_id', session.user.id);

            const libraryTmdbIds = new Set(
                allLibrary?.map((item: any) => item.media?.tmdb_id).filter(Boolean) || []
            );

            // Find top director and actor
            const topDir = Object.values(directorCount).sort((a, b) => b.count - a.count)[0];
            const topAct = Object.values(actorCount).sort((a, b) => b.count - a.count)[0];

            // Fetch recommendations based on top director
            if (topDir && topDir.count >= 1.5) { // Lower threshold since ratings can add fractional counts
                setTopDirector(topDir.name);
                const dirData = await discoverByPerson(topDir.id, 'movie', filterParams);
                if (dirData?.results) {
                    const mapped = dirData.results
                        .filter((m: any) => m.poster_path && !libraryTmdbIds.has(m.id))
                        .slice(0, 10)
                        .map((m: any) => ({
                            tmdb_id: m.id,
                            title: m.title,
                            poster_url: m.poster_path,
                            media_type: 'movie',
                            release_date: m.release_date
                        }));
                    const enriched = await enrichWithAvailability(mapped);
                    setDirectorRecs(enriched);
                    homeCache.directorRecs = enriched;
                    homeCache.topDirector = topDir.name;
                }
            }

            // Fetch recommendations based on top actor (live-action only)
            if (topAct && topAct.count >= 1.5) {
                setTopActor(topAct.name);
                const actData = await discoverByPerson(topAct.id, 'movie', filterParams);
                if (actData?.results) {
                    const mapped = actData.results
                        .filter((m: any) => m.poster_path && !libraryTmdbIds.has(m.id))
                        .slice(0, 10)
                        .map((m: any) => ({
                            tmdb_id: m.id,
                            title: m.title,
                            poster_url: m.poster_path,
                            media_type: 'movie',
                            release_date: m.release_date
                        }));
                    const enriched = await enrichWithAvailability(mapped);
                    setActorRecs(enriched);
                    homeCache.actorRecs = enriched;
                    homeCache.topActor = topAct.name;
                }
            }

            // Fetch animated content recommendations based on favorite genres
            const sortedGenres = Object.entries(genreCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3); // Top 3 genres

            if (sortedGenres.length > 0) {
                const genreIds = sortedGenres.map(([id]) => id).join(',');
                setTopAnimatedGenres(genreIds); // Store for display purposes

                try {
                    const animatedData = await discoverAnimatedByGenre('tv', genreIds, filterParams);
                    if (animatedData?.results) {
                        const mapped = animatedData.results
                            .filter((item: any) => item.poster_path && !libraryTmdbIds.has(item.id))
                            .slice(0, 10)
                            .map((item: any) => ({
                                tmdb_id: item.id,
                                title: item.name || item.title,
                                poster_url: item.poster_path,
                                media_type: 'tv',
                                release_date: item.first_air_date || item.release_date
                            }));
                        const enriched = await enrichWithAvailability(mapped);
                        setAnimatedRecs(enriched);
                        homeCache.animatedRecs = enriched;
                    }
                } catch (e) {
                    console.error('Error fetching animated recommendations:', e);
                }
            }

            // Fetch Movie Recommendations based on favorite genres
            const sortedMovieGenres = Object.entries(movieGenreCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3);

            if (sortedMovieGenres.length > 0) {
                const genreIds = sortedMovieGenres.map(([id]) => id).join(',');
                try {
                    const movieData = await getDiscoverWithProviders('movie', '', {
                        ...filterParams,
                        with_genres: genreIds
                    });
                    if (movieData?.results) {
                        const mapped = movieData.results
                            .filter((item: any) => item.poster_path && !libraryTmdbIds.has(item.id))
                            .slice(0, 10)
                            .map((m: any) => ({
                                tmdb_id: m.id,
                                title: m.title,
                                poster_url: m.poster_path,
                                media_type: 'movie',
                                release_date: m.release_date
                            }));
                        const enriched = await enrichWithAvailability(mapped);
                        setMovieRecs(enriched);
                        homeCache.movieRecs = enriched;

                        // Pick Daily Movie
                        if (enriched.length > 0) {
                            const topMovie = enriched[0];
                            try {
                                const details = await getMovieDetails(topMovie.tmdb_id, 'release_dates');
                                if (details) {
                                    // Extract BR certification
                                    const brRating = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'BR')
                                        ?.release_dates?.find((rd: any) => rd.certification)?.certification || 'L';

                                    const dayMovie = {
                                        ...topMovie,
                                        backdrop_url: details.backdrop_path,
                                        overview: details.overview,
                                        genres: details.genres?.map((g: any) => g.name).slice(0, 2) || [],
                                        certification: brRating,
                                        runtime: details.runtime
                                    };
                                    setDailyMovie(dayMovie);
                                    homeCache.dailyMovie = dayMovie;
                                }
                            } catch (e) {
                                console.error('Error fetching daily movie details:', e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching movie recommendations:', e);
                }
            }

        } catch (e) {
            console.error('Error fetching personalized recommendations:', e);
        } finally {
            setLoadingPersonalized(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            const now = Date.now();
            const isFresh = (now - homeCache.lastFetched) < CACHE_TTL;

            if (homeCache.activeSeries?.length > 0 && isFresh) {
                // Use cache
                setActiveSeries(homeCache.activeSeries);
                setRecommendations(homeCache.recommendations);
                setDirectorRecs(homeCache.directorRecs);
                setActorRecs(homeCache.actorRecs);
                setAnimatedRecs(homeCache.animatedRecs);
                setMovieRecs(homeCache.movieRecs || []);
                setWatchlistSuggestions(homeCache.watchlistSuggestions || []);
                setDailyMovie(homeCache.dailyMovie || null);
                setTopDirector(homeCache.topDirector);
                setTopActor(homeCache.topActor);

                setLoadingSeries(false);
                setLoadingRecs(false);
                setLoadingPersonalized(false);
                setInitialLoaded(true);
            }

            import('@react-native-async-storage/async-storage').then(module => {
                const storage = module.default;
                Promise.all([
                    storage.getItem('user_providers'),
                    storage.getItem('user_filters')
                ]).then(async ([p, f]) => {
                    const providers = p ? JSON.parse(p) : [];
                    const filters = f ? JSON.parse(f) : {};
                    setUserProviders(providers);
                    setUserFilters(filters);

                    setLoadingRecs(true);
                    await fetchRecommendationsLogic(providers, filters);
                    setLoadingPersonalized(true);
                    await fetchPersonalizedRecommendations(filters);

                    // ALWAYS fetch active series to keep it dynamic as requested
                    await fetchActiveSeries(homeCache.activeSeries.length === 0);
                    setInitialLoaded(true);
                });
            });
        }
    }, [isFocused]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // SEQUENTIAL REFRESH
        await fetchActiveSeries(false);
        setLoadingRecs(true);
        await fetchRecommendationsLogic(userProviders, userFilters);
        setLoadingPersonalized(true);
        await fetchPersonalizedRecommendations(userFilters);
        homeCache.lastFetched = Date.now();
        setRefreshing(false);
    }, [userProviders, userFilters]);

    const renderRecSection = (title: string, data: any[], loading: boolean) => {
        if (!loading && data.length === 0) return null;
        return (
            <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {loading && data.length === 0 ? (
                    <View style={styles.loaderPlaceholder}>
                        <ActivityIndicator color="#E50914" />
                    </View>
                ) : (
                    <FlatList
                        horizontal
                        data={data}
                        keyExtractor={(item) => String(item.tmdb_id)}
                        renderItem={({ item }) => <RecommendationCard item={item} onPress={openDetails} />}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScroll}
                    />
                )}
            </View>
        );
    };

    const handleFiltersUpdate = async (fullFilters: any) => {
        const { providers, ...filters } = fullFilters;
        setUserProviders(providers);
        setUserFilters(filters);

        // Sequential update
        await fetchRecommendationsLogic(providers, filters);
        setLoadingPersonalized(true);
        await fetchPersonalizedRecommendations(filters);
    };

    const openDetails = (item: any) => {
        navigation.navigate('GenericModal', {
            mediaId: item.id || item.tmdb_id,
            mediaType: item.media_type || 'tv' // Default to TV if undefined, or handle better
        });
    };

    const getSeasonAndEpisode = (totalSeen: number, seasons: any[]) => {
        let accumulated = 0;
        const validSeasons = seasons?.filter(s => s.season_number > 0) || [];

        for (const season of validSeasons) {
            if (totalSeen < accumulated + season.episode_count) {
                return {
                    season: season.season_number,
                    episode: totalSeen - accumulated + 1
                };
            }
            accumulated += season.episode_count;
        }
        return { season: 1, episode: totalSeen + 1 };
    };

    const addEpisode = async (id: number, currentSeen: number, total: number, title: string) => {
        if (currentSeen < total) {
            const nextEp = currentSeen + 1;
            const now = new Date().toISOString();

            // Optimistic
            setActiveSeries(prev => prev.map(item =>
                item.id === id ? { ...item, last_episode_seen: nextEp, last_watched_at: now } : item
            ));

            try {
                await supabase
                    .from('user_library')
                    .update({ last_episode_seen: nextEp, last_watched_at: now, status: 'watching' })
                    .eq('id', id);

                if (nextEp >= total) {
                    setFinishingSeriesId(id);
                    setFinishedSeriesTitle(title);
                    setRatingModalVisible(true);
                }

                invalidateAllCaches();
            } catch (e) {
                Alert.alert('Erro', 'Falha ao atualizar.');
                fetchActiveSeries(false);
            }
        }
    };

    const handleRatingSubmit = async (rating: number, comment: string) => {
        if (!finishingSeriesId) return;
        try {
            await supabase.from('user_library').update({
                status: 'watched',
                rating,
                review_text: comment,
                watched_at: new Date().toISOString()
            }).eq('id', finishingSeriesId);

            // Invalidate All Caches
            invalidateAllCaches();

            setActiveSeries(prev => prev.filter(i => i.id !== finishingSeriesId));

            // Update search map if exists
            const itemInSearch = Object.values(libraryDataMap).find(i => i.id === finishingSeriesId);
            if (itemInSearch) {
                setLibraryDataMap(prev => ({
                    ...prev,
                    [`${itemInSearch.media.tmdb_id}_${itemInSearch.media.media_type}`]: {
                        ...itemInSearch,
                        status: 'watched',
                        rating
                    }
                }));
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha ao avaliar.');
        }
    };

    const handleMarkWatchedFromSearch = (libItem: any) => {
        setFinishingSeriesId(libItem.id);
        setFinishedSeriesTitle(""); // Could fetch but modal handles it if we pass context
        setRatingModalVisible(true);
    };

    const handleAddEpisodeFromSearch = async (libItem: any) => {
        const nextEp = libItem.last_episode_seen + 1;

        // Optimistic
        setLibraryDataMap(prev => ({
            ...prev,
            [`${libItem.media.tmdb_id}_${libItem.media.media_type}`]: {
                ...libItem,
                last_episode_seen: nextEp
            }
        }));

        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    last_episode_seen: nextEp,
                    last_watched_at: new Date().toISOString()
                })
                .eq('id', libItem.id);

            if (error) throw error;

            // Global Sync
            invalidateAllCaches();

            if (nextEp >= (libItem.total_episodes || 0)) {
                setFinishingSeriesId(libItem.id);
                setFinishedSeriesTitle(libItem.media.title);
                setRatingModalVisible(true);
            } else {
                fetchActiveSeries(false);
            }

        } catch (e) {
            Alert.alert('Erro', 'Falha ao atualizar episódio.');
            // Revert search map could go here or let effect re-sync
        }
    };

    const handleQuickAdd = async (item: any) => {
        if (!session?.user) return;
        try {
            const result = await addToWatchlist(session.user.id, item.id, item.media_type);
            if (result.success) {
                // Invalidate All Caches
                invalidateAllCaches();
                // Update local map instantly
                const { data: newItem } = await supabase
                    .from('user_library')
                    .select('*, media:media_id(tmdb_id, media_type)')
                    .eq('user_id', session.user.id)
                    .eq('id', result.data?.id)
                    .single();

                if (newItem) {
                    setLibraryDataMap(prev => ({
                        ...prev,
                        [`${item.id}_${item.media_type}`]: newItem
                    }));
                }
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha ao adicionar à lista.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Bom dia, Usuário!</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(true)}>
                    <MaterialCommunityIcons name="cog" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}

            {/* Search Bar */}
            <View style={styles.searchWrapper}>
                <TextInput
                    placeholder="Buscar filmes ou séries..."
                    placeholderTextColor="#999"
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                {searchTerm.length > 0 && (
                    <TouchableOpacity style={styles.clearButton} onPress={() => setSearchTerm('')}>
                        <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: 50 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E50914" colors={["#E50914"]} />
                }
            >
                {/* Search Results */}
                {loadingSearch ? (
                    <ActivityIndicator color="#E50914" style={{ marginBottom: 20 }} />
                ) : searchResults.length > 0 ? (
                    <View style={{ marginBottom: 20 }}>
                        {searchResults.map((item) => (
                            <SearchResultCard
                                key={item.id}
                                item={item}
                                onPress={openDetails}
                                onQuickAdd={handleQuickAdd}
                                onMarkWatched={handleMarkWatchedFromSearch}
                                onAddEpisode={handleAddEpisodeFromSearch}
                                libraryItem={libraryDataMap[`${item.id}_${item.media_type}`]}
                            />
                        ))}
                    </View>
                ) : null}

                {/* Continue Watching / Suggestions */}
                {activeSeries.length > 0 ? (
                    <>
                        <Text style={styles.sectionTitle}>Continuar Vendo</Text>
                        {loadingSeries ? (
                            <ActivityIndicator color="#E50914" />
                        ) : (
                            activeSeries.slice(0, 2).map((item, index) => (
                                <SeriesCard
                                    key={item.id}
                                    item={item}
                                    isFirst={index === 0}
                                    status="active"
                                    onAddEpisode={(id, curr, tot) => addEpisode(id, curr, tot, item.media.title)}
                                    getSeasonAndEpisode={getSeasonAndEpisode}
                                    onPress={handleEditPress}
                                />
                            ))
                        )}
                    </>
                ) : watchlistSuggestions.length > 0 ? (
                    <>
                        <Text style={styles.sectionTitle}>Séries para Começar</Text>
                        <View style={styles.suggestionsRow}>
                            {watchlistSuggestions.map((item) => (
                                <TouchableOpacity
                                    key={item.tmdb_id}
                                    style={styles.suggestionCard}
                                    onPress={() => openDetails(item)}
                                >
                                    <RecommendationCard
                                        item={item}
                                        onPress={openDetails}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                ) : null}

                {/* Rating Modal */}
                <RatingModal
                    visible={ratingModalVisible}
                    onClose={() => setRatingModalVisible(false)}
                    onSubmit={handleRatingSubmit}
                    title={finishedSeriesTitle}
                />


                {/* Movie Tastes - Only Spotlight */}
                {dailyMovie && (
                    <View style={{ marginTop: 20 }}>
                        <Text style={styles.sectionTitle}>Filmes baseados no seu gosto</Text>
                        <TouchableOpacity
                            style={styles.dailyCard}
                            onPress={() => openDetails(dailyMovie)}
                            activeOpacity={0.9}
                        >
                            <Image
                                source={{ uri: `${TMDB_BACKDROP_BASE_URL}${dailyMovie.backdrop_url}` }}
                                style={styles.dailyBackdrop}
                            />
                            <View style={styles.dailyOverlay}>
                                <View style={styles.dailyContent}>
                                    <Text style={styles.dailyBadge}>RECOMENDAÇÃO DO DIA</Text>
                                    <Text style={styles.dailyTitle}>{dailyMovie.title}</Text>
                                    <View style={styles.dailyMeta}>
                                        <View style={styles.ratingBadge}>
                                            <Text style={styles.ratingText}>{dailyMovie.certification}</Text>
                                        </View>
                                        <Text style={styles.dailyGenres}> • {dailyMovie.genres.join(', ')}</Text>
                                        {dailyMovie.runtime > 0 && (
                                            <Text style={styles.dailyGenres}> • {dailyMovie.runtime} min</Text>
                                        )}
                                    </View>
                                    <Text style={styles.dailyOverview} numberOfLines={3}>
                                        {dailyMovie.overview}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Director Recommendations */}
                {topDirector ? renderRecSection(`Mais de ${topDirector}`, directorRecs, loadingPersonalized) : null}

                {/* Actor Recommendations */}
                {topActor ? renderRecSection(`Com ${topActor}`, actorRecs, loadingPersonalized) : null}

                {/* Animated Favorites */}
                {renderRecSection('Animações para Você', animatedRecs, loadingPersonalized)}

                {/* Generic Recommendations */}
                {renderRecSection('Recomendados para Você', recommendations, loadingRecs)}
            </ScrollView>

            {/* Edit Modal */}
            {editingSeries && (
                <EditProgressModal
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    onSave={handleSaveProgress}
                    currentEpisode={editingSeries.last_episode_seen}
                    totalEpisodes={editingSeries.total_episodes}
                    title={editingSeries.media.title}
                />
            )
            }

            {/* Settings Modal */}
            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                onSaveFilters={handleFiltersUpdate}
            />
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        paddingTop: 50,
        paddingHorizontal: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    searchWrapper: {
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    clearButton: {
        padding: 4,
    },
    sectionTitle: {
        color: '#E50914',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 10,
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 10,
    },
    loaderPlaceholder: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    horizontalScroll: {
        minHeight: 180,
    },
    suggestionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginBottom: 20,
    },
    suggestionCard: {
        width: 120,
    },
    dailyCard: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: '#333',
    },
    dailyBackdrop: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    dailyOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    dailyContent: {
        width: '100%',
    },
    dailyBadge: {
        color: '#E50914',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    dailyTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    dailyMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingBadge: {
        backgroundColor: '#E50914',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ratingText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    dailyGenres: {
        color: '#ccc',
        fontSize: 12,
    },
    dailyOverview: {
        color: '#eee',
        fontSize: 12,
        lineHeight: 18,
    },
});
