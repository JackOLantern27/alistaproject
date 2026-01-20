import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TMDB_IMAGE_BASE_URL } from '../../services/tmdb';
import { DetailModalContent } from '../../components/DetailModalContent';
import { RatingModal } from '../../components/RatingModal';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { historyCache, CACHE_TTL, invalidateAllCaches } from '../../lib/dataCache';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_WIDTH = width / COLUMN_COUNT;
const POSTER_HEIGHT = ITEM_WIDTH * 1.5;

export const HistoryScreen = () => {
    const { session } = useAuth();
    const { colors } = useTheme();
    const [history, setHistory] = useState<any[]>(historyCache.history || []);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(historyCache.history.length === 0);

    // Rating Editing State
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [itemToRate, setItemToRate] = useState<any>(null);

    const fetchHistory = async () => {
        try {
            if (!session?.user) return;
            const { data, error } = await supabase
                .from('user_library')
                .select('*, media:media_id (*)')
                .eq('user_id', session.user.id)
                .eq('status', 'watched')
                .order('watched_at', { ascending: false });

            if (error) throw error;
            const fetchedHistory = data || [];
            setHistory(fetchedHistory);
            historyCache.history = fetchedHistory;
            historyCache.lastFetched = Date.now();
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível carregar o histórico.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            const isFresh = (now - historyCache.lastFetched) < CACHE_TTL;
            if (!isFresh || historyCache.history.length === 0) {
                fetchHistory();
            } else {
                setLoading(false);
            }
        }, [session])
    );

    const handleItemPress = (item: any) => {
        setSelectedItem(item);
        setModalVisible(true);
    };

    const handleRatingPress = (item: any) => {
        setItemToRate(item);
        setRatingModalVisible(true);
    };

    const handleRatingSubmit = async (rating: number, comment: string) => {
        if (!itemToRate) return;
        try {
            const { error } = await supabase
                .from('user_library')
                .update({
                    rating: rating,
                    review_text: comment || itemToRate.review_text
                })
                .eq('id', itemToRate.id);

            if (error) throw error;

            const updatedHistory = history.map(i =>
                i.id === itemToRate.id ? { ...i, rating, review_text: comment || i.review_text } : i
            );
            setHistory(updatedHistory);
            invalidateAllCaches();

        } catch (e) {
            Alert.alert('Erro', 'Falha ao atualizar avaliação.');
        }
    };

    const handleLongPress = (item: any) => {
        Alert.alert(
            'Remover do Histórico',
            `Deseja remover "${item.media.title}"?`,
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
                            const updatedHistory = history.filter(i => i.id !== item.id);
                            setHistory(updatedHistory);
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
        <TouchableOpacity
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            style={styles.gridItem}
        >
            <Image
                source={{ uri: `${TMDB_IMAGE_BASE_URL}${item.media.poster_url}` }}
                style={styles.gridPoster}
                resizeMode="cover"
            />
            <TouchableOpacity
                style={[styles.ratingBadge, item.rating === 0 && styles.unratedBadge]}
                onPress={() => handleRatingPress(item)}
            >
                {item.rating > 0 ? (
                    <>
                        <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                    </>
                ) : (
                    <Text style={styles.unratedText}>Avaliar</Text>
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );

    // Full-screen loader removed for smoother top-to-bottom feel

    return (
        <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Histórico</Text>
            </View>
            {loading && history.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#E50914" />
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={[styles.empty, { color: colors.text }]}>Histórico vazio.</Text>}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                {selectedItem && (
                    <DetailModalContent
                        mediaId={selectedItem.media.tmdb_id}
                        mediaType={selectedItem.media.media_type}
                        onClose={() => setModalVisible(false)}
                    />
                )}
            </Modal>

            {itemToRate && (
                <RatingModal
                    visible={ratingModalVisible}
                    title={itemToRate.media.title}
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
        backgroundColor: '#1a1a1a',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    list: {
        paddingBottom: 20,
    },
    gridItem: {
        width: ITEM_WIDTH,
        height: POSTER_HEIGHT,
        padding: 2,
    },
    gridPoster: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#333',
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        opacity: 0.6,
    },
    ratingBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    ratingText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    unratedBadge: {
        backgroundColor: 'rgba(229, 9, 20, 0.8)', // Netflix red style
    },
    unratedText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
