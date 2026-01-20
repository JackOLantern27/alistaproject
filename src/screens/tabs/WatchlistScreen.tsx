import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SectionList, RefreshControl } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TMDB_IMAGE_BASE_URL, getWatchProviders, getSeriesDetails, getMovieDetails } from '../../services/tmdb';
import { RatingModal } from '../../components/RatingModal';
import { useTheme, useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { watchlistCache, seriesCache, historyCache, homeCache, CACHE_TTL, invalidateAllCaches } from '../../lib/dataCache';

export const WatchlistScreen = () => {
    const { session } = useAuth();
    const { colors } = useTheme();
    const navigation = useNavigation<any>();

    const [sections, setSections] = useState<any[]>(watchlistCache.sections || []);
    const [providers, setProviders] = useState<Record<number, any[]>>(watchlistCache.providers || {});
    const [releaseDates, setReleaseDates] = useState<Record<number, string>>(watchlistCache.releaseDates || {});
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(watchlistCache.sections.length === 0);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        setRefreshing(true);
        fetchWatchlist();
    };

    const fetchWatchlist = async () => {
        try {
            if (!session?.user) return;
            setLoading(true);

            const { data, error } = await supabase
                .from('user_library')
                .select('*, media:media_id (*)')
                .eq('user_id', session.user.id)
                .eq('status', 'watchlist');

            if (error) throw error;

            const rawData = data || [];
            const newProviders: Record<number, any[]> = {};
            const newDates: Record<number, string> = {};

            const available: any[] = [];
            const upcoming: any[] = [];
            const now = new Date();

            if (rawData.length > 0) {
                await Promise.all(rawData.map(async (item) => {
                    if (item.media?.tmdb_id && item.media?.media_type) {
                        const tmdbId = item.media.tmdb_id;
                        const type = item.media.media_type;

                        let releaseDateStr = '';
                        try {
                            if (type === 'tv') {
                                const details = await getSeriesDetails(tmdbId);
                                releaseDateStr = details?.first_air_date || '';
                            } else {
                                const details = await getMovieDetails(tmdbId);
                                releaseDateStr = details?.release_date || '';
                            }
                        } catch (e) {
                            console.warn('Error fetching TMDB details for', type, tmdbId);
                        }

                        let flatrate = null;
                        try {
                            const providerData = await getWatchProviders(type, tmdbId);
                            flatrate = providerData?.results?.BR?.flatrate;
                        } catch (e) {
                            console.warn('Error fetching providers for', type, tmdbId);
                        }

                        const rDate = releaseDateStr ? new Date(releaseDateStr) : null;
                        let isUpcoming = false;

                        if (rDate && rDate > now) {
                            isUpcoming = true;
                            newDates[item.id] = releaseDateStr;
                        }

                        if (isUpcoming) {
                            upcoming.push(item);
                        } else {
                            available.push(item);

                            if (flatrate && flatrate.length > 0) {
                                newProviders[item.id] = flatrate;
                            } else if (type === 'movie' && rDate) {
                                const diffDays = (now.getTime() - rDate.getTime()) / (1000 * 3600 * 24);
                                if (diffDays < 90) {
                                    newProviders[item.id] = [{ provider_name: 'Nos Cinemas', special_type: 'cinema' }];
                                } else {
                                    newProviders[item.id] = [{ provider_name: 'TeusPulo Flix', special_type: 'teuspulo' }];
                                }
                            }
                        }
                    } else {
                        available.push(item);
                    }
                }));

                setProviders(newProviders);
                setReleaseDates(newDates);

                const availableSeries = available.filter(i => i.media?.media_type === 'tv');
                const availableMovies = available.filter(i => i.media?.media_type === 'movie');
                const other = available.filter(i =>
                    !i.media || (i.media.media_type !== 'tv' && i.media.media_type !== 'movie')
                );

                const resultSections = [];
                if (availableSeries.length > 0) resultSections.push({ title: 'Séries', data: availableSeries });
                if (availableMovies.length > 0) resultSections.push({ title: 'Filmes', data: availableMovies });
                if (other.length > 0) resultSections.push({ title: 'Ainda Processando/Erro', data: other });
                if (upcoming.length > 0) resultSections.push({ title: 'Aguardando Lançamento', data: upcoming });

                setSections(resultSections);
                watchlistCache.sections = resultSections;
                watchlistCache.providers = newProviders;
                watchlistCache.releaseDates = newDates;
                watchlistCache.lastFetched = Date.now();
            } else {
                setSections([]);
                watchlistCache.sections = [];
            }

        } catch (error) {
            console.error('Watchlist fetch error:', error);
            Alert.alert('Erro', 'Não foi possível carregar a Watchlist.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            const isFresh = (now - watchlistCache.lastFetched) < CACHE_TTL;
            if (!isFresh || watchlistCache.sections.length === 0) {
                fetchWatchlist();
            } else {
                setLoading(false);
            }
        }, [session])
    );

    const handleCheckPress = async (item: any) => {
        if (item.media?.media_type === 'tv') {
            try {
                const { error } = await supabase
                    .from('user_library')
                    .update({
                        status: 'watching',
                        last_episode_seen: 1,
                        last_watched_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                if (error) throw error;

                invalidateAllCaches();

                Alert.alert('Boa escolha!', `"${item.media.title}" foi movida para suas séries ativas.`, [
                    { text: 'OK', onPress: () => navigation.navigate('Séries') }
                ]);

                const updatedSections = sections.map(sec => ({
                    ...sec,
                    data: sec.data.filter((i: any) => i.id !== item.id)
                })).filter(sec => sec.data.length > 0);

                setSections(updatedSections);
                watchlistCache.sections = updatedSections;

            } catch (error) {
                console.error(error);
                Alert.alert('Erro', 'Falha ao iniciar série.');
            }
        } else {
            setSelectedItem(item);
            setModalVisible(true);
        }
    };

    const handleSubmitRating = async (rating: number, comment: string) => {
        if (!selectedItem) return;

        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    status: 'watched',
                    rating: rating,
                    review_text: comment,
                    watched_at: new Date().toISOString(),
                })
                .eq('id', selectedItem.id);

            if (error) throw error;

            // Invalidate All Caches
            invalidateAllCaches();

            const updatedSections = sections.map(sec => ({
                ...sec,
                data: sec.data.filter((i: any) => i.id !== selectedItem.id)
            })).filter(sec => sec.data.length > 0);

            setSections(updatedSections);
            watchlistCache.sections = updatedSections;

        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar avaliação.');
        }
    };

    const handleDelete = (item: any) => {
        Alert.alert(
            'Remover',
            `Deseja remover "${item.media?.title || 'este item'}" da Watchlist?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('user_library')
                                .delete()
                                .eq('id', item.id);

                            if (error) throw error;

                            const updatedSections = sections.map(sec => ({
                                ...sec,
                                data: sec.data.filter((i: any) => i.id !== item.id)
                            })).filter(sec => sec.data.length > 0);
                            setSections(updatedSections);
                            watchlistCache.sections = updatedSections;
                            invalidateAllCaches();
                        } catch (e) {
                            Alert.alert('Erro', 'Falha ao remover item.');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <Image
                source={{ uri: item.media?.poster_url ? `${TMDB_IMAGE_BASE_URL}${item.media.poster_url}` : 'https://via.placeholder.com/50x75' }}
                style={styles.poster}
            />
            <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={2}>{item.media?.title || 'Título Desconhecido'}</Text>
                {providers[item.id] && providers[item.id].length > 0 && (
                    <View style={styles.providersRow}>
                        {providers[item.id].map((prov: any, index: number) => {
                            if (index > 3) return null;

                            if (prov.special_type === 'cinema') {
                                return (
                                    <View key="cinema" style={styles.specialBadge}>
                                        <MaterialCommunityIcons name="ticket" size={12} color="#000" />
                                        <Text style={styles.specialText}>Cinemas</Text>
                                    </View>
                                );
                            }
                            if (prov.special_type === 'teuspulo') {
                                return (
                                    <View key="teuspulo" style={[styles.specialBadge, { backgroundColor: '#444' }]}>
                                        <MaterialCommunityIcons name="pirate" size={12} color="#fff" />
                                        <Text style={[styles.specialText, { color: '#fff' }]}>TeusPulo Flix</Text>
                                    </View>
                                );
                            }

                            return (
                                <Image
                                    key={prov.provider_id}
                                    source={{ uri: `${TMDB_IMAGE_BASE_URL}${prov.logo_path}` }}
                                    style={styles.providerLogo}
                                />
                            );
                        })}
                    </View>
                )}
                {releaseDates[item.id] && (
                    <Text style={styles.releaseDate}>
                        Estreia: {new Date(releaseDates[item.id]).toLocaleDateString('pt-BR')}
                    </Text>
                )}
            </View>

            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                <MaterialCommunityIcons name="trash-can-outline" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleCheckPress(item)} style={[styles.actionButton, { marginLeft: 10 }]}>
                <MaterialCommunityIcons
                    name={item.media?.media_type === 'tv' ? "play-circle-outline" : "check-circle-outline"}
                    size={30}
                    color="#E50914"
                />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Minha Lista</Text>
            </View>

            {loading && sections.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#E50914" />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title}</Text>
                    )}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.empty}>Sua lista está vazia.</Text>}
                    stickySectionHeadersEnabled={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#E50914"
                            colors={["#E50914"]}
                        />
                    }
                />
            )}

            <RatingModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleSubmitRating}
                title={selectedItem?.media?.title || ''}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#1a1a1a',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    list: {
        padding: 15,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        borderRadius: 12,
        backgroundColor: '#2a2a2a',
        borderColor: '#333',
        borderWidth: 1,
        padding: 10,
        elevation: 2,
    },
    poster: {
        width: 50,
        height: 75,
        borderRadius: 6,
        marginRight: 15,
        backgroundColor: '#333',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    providersRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    providerLogo: {
        width: 24,
        height: 24,
        borderRadius: 4,
        marginRight: 6,
        backgroundColor: '#444',
    },
    specialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    specialText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
        marginLeft: 2,
    },
    actionButton: {
        padding: 5,
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        opacity: 0.6,
        color: '#ccc',
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 20,
        marginBottom: 10,
    },
    releaseDate: {
        color: '#FFD700',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    }
});
