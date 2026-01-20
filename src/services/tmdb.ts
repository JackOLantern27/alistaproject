const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
export const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/original';

export interface TMDBMedia {
    id: number;
    title?: string;
    name?: string; // Series use 'name'
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
}

export interface TMDBSeriesDetails extends TMDBMedia {
    number_of_episodes: number;
    number_of_seasons: number;
    seasons: {
        season_number: number;
        episode_count: number;
        air_date: string;
    }[];
    next_episode_to_air?: {
        air_date: string;
        episode_number: number;
        season_number: number;
    };
    status: string;
}

const fetchTMDB = async (endpoint: string, params: Record<string, string> = {}) => {
    if (!TMDB_API_KEY) {
        console.error('TMDB API Key is missing');
        return null;
    }

    const queryParams = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'pt-BR',
        ...params,
    }).toString();

    try {
        const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`TMDB Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch TMDB Error:', error);
        return null;
    }
};

export const searchMulti = async (query: string) => {
    return fetchTMDB('/search/multi', { query });
};

export const getSeriesDetails = async (id: number): Promise<TMDBSeriesDetails | null> => {
    return fetchTMDB(`/tv/${id}`);
};

export const getMovieDetails = async (id: number, appendToResponse?: string) => {
    const params: Record<string, string> = {};
    if (appendToResponse) params.append_to_response = appendToResponse;
    return fetchTMDB(`/movie/${id}`, params);
};

export const getRecommendations = async (mediaType: 'movie' | 'tv', id: number) => {
    return fetchTMDB(`/${mediaType}/${id}/recommendations`);
};

export const getDiscoverTV = async (genreIds: string, filters: any = {}) => {
    const params: Record<string, string> = {
        with_genres: genreIds,
        sort_by: 'popularity.desc',
        page: '1',
        ...filters
    };
    return fetchTMDB('/discover/tv', params);
};

export const getDiscoverWithProviders = async (type: 'movie' | 'tv', providerIds: string, filters: any = {}) => {
    const params: Record<string, string> = {
        watch_region: 'BR',
        sort_by: 'popularity.desc',
        'vote_count.gte': '100', // Filter out obscure stuff
        page: '1',
        ...filters
    };

    if (providerIds) {
        params.with_watch_providers = providerIds;
    }

    return fetchTMDB(`/discover/${type}`, params);
};

export const getWatchProviders = async (mediaType: 'movie' | 'tv', id: number) => {
    return fetchTMDB(`/${mediaType}/${id}/watch/providers`);
};

export const getMovieCredits = async (id: number) => {
    return fetchTMDB(`/movie/${id}/credits`);
};

export const getTVCredits = async (id: number) => {
    return fetchTMDB(`/tv/${id}/credits`);
};

export const discoverByPerson = async (personId: number, mediaType: 'movie' | 'tv' = 'movie', filters: any = {}) => {
    return fetchTMDB(`/discover/${mediaType}`, {
        with_people: personId.toString(),
        sort_by: 'popularity.desc',
        'vote_count.gte': '50',
        page: '1',
        ...filters
    });
};

export const discoverByGenre = async (mediaType: 'movie' | 'tv', genreIds: string, excludeAnimated: boolean = false, filters: any = {}) => {
    const params: Record<string, string> = {
        with_genres: genreIds,
        sort_by: 'vote_average.desc',
        'vote_count.gte': '100',
        page: '1',
        ...filters
    };

    // Exclude animation (genre ID 16) if requested
    if (excludeAnimated) {
        params.without_genres = '16';
    }

    return fetchTMDB(`/discover/${mediaType}`, params);
};

export const discoverAnimatedByGenre = async (mediaType: 'movie' | 'tv', genreIds: string, filters: any = {}) => {
    return fetchTMDB(`/discover/${mediaType}`, {
        with_genres: `16,${genreIds}`, // Include animation genre + requested genres
        sort_by: 'vote_average.desc',
        'vote_count.gte': '50',
        page: '1',
        ...filters
    });
};

export const getCollectionDetails = async (id: number) => {
    return fetchTMDB(`/collection/${id}`);
};

export const getWeeklyReleases = async () => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return fetchTMDB('/discover/movie', {
        'primary_release_date.gte': formatDate(today),
        'primary_release_date.lte': formatDate(nextWeek),
        'region': 'BR',
        'sort_by': 'popularity.desc'
    });
};
