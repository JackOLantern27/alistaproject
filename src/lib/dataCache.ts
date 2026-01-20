// src/lib/dataCache.ts

export const homeCache: any = {
    activeSeries: [],
    recommendations: [],
    directorRecs: [],
    actorRecs: [],
    animatedRecs: [],
    movieRecs: [],
    topDirector: '',
    topActor: '',
    lastFetched: 0,
};

export const seriesCache: any = {
    activeSeries: [],
    plannedSeries: [],
    waitingSeries: [],
    finishedSeries: [],
    lastFetched: 0,
};

export const watchlistCache: any = {
    sections: [],
    providers: {},
    releaseDates: {},
    lastFetched: 0,
};

export const historyCache: any = {
    history: [],
    lastFetched: 0,
};

export const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const invalidateAllCaches = () => {
    homeCache.lastFetched = 0;
    seriesCache.lastFetched = 0;
    watchlistCache.lastFetched = 0;
    historyCache.lastFetched = 0;
};
