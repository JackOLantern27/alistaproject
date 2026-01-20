import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../services/tmdb';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SeriesCardProps {
    item: any;
    isFirst?: boolean;
    status: 'active' | 'waiting' | 'finished';
    onAddEpisode: (id: number, current: number, total: number) => void;
    getSeasonAndEpisode: (totalSeen: number, seasons: any[]) => { season: number; episode: number };
    onPress?: (item: any) => void;
}

export const SeriesCard = ({ item, isFirst, status, onAddEpisode, getSeasonAndEpisode, onPress }: SeriesCardProps) => {
    const media = item.media;
    const seasons = item.seasons || [];
    const { season, episode } = getSeasonAndEpisode(item.last_episode_seen, seasons);

    const progress = item.total_episodes > 0 ? item.last_episode_seen / item.total_episodes : 0;
    const remaining = item.total_episodes - item.last_episode_seen;

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.contentContainer}
                onPress={() => onPress && onPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.posterContainer}>
                    <Image
                        source={{ uri: `${TMDB_IMAGE_BASE_URL}${media.poster_url}` }}
                        style={styles.poster}
                    />
                    {status === 'active' && isFirst && (
                        <View style={styles.badge}>
                            <MaterialCommunityIcons name="clock-time-four" size={12} color="#fff" />
                        </View>
                    )}
                </View>

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{media.title}</Text>

                    {status === 'active' ? (
                        <>
                            <Text style={styles.watchingText}>
                                Vendo: <Text style={styles.boldWhite}>T{season} • Ep {episode}</Text>
                            </Text>
                            <Text style={styles.remainingText}>Faltam {remaining} episódios</Text>

                            <View style={styles.progressTrack}>
                                <View style={[styles.progressBar, { width: `${Math.min(progress * 100, 100)}%` }]} />
                            </View>
                        </>
                    ) : status === 'waiting' ? (
                        <>
                            <Text style={styles.uptodateText}>Você está em dia!</Text>
                            {item.next_episode_to_air && (
                                <Text style={styles.nextDateText}>
                                    Volta em: {new Date(item.next_episode_to_air.air_date).toLocaleDateString('pt-BR')}
                                </Text>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={[styles.uptodateText, { color: '#4CAF50' }]}>Série Finalizada!</Text>
                            <Text style={styles.nextDateText}>Todos os episódios assistidos.</Text>
                        </>
                    )}
                </View>
            </TouchableOpacity>

            {(status === 'active' || status === 'finished') && (
                <TouchableOpacity
                    style={[styles.addButton, status === 'finished' && { backgroundColor: '#E50914', borderColor: '#E50914' }]}
                    onPress={() => onAddEpisode(item.id, item.last_episode_seen, item.total_episodes)}
                >
                    <MaterialCommunityIcons
                        name={status === 'finished' ? "star" : "plus"}
                        size={24}
                        color="#fff"
                    />
                    <Text style={styles.addText}>{status === 'finished' ? 'Nota' : 'Ep'}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginBottom: 15, // Spacing between cards
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    posterContainer: {
        position: 'relative',
    },
    poster: {
        width: 60,
        height: 90,
        borderRadius: 4,
        backgroundColor: '#333',
    },
    badge: {
        position: 'absolute',
        top: -4,
        left: -4,
        backgroundColor: '#E50914',
        borderRadius: 10,
        padding: 4,
        zIndex: 10,
    },
    info: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    watchingText: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 2,
    },
    boldWhite: {
        color: '#fff',
        fontWeight: 'bold',
    },
    remainingText: {
        color: '#666', // dark grey
        fontSize: 12,
        marginBottom: 6,
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#444',
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#E50914',
    },
    uptodateText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
    },
    nextDateText: {
        color: '#ccc',
        fontSize: 12,
    },
    addButton: {
        width: 50,
        height: 50,
        backgroundColor: '#333',
        borderColor: '#444',
        borderWidth: 1,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    addText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: -2,
    },
});
