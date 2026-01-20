import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { TMDB_BACKDROP_BASE_URL, TMDB_IMAGE_BASE_URL, getSeriesDetails, getMovieDetails, getWatchProviders, getMovieCredits, getTVCredits, getCollectionDetails } from '../services/tmdb';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from 'react-native';
import { watchlistCache, historyCache, homeCache, invalidateAllCaches } from '../lib/dataCache';
import { RatingModal } from './RatingModal';

interface DetailModalContentProps {
    mediaId: number;
    mediaType: 'tv' | 'movie';
    onClose: () => void;
}

export const DetailModalContent = ({ mediaId, mediaType, onClose }: DetailModalContentProps) => {
    const { session } = useAuth();
    const { colors } = useTheme();
    const [details, setDetails] = useState<any>(null);
    const [activeMediaId, setActiveMediaId] = useState(mediaId);
    const [activeMediaType, setActiveMediaType] = useState(mediaType);
    const scrollRef = useRef<ScrollView>(null);

    const [credits, setCredits] = useState<any>(null);
    const [providers, setProviders] = useState<any>(null);
    const [collection, setCollection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [libraryItem, setLibraryItem] = useState<any>(null);
    const [adding, setAdding] = useState(false);
    const [ratingModalVisible, setRatingModalVisible] = useState(false);

    // Sync state with props
    useEffect(() => {
        setActiveMediaId(mediaId);
        setActiveMediaType(mediaType);
    }, [mediaId, mediaType]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            setDetails(null);
            setCredits(null);
            setProviders(null);
            setCollection(null);
            setLibraryItem(null);

            try {
                // 1. Fetch Main Details & Credits & Providers in parallel
                const [detailsData, creditsData, providersData] = await Promise.all([
                    activeMediaType === 'tv' ? getSeriesDetails(activeMediaId) : getMovieDetails(activeMediaId),
                    activeMediaType === 'tv' ? getTVCredits(activeMediaId) : getMovieCredits(activeMediaId),
                    getWatchProviders(activeMediaType, activeMediaId)
                ]);

                setDetails(detailsData);
                setCredits(creditsData);
                setProviders(providersData?.results?.BR || null);

                // 2. If it's a movie and part of a collection, fetch collection details
                if (activeMediaType === 'movie' && detailsData?.belongs_to_collection) {
                    const collData = await getCollectionDetails(detailsData.belongs_to_collection.id);
                    setCollection(collData);
                }

                // 3. Check Library Status
                if (session?.user) {
                    const { data: existingMedia } = await supabase
                        .from('media')
                        .select('id')
                        .eq('tmdb_id', activeMediaId)
                        .eq('media_type', activeMediaType)
                        .single();

                    if (existingMedia) {
                        const { data: libItem } = await supabase
                            .from('user_library')
                            .select('*')
                            .eq('user_id', session.user.id)
                            .eq('media_id', existingMedia.id)
                            .maybeSingle();

                        if (libItem) setLibraryItem(libItem);
                    }
                }

                // Scroll to top when loading new content
                scrollRef.current?.scrollTo({ y: 0, animated: true });
            } catch (error) {
                console.error('Error fetching media data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [activeMediaId, activeMediaType, session]);


    const handleAddToWatchlist = async () => {
        if (!session?.user || !details) return;
        setAdding(true);

        try {
            // 1. Ensure Media Exists
            let { data: media } = await supabase
                .from('media')
                .select('id')
                .eq('tmdb_id', activeMediaId)
                .eq('media_type', activeMediaType)
                .single();

            if (!media) {
                const { data: newMedia, error: mediaError } = await supabase
                    .from('media')
                    .insert({
                        tmdb_id: activeMediaId,
                        media_type: activeMediaType,
                        title: details.title || details.name,
                        poster_url: details.poster_path // Could update later
                    })
                    .select()
                    .single();

                if (mediaError) throw mediaError;
                media = newMedia;
            }

            // 2. Add to Library
            const { error: libError } = await supabase
                .from('user_library')
                .insert({
                    user_id: session.user.id,
                    media_id: media?.id,
                    status: 'watchlist',
                    total_episodes: details.number_of_episodes || 0,
                    last_episode_seen: 0
                });

            if (libError) throw libError;

            // Re-fetch lib item to get the ID and status
            const { data: newItem } = await supabase
                .from('user_library')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('media_id', media?.id)
                .single();

            setLibraryItem(newItem);
            // Invalidate All Caches
            invalidateAllCaches();

        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao adicionar.');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveFromWatchlist = async () => {
        if (!libraryItem || !session?.user) return;
        setAdding(true);
        try {
            const { error } = await supabase
                .from('user_library')
                .delete()
                .eq('id', libraryItem.id);

            if (error) throw error;
            setLibraryItem(null);
            invalidateAllCaches();
        } catch (error) {
            Alert.alert('Erro', 'Falha ao remover.');
        } finally {
            setAdding(false);
        }
    };

    const handleRatingSubmit = async (rating: number, comment: string) => {
        if (!libraryItem || !session?.user) return;
        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    status: 'watched',
                    rating,
                    review_text: comment,
                    watched_at: new Date().toISOString()
                })
                .eq('id', libraryItem.id);

            if (error) throw error;

            setLibraryItem({ ...libraryItem, status: 'watched', rating });
            invalidateAllCaches();
            watchlistCache.lastFetched = 0;
            setRatingModalVisible(false);
        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar avaliação.');
        }
    };

    const formatMoney = (amount: number) => {
        if (!amount || amount === 0) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getProfitColor = (budget: number, revenue: number) => {
        if (!budget || !revenue) return '#888';
        return revenue > budget ? '#4CAF50' : '#E50914';
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#E50914" /></View>;
    if (!details) return <View style={styles.center}><Text style={{ color: colors.text }}>Erro ao carregar detalhes.</Text></View>;

    const director = credits?.crew?.find((c: any) => c.job === 'Director');
    const writers = credits?.crew?.filter((c: any) => c.department === 'Writing')?.slice(0, 3) || [];
    const mainCast = credits?.cast?.slice(0, 10) || [];
    const sequels = collection?.parts?.filter((p: any) => p.id !== mediaId)?.sort((a: any, b: any) =>
        new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
    ) || [];

    return (
        <View style={[styles.container, { backgroundColor: '#121212' }]}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <MaterialCommunityIcons name="chevron-down" size={36} color="#fff" />
            </TouchableOpacity>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
                <Image
                    source={{ uri: `${TMDB_BACKDROP_BASE_URL}${details.backdrop_path || details.poster_path}` }}
                    style={styles.backdrop}
                />

                <View style={styles.mainContent}>
                    {/* Header Info */}
                    <Text style={styles.mainTitle}>{details.title || details.name}</Text>
                    {details.original_title && details.original_title !== details.title && (
                        <Text style={styles.originalTitle}>{details.original_title}</Text>
                    )}
                    {details.tagline ? <Text style={styles.tagline}>"{details.tagline}"</Text> : null}

                    <View style={styles.statsBar}>
                        <View style={styles.statItem}>
                            <MaterialCommunityIcons name="calendar" size={16} color="#888" />
                            <Text style={styles.statText}>
                                {new Date(details.release_date || details.first_air_date || '').getFullYear()}
                            </Text>
                        </View>
                        <View style={styles.dot} />
                        <View style={styles.statItem}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#888" />
                            <Text style={styles.statText}>
                                {details.runtime ? `${details.runtime}min` : details.episode_run_time?.[0] ? `${details.episode_run_time[0]}min` : 'N/A'}
                            </Text>
                        </View>
                        <View style={styles.dot} />
                        <View style={styles.statItem}>
                            <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                            <Text style={styles.statText}>{details.vote_average?.toFixed(1)}</Text>
                        </View>
                    </View>

                    {/* Action Row */}
                    <View style={styles.actionRow}>
                        {!libraryItem ? (
                            <TouchableOpacity style={styles.primaryAddBtn} onPress={handleAddToWatchlist} disabled={adding}>
                                {adding ? <ActivityIndicator color="#fff" /> : (
                                    <>
                                        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                                        <Text style={styles.btnText}>Adicionar à Lista</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : libraryItem.status === 'watchlist' ? (
                            <View style={styles.libActionsContainer}>
                                <TouchableOpacity
                                    style={[styles.libActionBtn, styles.watchedBtn]}
                                    onPress={() => setRatingModalVisible(true)}
                                >
                                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                                    <Text style={styles.libActionText}>Marcar como Visto</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.libActionBtn, styles.removeBtn]}
                                    onPress={handleRemoveFromWatchlist}
                                    disabled={adding}
                                >
                                    {adding ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <MaterialCommunityIcons name="delete-outline" size={20} color="#fff" />
                                            <Text style={styles.libActionText}>Remover</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.libraryBadge}>
                                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                                <Text style={styles.libraryText}>Assistido</Text>
                            </View>
                        )}
                    </View>

                    {/* Providers */}
                    {providers && (providers.flatrate || providers.rent || providers.buy) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>Onde Assistir</Text>
                            <View style={styles.providerRow}>
                                {[...(providers.flatrate || []), ...(providers.buy || []), ...(providers.rent || [])]
                                    .filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i)
                                    .slice(0, 6)
                                    .map((p: any) => (
                                        <Image
                                            key={p.provider_id}
                                            source={{ uri: `${TMDB_IMAGE_BASE_URL}${p.logo_path}` }}
                                            style={styles.providerLogo}
                                        />
                                    ))
                                }
                            </View>
                        </View>
                    )}

                    {/* Genres & Tags */}
                    <View style={styles.genreRow}>
                        {details.genres?.map((g: any) => (
                            <View key={g.id} style={styles.genreBadge}>
                                <Text style={styles.genreText}>{g.name}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Overview */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Sinopse</Text>
                        <Text style={styles.overviewText}>{details.overview || 'Sinopse não disponível em português.'}</Text>
                    </View>

                    {/* Technical Info Grid */}
                    <View style={styles.technicalGrid}>
                        <View style={styles.techItem}>
                            <Text style={styles.techLabel}>País</Text>
                            <Text style={styles.techValue}>{details.production_countries?.[0]?.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.techItem}>
                            <Text style={styles.techLabel}>Idiomas</Text>
                            <Text style={styles.techValue}>{details.spoken_languages?.map((l: any) => l.name).join(', ') || 'N/A'}</Text>
                        </View>
                        {mediaType === 'tv' ? (
                            <>
                                <View style={styles.techItem}>
                                    <Text style={styles.techLabel}>Temporadas</Text>
                                    <Text style={styles.techValue}>{details.number_of_seasons}</Text>
                                </View>
                                <View style={styles.techItem}>
                                    <Text style={styles.techLabel}>Episódios</Text>
                                    <Text style={styles.techValue}>{details.number_of_episodes}</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.techItem}>
                                    <Text style={styles.techLabel}>Orçamento</Text>
                                    <Text style={styles.techValue}>{formatMoney(details.budget)}</Text>
                                </View>
                                <View style={styles.techItem}>
                                    <Text style={styles.techLabel}>Receita</Text>
                                    <Text style={[styles.techValue, { color: getProfitColor(details.budget, details.revenue) }]}>
                                        {formatMoney(details.revenue)}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    <View style={styles.separator} />

                    {/* Cast & Crew */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Equipe Principal</Text>
                        <View style={styles.crewInfo}>
                            {director && (
                                <View style={styles.crewMember}>
                                    <Text style={styles.crewRole}>Diretor</Text>
                                    <Text style={styles.crewName}>{director.name}</Text>
                                </View>
                            )}
                            {writers.length > 0 && (
                                <View style={styles.crewMember}>
                                    <Text style={styles.crewRole}>Roteiro</Text>
                                    <Text style={styles.crewName}>{writers.map((w: any) => w.name).join(', ')}</Text>
                                </View>
                            )}
                        </View>

                        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Elenco</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castList}>
                            {mainCast.map((actor: any) => (
                                <View key={actor.id} style={styles.castCard}>
                                    <Image
                                        source={actor.profile_path ? { uri: `${TMDB_IMAGE_BASE_URL}${actor.profile_path}` } : { uri: 'https://via.placeholder.com/100x150?text=N/A' }}
                                        style={styles.castImage}
                                    />
                                    <Text style={styles.actorName} numberOfLines={1}>{actor.name}</Text>
                                    <Text style={styles.characterName} numberOfLines={1}>{actor.character}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Collection / Sequels */}
                    {sequels.length > 0 && (
                        <View style={[styles.section, { marginTop: 30 }]}>
                            <Text style={styles.sectionHeader}>Próximos da Franquia</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sequelList}>
                                {sequels.map((item: any) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.sequelCard}
                                        onPress={() => {
                                            setActiveMediaId(item.id);
                                            setActiveMediaType('movie');
                                        }}
                                    >
                                        <Image
                                            source={{ uri: `${TMDB_IMAGE_BASE_URL}${item.poster_path}` }}
                                            style={styles.sequelImage}
                                        />
                                        <Text style={styles.sequelTitle} numberOfLines={2}>{item.title}</Text>
                                        <Text style={styles.sequelYear}>{new Date(item.release_date).getFullYear()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </ScrollView>

            {ratingModalVisible && (
                <RatingModal
                    visible={ratingModalVisible}
                    title={details?.title || details?.name}
                    onClose={() => setRatingModalVisible(false)}
                    onSubmit={handleRatingSubmit}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 4,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    backdrop: {
        width: '100%',
        height: 250,
        resizeMode: 'cover',
    },
    mainContent: {
        padding: 20,
        marginTop: -30,
        backgroundColor: '#121212',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
    },
    originalTitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
        fontStyle: 'italic',
    },
    tagline: {
        fontSize: 16,
        color: '#E50914',
        marginTop: 8,
        fontWeight: '600',
        fontStyle: 'italic',
    },
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        gap: 10,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#333',
    },
    actionRow: {
        marginTop: 25,
        marginBottom: 10,
    },
    primaryAddBtn: {
        backgroundColor: '#E50914',
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#E50914',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    libraryBadge: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    libraryText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    libActionsContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    libActionBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    watchedBtn: {
        backgroundColor: '#4CAF50', // Green
    },
    removeBtn: {
        backgroundColor: '#333',
    },
    libActionText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    section: {
        marginTop: 25,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    providerRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    providerLogo: {
        width: 45,
        height: 45,
        borderRadius: 10,
    },
    genreRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 20,
    },
    genreBadge: {
        backgroundColor: '#222',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    genreText: {
        color: '#ccc',
        fontSize: 12,
        fontWeight: '600',
    },
    overviewText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#aaa',
        textAlign: 'justify',
    },
    technicalGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 25,
        backgroundColor: '#1a1a1a',
        borderRadius: 15,
        padding: 15,
        gap: 20,
    },
    techItem: {
        minWidth: '40%',
    },
    techLabel: {
        color: '#666',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 'bold',
    },
    techValue: {
        color: '#fff',
        fontSize: 14,
        marginTop: 4,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#222',
        marginVertical: 30,
    },
    crewInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 30,
    },
    crewMember: {
        marginBottom: 10,
    },
    crewRole: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
    },
    crewName: {
        color: '#fff',
        fontSize: 14,
        marginTop: 2,
    },
    castList: {
        gap: 15,
        paddingRight: 20,
    },
    castCard: {
        width: 100,
    },
    castImage: {
        width: 100,
        height: 140,
        borderRadius: 12,
        backgroundColor: '#222',
    },
    actorName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
    },
    characterName: {
        color: '#777',
        fontSize: 11,
        marginTop: 2,
    },
    sequelList: {
        gap: 15,
        paddingRight: 20,
    },
    sequelCard: {
        width: 140,
    },
    sequelImage: {
        width: 140,
        height: 200,
        borderRadius: 12,
        backgroundColor: '#222',
    },
    sequelTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        marginTop: 10,
    },
    sequelYear: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
});
