import React from 'react';
import { TouchableOpacity, Image, Text, StyleSheet, View } from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../services/tmdb';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const RecommendationCard = ({ item, onPress }: { item: any, onPress: (item: any) => void }) => (
    <TouchableOpacity style={styles.recCard} onPress={() => onPress(item)}>
        <View style={styles.posterContainer}>
            <Image
                source={{ uri: item.poster_url ? `${TMDB_IMAGE_BASE_URL}${item.poster_url}` : 'https://via.placeholder.com/120x180' }}
                style={styles.recPoster}
            />
            <View style={styles.indicators}>
                {item.availability === 'streaming' && item.providerColors?.map((color: string, i: number) => (
                    <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                ))}
                {item.availability === 'theater' && (
                    <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                )}
                {item.availability === 'none' && (
                    <MaterialCommunityIcons name="close-circle" size={14} color="#ff4444" />
                )}
            </View>
        </View>
        <Text style={styles.recTitle} numberOfLines={2}>{item.title || item.name}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    recCard: {
        width: 120,
        marginRight: 12,
        alignItems: 'center',
    },
    posterContainer: {
        width: 120,
        height: 180,
        borderRadius: 6,
        marginBottom: 6,
        overflow: 'hidden',
        position: 'relative',
    },
    recPoster: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
    },
    indicators: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
        gap: 3,
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    recTitle: {
        color: '#fff',
        fontSize: 13,
        textAlign: 'center',
    },
});
