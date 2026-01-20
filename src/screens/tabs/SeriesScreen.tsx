import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SeriesCard } from '../../components/SeriesCard';
import { RatingModal } from '../../components/RatingModal';
import { EditProgressModal } from '../../components/EditProgressModal';
import { useFocusEffect } from '@react-navigation/native';
import { getSeriesDetails } from '../../services/tmdb';
import { seriesCache, historyCache, homeCache, CACHE_TTL, invalidateAllCaches } from '../../lib/dataCache';
import { Toast } from '../../components/Toast';

export const SeriesScreen = () => {
    const { session } = useAuth();
    const [activeSeries, setActiveSeries] = useState<any[]>(seriesCache.activeSeries || []);
    const [plannedSeries, setPlannedSeries] = useState<any[]>(seriesCache.plannedSeries || []);
    const [waitingSeries, setWaitingSeries] = useState<any[]>(seriesCache.waitingSeries || []);
    const [finishedSeries, setFinishedSeries] = useState<any[]>(seriesCache.finishedSeries || []);
    const [loading, setLoading] = useState(seriesCache.activeSeries.length === 0);
    const [refreshing, setRefreshing] = useState(false);

    // Rating State
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [finishingSeriesId, setFinishingSeriesId] = useState<number | null>(null);
    const [finishedSeriesTitle, setFinishedSeriesTitle] = useState('');

    // Edit State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingSeries, setEditingSeries] = useState<any>(null);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '' });

    const handleEditPress = (item: any) => {
        setEditingSeries(item);
        setEditModalVisible(true);
    };

    const handleRatingPress = (item: any) => {
        setFinishingSeriesId(item.id);
        setFinishedSeriesTitle(item.media.title);
        setRatingModalVisible(true);
    };

    const handleSaveProgress = async (newCount: number) => {
        if (!editingSeries) return;

        // Optimistic and instant move
        moveItemInState(editingSeries.id, newCount, editingSeries);

        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    last_episode_seen: newCount,
                    last_watched_at: new Date().toISOString()
                })
                .eq('id', editingSeries.id);

            if (error) throw error;

            // Silent refresh to ensure TMDB data is fresh (e.g. if new episodes launched)
            fetchSeries();

        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao atualizar progresso.');
            fetchSeries();
        }
    };

    const moveItemInState = (id: number, newSeen: number, currentItem: any) => {
        const total = currentItem.total_episodes;
        const tmdbStatus = currentItem.tmdb_status || currentItem.status; // Use tmdb_status if available

        // Compute where it should go
        let newComputedStatus = 'active';
        const isUpToDate = newSeen >= total;
        const isEnded = tmdbStatus === 'Ended' || tmdbStatus === 'Canceled';

        if (newSeen === 0) newComputedStatus = 'planned';
        else if (isUpToDate && !isEnded) newComputedStatus = 'waiting';
        else if (isUpToDate && isEnded) newComputedStatus = 'finished';
        else newComputedStatus = 'active';

        const updatedItem = {
            ...currentItem,
            last_episode_seen: newSeen,
            computedStatus: newComputedStatus,
            tmdb_status: tmdbStatus, // Ensure it's preserved
            last_watched_at: new Date().toISOString()
        };

        // 1. Remove from all local lists
        setActiveSeries(prev => prev.filter(i => i.id !== id));
        setPlannedSeries(prev => prev.filter(i => i.id !== id));
        setWaitingSeries(prev => prev.filter(i => i.id !== id));
        setFinishedSeries(prev => prev.filter(i => i.id !== id));

        // 2. Add to the correct list
        if (newComputedStatus === 'planned') {
            setPlannedSeries(prev => [updatedItem, ...prev.filter(i => i.id !== id)]);
        } else if (newComputedStatus === 'active') {
            setActiveSeries(prev => [updatedItem, ...prev.filter(i => i.id !== id)].sort((a, b) => new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime()));
        } else if (newComputedStatus === 'waiting') {
            setWaitingSeries(prev => [updatedItem, ...prev.filter(i => i.id !== id)]);
        } else if (newComputedStatus === 'finished') {
            setFinishedSeries(prev => [updatedItem, ...prev.filter(i => i.id !== id)]);
        }

        // Sync with cache
        const allItems = [...seriesCache.activeSeries, ...seriesCache.plannedSeries, ...seriesCache.waitingSeries, ...seriesCache.finishedSeries].filter(i => i.id !== id);
        const nextPlanned = newComputedStatus === 'planned' ? [updatedItem, ...allItems.filter(i => i.computedStatus === 'planned')] : allItems.filter(i => i.computedStatus === 'planned');
        const nextActive = newComputedStatus === 'active' ? [updatedItem, ...allItems.filter(i => i.computedStatus === 'active')] : allItems.filter(i => i.computedStatus === 'active');
        const nextWaiting = newComputedStatus === 'waiting' ? [updatedItem, ...allItems.filter(i => i.computedStatus === 'waiting')] : allItems.filter(i => i.computedStatus === 'waiting');
        const nextFinished = newComputedStatus === 'finished' ? [updatedItem, ...allItems.filter(i => i.computedStatus === 'finished')] : allItems.filter(i => i.computedStatus === 'finished');

        seriesCache.plannedSeries = nextPlanned;
        seriesCache.activeSeries = nextActive.sort((a, b) => new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime());
        seriesCache.waitingSeries = nextWaiting;
        seriesCache.finishedSeries = nextFinished;
    };

    // Helpers
    const getSeasonAndEpisode = (totalSeen: number, seasons: any[]) => {
        let accumulated = 0;
        // Should ignore season 0 ('Specials') if present? Prompt says "ignora a temporada 0"
        const validSeasons = seasons.filter(s => s.season_number > 0);

        for (const season of validSeasons) {
            if (totalSeen < accumulated + season.episode_count) {
                return {
                    season: season.season_number,
                    episode: totalSeen - accumulated + 1
                };
            }
            accumulated += season.episode_count;
        }
        // Fallback
        return { season: 1, episode: totalSeen + 1 };
        // Logic fix: if totalSeen >= total available on iterate, it means waiting for next season or it completed.
        // Fallback logic in prompt: "{season:1, episode: totalSeen}" - likely meant for edge cases.
    };

    const fetchSeries = async () => {
        try {
            if (!session?.user) return;

            // 1. Fetch from Supabase
            const { data: libraryData, error } = await supabase
                .from('user_library')
                .select(`*, media:media_id (*)`)
                .eq('user_id', session.user.id)
                .in('status', ['watching', 'awaiting_episodes', 'watchlist']) // Fetch watchlist too if status change needed? Prompt says "status = 'watchlist'"? Wait.
                // Prompt says: "recupera todas as séries da tabela public.user_library com status = 'watchlist'..."
                // BUT "status = 'watchlist'" usually means "Plan to watch".
                // "Active" series usually have status 'watching'.
                // Prompt text: "com status = 'watchlist' e media.media_type = 'tv'". 
                // This might be a mistake in prompt or specific flow where everything starts as watchlist.
                // However, I previously used 'watching'.
                // I will fetch 'watching', 'awaiting_episodes', AND 'watchlist' to be safe, filtering media_type='tv'.
                .order('last_watched_at', { ascending: false });

            if (error) throw error;

            const tvItems = libraryData?.filter((item: any) => item.media?.media_type === 'tv') || [];
            const enrichedItems: any[] = [];

            const enrichBatch = async (items: any[]) => {
                await Promise.all(items.map(async (item) => {
                    const details = await getSeriesDetails(item.media.tmdb_id);
                    if (details) {
                        const actualTotal = details.number_of_episodes;
                        let newItem = { ...details, ...item };
                        if (item.total_episodes !== actualTotal) {
                            await supabase.from('user_library').update({ total_episodes: actualTotal }).eq('id', item.id);
                            newItem.total_episodes = actualTotal;
                        }
                        let newStatus = 'active';
                        const isUpToDate = item.last_episode_seen >= actualTotal;
                        const isEnded = details.status === 'Ended' || details.status === 'Canceled';

                        if (item.last_episode_seen === 0) newStatus = 'planned';
                        else if (isUpToDate && !isEnded) newStatus = 'waiting';
                        else if (isUpToDate && isEnded) newStatus = 'finished';
                        else newStatus = 'active';

                        enrichedItems.push({
                            ...newItem,
                            computedStatus: newStatus,
                            tmdb_status: details.status // Preserve original TMDB status
                        });
                    }
                }));
            };

            const updateLocalLists = () => {
                const planned = enrichedItems.filter(i => i.computedStatus === 'planned');
                const active = enrichedItems
                    .filter(i => i.computedStatus === 'active')
                    .sort((a, b) => new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime());
                const waiting = enrichedItems.filter(i => i.computedStatus === 'waiting');
                const finished = enrichedItems.filter(i => i.computedStatus === 'finished');

                setPlannedSeries(planned);
                setActiveSeries(active);
                setWaitingSeries(waiting);
                setFinishedSeries(finished);

                seriesCache.plannedSeries = planned;
                seriesCache.activeSeries = active;
                seriesCache.waitingSeries = waiting;
                seriesCache.finishedSeries = finished;
                seriesCache.lastFetched = Date.now();
            };

            // Phase 1: Prioritize 'watching' status from Supabase
            const watching = tvItems.filter(i => i.status === 'watching');
            const others = tvItems.filter(i => i.status !== 'watching');

            await enrichBatch(watching);
            updateLocalLists();

            // Phase 2: Enrich the rest
            await enrichBatch(others);
            updateLocalLists();

        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao carregar séries.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    const handleRatingSubmit = async (rating: number, comment: string) => {
        if (!finishingSeriesId) return;

        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    status: 'watched', // Move to History
                    rating: rating,
                    review_text: comment,
                    watched_at: new Date().toISOString(),
                })
                .eq('id', finishingSeriesId);

            if (error) throw error;

            // Invalidate All Caches
            invalidateAllCaches();

            Alert.alert('Parabéns!', 'Série completada e movida para o Histórico.');

            // Remove from local lists
            setActiveSeries(prev => prev.filter(i => i.id !== finishingSeriesId));
            setWaitingSeries(prev => prev.filter(i => i.id !== finishingSeriesId));
            setFinishedSeries(prev => prev.filter(i => i.id !== finishingSeriesId));

        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar avaliação.');
        }
    };

    const addEpisode = async (id: number, currentSeen: number, total: number, title: string) => {
        if (currentSeen < total) {
            const nextEp = currentSeen + 1;
            const now = new Date().toISOString();

            // Find item in any list to get its details for moveItemInState
            const currentItem = [...activeSeries, ...plannedSeries, ...waitingSeries, ...finishedSeries].find(i => i.id === id);
            if (!currentItem) return;

            // Instant UI update
            moveItemInState(id, nextEp, currentItem);

            try {
                const { error } = await supabase
                    .from('user_library')
                    .update({
                        last_episode_seen: nextEp,
                        last_watched_at: now,
                        status: 'watching'
                    })
                    .eq('id', id);

                if (error) throw error;
                invalidateAllCaches();

                if (nextEp >= total) {
                    setToast({ visible: true, message: '🎉 Série em dia! Você assistiu tudo.' });
                }

            } catch (error) {
                console.error(error);
                Alert.alert('Erro', 'Não foi possível atualizar.');
                fetchSeries(); // Revert on error
            }
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            const isFresh = (now - seriesCache.lastFetched) < CACHE_TTL;
            if (!isFresh || seriesCache.activeSeries.length === 0) {
                fetchSeries();
            } else {
                setLoading(false);
            }
        }, [session])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchSeries();
    };

    // Unified loading screen removed to allow top-to-bottom feed

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Minhas Séries</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E50914" />
                }
            >
                {/* Active Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Continuar Vendo</Text>
                    {loading && activeSeries.length === 0 ? (
                        <View style={styles.loaderPlaceholder}>
                            <ActivityIndicator color="#E50914" />
                        </View>
                    ) : activeSeries.length > 0 ? (
                        activeSeries.map((item, index) => (
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
                    ) : (
                        <Text style={styles.emptyText}>Nenhuma série ativa no momento.</Text>
                    )}
                </View>

                {/* Planned Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Séries para Começar</Text>
                    {loading && plannedSeries.length === 0 ? (
                        <View style={styles.loaderPlaceholder}>
                            <ActivityIndicator color="#E50914" />
                        </View>
                    ) : plannedSeries.length > 0 ? (
                        plannedSeries.map((item) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                status="active" // They behave like active cards for interactions
                                onAddEpisode={(id, curr, tot) => addEpisode(id, curr, tot, item.media.title)}
                                getSeasonAndEpisode={getSeasonAndEpisode}
                                onPress={handleEditPress}
                            />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>Nenhuma série planejada.</Text>
                    )}
                </View>

                {/* Waiting Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Aguardando Novos Episódios</Text>
                    {waitingSeries.length > 0 ? (
                        waitingSeries.map((item) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                status="waiting"
                                onAddEpisode={(id, curr, tot) => addEpisode(id, curr, tot, item.media.title)}
                                getSeasonAndEpisode={getSeasonAndEpisode}
                                onPress={handleEditPress}
                            />
                        ))
                    ) : (
                        <Text style={styles.emptyText}></Text>
                    )}
                </View>

                {/* Finished Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Finalizadas (Avaliar)</Text>
                    {finishedSeries.length > 0 ? (
                        finishedSeries.map((item) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                status="finished"
                                isFirst={false}
                                onAddEpisode={(id, curr, tot) => {
                                    setFinishingSeriesId(item.id);
                                    setFinishedSeriesTitle(item.media.title);
                                    setRatingModalVisible(true);
                                }}
                                getSeasonAndEpisode={getSeasonAndEpisode}
                                onPress={handleEditPress}
                            />
                        ))
                    ) : (
                        <Text style={styles.emptyText}></Text>
                    )}
                </View>

                {/* Global Empty State */}
                {!loading && activeSeries.length === 0 && waitingSeries.length === 0 && finishedSeries.length === 0 && (
                    <Text style={[styles.emptyText, { marginTop: 20 }]}>Nenhuma série na lista.</Text>
                )}
            </ScrollView>

            <RatingModal
                visible={ratingModalVisible}
                onClose={() => setRatingModalVisible(false)}
                onSubmit={handleRatingSubmit}
                title={finishedSeriesTitle}
            />

            {editingSeries && (
                <EditProgressModal
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    onSave={handleSaveProgress}
                    currentEpisode={editingSeries.last_episode_seen}
                    totalEpisodes={editingSeries.total_episodes}
                    title={editingSeries.media.title}
                />
            )}
            <Toast
                visible={toast.visible}
                message={toast.message}
                onHide={() => setToast({ ...toast, visible: false })}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 50, // Safe area approx
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#1a1a1a',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        color: '#E50914',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    loaderPlaceholder: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
