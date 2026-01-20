import React from 'react';
import { TouchableOpacity, Image, View, Text, StyleSheet } from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../services/tmdb';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const SearchResultCard = ({
    item,
    onPress,
    onQuickAdd,
    onMarkWatched,
    onAddEpisode,
    libraryItem
}: {
    item: any,
    onPress: (item: any) => void,
    onQuickAdd: (item: any) => void,
    onMarkWatched: (item: any) => void,
    onAddEpisode: (item: any) => void,
    libraryItem?: any
}) => {
    const libraryStatus = libraryItem?.status;

    const renderAction = () => {
        if (!libraryStatus) {
            return (
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => onQuickAdd(item)}>
                    <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#E50914" />
                </TouchableOpacity>
            );
        }

        if (libraryStatus === 'watched' || libraryStatus === 'finished') {
            return <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />;
        }

        // Active items (watchlist, watching, planned)
        return (
            <View style={styles.activeActions}>
                {item.media_type === 'movie' ? (
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => onMarkWatched(libraryItem)}>
                        <MaterialCommunityIcons name="check-circle-outline" size={28} color="#4CAF50" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => onAddEpisode(libraryItem)}>
                        <View style={styles.episodeBadge}>
                            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                            <Text style={styles.episodeAddText}>1</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <TouchableOpacity style={styles.searchCard} onPress={() => onPress(item)}>
            <Image
                source={{ uri: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/50x75' }}
                style={styles.searchPoster}
            />
            <View style={styles.searchInfo}>
                <Text style={styles.searchTitle}>{item.title || item.name}</Text>
                <Text style={styles.searchType}>
                    {item.media_type === 'movie' ? 'Filme' : 'Série'}
                    {libraryItem?.last_episode_seen > 0 && ` • Ep ${libraryItem.last_episode_seen}`}
                </Text>
            </View>
            <View style={styles.actionWrapper}>
                {renderAction()}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    searchCard: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomColor: '#333',
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    searchPoster: {
        width: 50,
        height: 75,
        borderRadius: 4,
        marginRight: 12,
        backgroundColor: '#333',
    },
    searchInfo: {
        flex: 1,
    },
    searchTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    searchType: {
        color: '#999',
        fontSize: 12,
        marginTop: 2,
    },
    actionWrapper: {
        paddingLeft: 10,
    },
    quickActionBtn: {
        padding: 8,
    },
    activeActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    episodeBadge: {
        backgroundColor: '#E50914',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    episodeAddText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
