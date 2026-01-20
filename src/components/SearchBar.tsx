import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { searchMulti, TMDB_IMAGE_BASE_URL } from '../services/tmdb';
import { useTheme } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SearchBarProps {
    onAdd: (item: any) => void;
}

export const SearchBar = ({ onAdd }: SearchBarProps) => {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length > 2) {
                setLoading(true);
                const data = await searchMulti(query);
                // Filter only movie and tv
                const filtered = data?.results?.filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv') || [];
                setResults(filtered);
                setLoading(false);
                setShowResults(true);
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (item: any) => {
        onAdd(item);
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={24} color={colors.text} style={styles.icon} />
                <TextInput
                    placeholder="Adicionar filme ou série..."
                    placeholderTextColor="#888"
                    style={[styles.input, { color: colors.text }]}
                    value={query}
                    onChangeText={setQuery}
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {showResults && results.length > 0 && (
                <View style={[styles.resultsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id.toString()}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                                <Image
                                    source={{ uri: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/50' }}
                                    style={styles.poster}
                                />
                                <View style={styles.resultContent}>
                                    <Text style={[styles.title, { color: colors.text }]}>
                                        {item.title || item.name}
                                    </Text>
                                    <Text style={[styles.subtitle, { color: colors.text }]}>
                                        {item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || 'N/A'} • {item.media_type === 'movie' ? 'Filme' : 'Série'}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 100, // Essential for overlay
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
    },
    resultsList: {
        position: 'absolute',
        top: 55,
        left: 0,
        right: 0,
        maxHeight: 300,
        borderWidth: 1,
        borderTopWidth: 0,
        borderRadius: 8,
        elevation: 5,
        zIndex: 1000,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    poster: {
        width: 40,
        height: 60,
        borderRadius: 4,
        marginRight: 10,
        backgroundColor: '#333',
    },
    resultContent: {
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.7,
    },
});
