import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { getWeeklyReleases, TMDB_IMAGE_BASE_URL } from '../../services/tmdb';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const SocialScreen = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const [weeklyReleases, setWeeklyReleases] = useState<any[]>([]);
    const [socialFeed, setSocialFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            // 1. Fetch Weekly Releases
            const releases = await getWeeklyReleases();
            setWeeklyReleases(releases?.results?.slice(0, 10) || []);

            // 2. Fetch Public Users and their "Sky & Hell"
            // Get public profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name')
                .eq('is_public', true)
                .limit(20);

            if (profileError) throw profileError;

            const feedItems = await Promise.all(profiles.map(async (profile) => {
                // Get highest rated
                const { data: sky } = await supabase
                    .from('user_library')
                    .select('*, media:media_id (*)')
                    .eq('user_id', profile.id)
                    .eq('status', 'watched')
                    .order('rating', { ascending: false })
                    .limit(1)
                    .single();

                // Get lowest rated
                const { data: hell } = await supabase
                    .from('user_library')
                    .select('*, media:media_id (*)')
                    .eq('user_id', profile.id)
                    .eq('status', 'watched')
                    .order('rating', { ascending: true })
                    .limit(1)
                    .single();

                return {
                    profile,
                    sky: sky?.media || null,
                    skyRating: sky?.rating || 0,
                    hell: hell?.media || null,
                    hellRating: hell?.rating || 0
                };
            }));

            // Filter out users who don't have enough data (at least 1 rated item)
            setSocialFeed(feedItems.filter(item => item.sky || item.hell));

        } catch (error) {
            console.error('Error fetching social data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const openDetails = (item: any) => {
        navigation.navigate('GenericModal', {
            mediaId: item.tmdb_id,
            mediaType: item.media_type || 'movie'
        });
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Estreias da Semana</Text>
            <FlatList
                horizontal
                data={weeklyReleases}
                keyExtractor={(item) => item.id.toString()}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.releaseCard} onPress={() => openDetails({ tmdb_id: item.id, media_type: 'movie' })}>
                        <Image
                            source={{ uri: `${TMDB_IMAGE_BASE_URL}${item.poster_path}` }}
                            style={styles.releaseImage}
                        />
                        <Text style={[styles.releaseTitle, { color: colors.text }]} numberOfLines={1}>
                            {item.title}
                        </Text>
                    </TouchableOpacity>
                )}
            />
            <View style={styles.separator} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Céu e Inferno</Text>
        </View>
    );

    const renderFeedItem = ({ item }: { item: any }) => (
        <View style={[styles.userCard, { backgroundColor: '#222' }]}>
            <View style={styles.userHeader}>
                <MaterialCommunityIcons name="account-circle" size={24} color={colors.primary} />
                <Text style={[styles.userName, { color: colors.text }]}>{item.profile.display_name}</Text>
            </View>

            <View style={styles.comparisonContainer}>
                {/* Sky (Heaven) */}
                <View style={styles.mediaBox}>
                    <View style={styles.labelRow}>
                        <MaterialCommunityIcons name="white-balance-sunny" size={16} color="#FFD700" />
                        <Text style={styles.skyLabel}>AMOU</Text>
                    </View>
                    {item.sky ? (
                        <TouchableOpacity onPress={() => openDetails(item.sky)}>
                            <Image
                                source={{ uri: `${TMDB_IMAGE_BASE_URL}${item.sky.poster_url}` }}
                                style={styles.mediaPoster}
                            />
                            <Text style={styles.mediaTitle} numberOfLines={1}>{item.sky.title}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.emptyMediaPoster}>
                            <Text style={styles.emptyText}>Sem dados</Text>
                        </View>
                    )}
                </View>

                <View style={styles.vsContainer}>
                    <Text style={styles.vsText}>VS</Text>
                </View>

                {/* Hell */}
                <View style={styles.mediaBox}>
                    <View style={styles.labelRow}>
                        <MaterialCommunityIcons name="fire" size={16} color="#FF4500" />
                        <Text style={styles.hellLabel}>ODIOU</Text>
                    </View>
                    {item.hell ? (
                        <TouchableOpacity onPress={() => openDetails(item.hell)}>
                            <Image
                                source={{ uri: `${TMDB_IMAGE_BASE_URL}${item.hell.poster_url}` }}
                                style={styles.mediaPoster}
                            />
                            <Text style={styles.mediaTitle} numberOfLines={1}>{item.hell.title}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.emptyMediaPoster}>
                            <Text style={styles.emptyText}>Sem dados</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={socialFeed}
                keyExtractor={(item) => item.profile.id}
                renderItem={renderFeedItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyFeedText}>Ninguém por aqui ainda...</Text>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    headerContainer: {
        padding: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        marginTop: 10,
    },
    releaseCard: {
        width: 120,
        marginRight: 15,
    },
    releaseImage: {
        width: 120,
        height: 180,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    releaseTitle: {
        fontSize: 12,
        marginTop: 5,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 20,
    },
    userCard: {
        margin: 15,
        marginTop: 0,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 10,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    comparisonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mediaBox: {
        flex: 1,
        alignItems: 'center',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 5,
    },
    skyLabel: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    hellLabel: {
        color: '#FF4500',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    mediaPoster: {
        width: 100,
        height: 150,
        borderRadius: 6,
        backgroundColor: '#333',
    },
    emptyMediaPoster: {
        width: 100,
        height: 150,
        borderRadius: 6,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaTitle: {
        fontSize: 12,
        color: '#fff',
        marginTop: 5,
        textAlign: 'center',
        width: 100,
    },
    vsContainer: {
        paddingHorizontal: 10,
    },
    vsText: {
        color: '#555',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyText: {
        color: '#666',
        fontSize: 10,
    },
    emptyFeedText: {
        textAlign: 'center',
        color: '#888',
        marginTop: 50,
    }
});
