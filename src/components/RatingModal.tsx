import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

interface RatingModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<void>;
    title: string;
}

export const RatingModal = ({ visible, onClose, onSubmit, title }: RatingModalProps) => {
    const { colors } = useTheme();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleStarPress = (value: number) => {
        setRating(value);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        await onSubmit(rating, comment);
        setSubmitting(false);
        onClose();
        // Reset fields
        setRating(0);
        setComment('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Avaliar {title}</Text>

                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <View key={star} style={styles.starWrapper}>
                                <MaterialCommunityIcons
                                    name={
                                        rating >= star
                                            ? 'star'
                                            : rating >= star - 0.5
                                                ? 'star-half-full'
                                                : 'star-outline'
                                    }
                                    size={32}
                                    color={rating >= star - 0.5 ? '#FFD700' : colors.text}
                                />
                                {/* Left Half Touch */}
                                <TouchableOpacity
                                    style={styles.halfStarLeft}
                                    onPress={() => handleStarPress(star - 0.5)}
                                />
                                {/* Right Half Touch */}
                                <TouchableOpacity
                                    style={styles.halfStarRight}
                                    onPress={() => handleStarPress(star)}
                                />
                            </View>
                        ))}
                    </View>

                    <TextInput
                        placeholder="Comentário (opcional)"
                        placeholderTextColor="#888"
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        multiline
                        numberOfLines={3}
                        value={comment}
                        onChangeText={setComment}
                    />

                    <View style={styles.buttons}>
                        <TouchableOpacity style={styles.buttonCancel} onPress={onClose} disabled={submitting}>
                            <Text style={{ color: colors.text }}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.buttonSubmit, { backgroundColor: colors.primary }]} onPress={handleSubmit} disabled={submitting}>
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Finalizar</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        borderRadius: 12,
        padding: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 15,
    },
    buttonCancel: {
        padding: 10,
    },
    buttonSubmit: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    submitText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    starWrapper: {
        position: 'relative',
        width: 32,
        height: 32,
    },
    halfStarLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 16,
        height: 32,
        zIndex: 1,
    },
    halfStarRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        width: 16,
        height: 32,
        zIndex: 1,
    },
});
