import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { DetailModalContent } from '../../components/DetailModalContent';

export const GenericModal = ({ route }: any) => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const { mediaId, mediaType } = route.params || {};

    if (!mediaId || !mediaType) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.text, { color: colors.text }]}>Parâmetros inválidos.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ color: colors.primary }}>Fechar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <DetailModalContent
            mediaId={mediaId}
            mediaType={mediaType}
            onClose={() => navigation.goBack()}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        fontSize: 18,
        marginBottom: 20,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginBottom: 15,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    closeButton: {
        padding: 10,
    },
    closeText: {
        fontSize: 16,
    },
});
