import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface EditProgressModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (newEpisodeCount: number) => Promise<void>;
    currentEpisode: number;
    totalEpisodes: number;
    title: string;
}

export const EditProgressModal = ({ visible, onClose, onSave, currentEpisode, totalEpisodes, title }: EditProgressModalProps) => {
    const [episode, setEpisode] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            setEpisode(String(currentEpisode));
        }
    }, [visible, currentEpisode]);

    const handleSave = async () => {
        const val = parseInt(episode, 10);
        if (isNaN(val) || val < 0) return;

        // Cap at total? Or allow override? 
        // User asked to fix "misclick", implying setting it back. 
        // If they set > total, it handles as completion in logic usually.
        // Let's rely on the parent logic to handle bounds if strict, but generally allow free edit for flexibility.

        setLoading(true);
        await onSave(val);
        setLoading(false);
        onClose();
    };

    const increment = () => setEpisode(prev => String(Math.min(parseInt(prev || '0') + 1, totalEpisodes)));
    const decrement = () => setEpisode(prev => String(Math.max(parseInt(prev || '0') - 1, 0)));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Editar Progresso</Text>
                    <Text style={styles.subtitle}>{title}</Text>

                    <View style={styles.inputContainer}>
                        <TouchableOpacity onPress={decrement} style={styles.iconBtn}>
                            <MaterialCommunityIcons name="minus" size={24} color="#E50914" />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            value={episode}
                            onChangeText={setEpisode}
                            keyboardType="numeric"
                            selectTextOnFocus
                        />
                        <Text style={styles.totalText}>/ {totalEpisodes}</Text>

                        <TouchableOpacity onPress={increment} style={styles.iconBtn}>
                            <MaterialCommunityIcons name="plus" size={24} color="#E50914" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttons}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.btnText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
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
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '85%',
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 10,
    },
    iconBtn: {
        padding: 10,
    },
    input: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        minWidth: 50,
    },
    totalText: {
        color: '#666',
        fontSize: 18,
        marginHorizontal: 5,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#333',
    },
    saveBtn: {
        backgroundColor: '#E50914',
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
