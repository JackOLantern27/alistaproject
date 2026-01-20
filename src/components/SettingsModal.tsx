import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { repairLibrary } from '../services/libraryService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onSaveFilters: (filters: any) => void;
}

const PROVIDERS = [
    { id: '8', name: 'Netflix', icon: 'netflix' },
    { id: '119', name: 'Prime Video', icon: 'movie-play' },
    { id: '337', name: 'Disney+', icon: 'video-vintage' },
    { id: '1899', name: 'Max', icon: 'play-network' },
    { id: '307', name: 'Globoplay', icon: 'television-classic' },
    { id: '350', name: 'Apple TV+', icon: 'apple' },
    { id: '283', name: 'Crunchyroll', icon: 'animation' },
];

const CERTIFICATIONS = ['L', '10', '12', '14', '16', '18'];

export const SettingsModal = ({ visible, onClose, onSaveFilters }: SettingsModalProps) => {
    const { session, signOut } = useAuth();
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [teuspuloFlix, setTeuspuloFlix] = useState(false);
    const [maxCertification, setMaxCertification] = useState('18');
    const [releaseStatus, setReleaseStatus] = useState('all'); // 'all', 'released', 'upcoming'
    const [minRating, setMinRating] = useState(0);
    const [isPublic, setIsPublic] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        loadSettings();
    }, [visible]);

    const loadSettings = async () => {
        try {
            const storedProviders = await AsyncStorage.getItem('user_providers');
            if (storedProviders) setSelectedProviders(JSON.parse(storedProviders));

            const storedFilters = await AsyncStorage.getItem('user_filters');
            if (storedFilters) {
                const filters = JSON.parse(storedFilters);
                setTeuspuloFlix(filters.teuspuloFlix || false);
                setMaxCertification(filters.maxCertification || '18');
                setReleaseStatus(filters.releaseStatus || 'all');
                setMinRating(filters.minRating || 0);
            }

            if (session?.user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('is_public')
                    .eq('id', session.user.id)
                    .single();
                if (data) setIsPublic(data.is_public);
            }
        } catch (e) { }
    };

    const toggleProvider = (id: string) => {
        setSelectedProviders(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        try {
            const filters = {
                teuspuloFlix,
                maxCertification,
                releaseStatus,
                minRating,
            };
            await AsyncStorage.setItem('user_providers', JSON.stringify(selectedProviders));
            await AsyncStorage.setItem('user_filters', JSON.stringify(filters));

            onSaveFilters({ providers: selectedProviders, ...filters });

            if (session?.user) {
                await supabase
                    .from('profiles')
                    .update({ is_public: isPublic })
                    .eq('id', session.user.id);
            }

            onClose();
        } catch (e) {
            Alert.alert('Erro', 'Falha ao salvar preferências.');
        }
    };

    const handleRepair = async () => {
        if (!session?.user) return;
        setRepairing(true);
        try {
            await repairLibrary(session.user.id, (msg) => setStatusMsg(msg));
            Alert.alert('Sucesso', 'Biblioteca sincronizada!');
        } catch (e) {
            Alert.alert('Erro', 'Falha na sincronização.');
        } finally {
            setRepairing(false);
            setStatusMsg('');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Configurações</Text>
                    <TouchableOpacity onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Streaming Section */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Meus Streamings</Text>
                        <View style={styles.teuspuloRow}>
                            <Text style={styles.teuspuloLabel}>TeuspuloFlix (Ver Tudo)</Text>
                            <Switch
                                value={teuspuloFlix}
                                onValueChange={setTeuspuloFlix}
                                trackColor={{ false: '#767577', true: '#E50914' }}
                            />
                        </View>
                    </View>
                    <Text style={styles.subtitle}>Selecione para filtrar recomendações</Text>

                    <View style={styles.providersGrid}>
                        {PROVIDERS.map(prov => {
                            const isSelected = selectedProviders.includes(prov.id);
                            return (
                                <TouchableOpacity
                                    key={prov.id}
                                    style={[styles.providerBadge, isSelected && styles.providerSelected]}
                                    onPress={() => toggleProvider(prov.id)}
                                    disabled={teuspuloFlix}
                                >
                                    <MaterialCommunityIcons
                                        name={prov.icon as any || 'movie'}
                                        size={20}
                                        color={isSelected ? '#fff' : '#ccc'}
                                    />
                                    <Text style={[styles.providerName, isSelected && styles.providerNameSelected]}>
                                        {prov.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.separator} />

                    {/* Advanced Filters */}
                    <Text style={styles.sectionTitle}>Filtros de Recomendações</Text>

                    <Text style={styles.filterLabel}>Classificação Máxima: {maxCertification}</Text>
                    <View style={styles.certificationGrid}>
                        {CERTIFICATIONS.map(cert => (
                            <TouchableOpacity
                                key={cert}
                                style={[styles.certBadge, maxCertification === cert && styles.certSelected]}
                                onPress={() => setMaxCertification(cert)}
                            >
                                <Text style={[styles.certText, maxCertification === cert && styles.certTextSelected]}>{cert}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterLabel}>Status de Lançamento</Text>
                    <View style={styles.statusRow}>
                        {['all', 'released', 'upcoming'].map(status => (
                            <TouchableOpacity
                                key={status}
                                style={[styles.statusBadge, releaseStatus === status && styles.statusSelected]}
                                onPress={() => setReleaseStatus(status)}
                            >
                                <Text style={[styles.statusText, releaseStatus === status && styles.statusTextSelected]}>
                                    {status === 'all' ? 'Todos' : status === 'released' ? 'Lançados' : 'Em breve'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterLabel}>Avaliação Mínima: {minRating.toFixed(1)}</Text>
                    <View style={styles.ratingRow}>
                        {[0, 2, 4, 6, 7, 8, 9].map(val => (
                            <TouchableOpacity
                                key={val}
                                style={[styles.ratingBadge, minRating === val && styles.ratingSelected]}
                                onPress={() => setMinRating(val)}
                            >
                                <Text style={[styles.ratingText, minRating === val && styles.ratingTextSelected]}>{val}+</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.separator} />

                    {/* Repair Section */}
                    <Text style={styles.sectionTitle}>Manutenção</Text>
                    <TouchableOpacity
                        style={styles.repairButton}
                        onPress={handleRepair}
                        disabled={repairing}
                    >
                        {repairing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <MaterialCommunityIcons name="tools" size={20} color="#fff" />
                        )}
                        <Text style={styles.repairText}>
                            {repairing ? ' ...' : ' Corrigir/Sincronizar Biblioteca'}
                        </Text>
                    </TouchableOpacity>
                    {statusMsg ? <Text style={styles.repairStatusText}>{statusMsg}</Text> : null}

                    <View style={styles.separator} />

                    {/* Privacy Section */}
                    <Text style={styles.sectionTitle}>Privacidade</Text>
                    <View style={styles.teuspuloRow}>
                        <Text style={styles.privacyLabel}>Torne suas reviews públicas</Text>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: '#767577', true: '#E50914' }}
                        />
                    </View>
                    <Text style={styles.subtitle}>Ao ativar, outros usuários poderão ver seus filmes favoritos e odiados.</Text>

                    <View style={styles.separator} />

                    {/* Sign Out Section */}
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={signOut}
                    >
                        <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                        <Text style={styles.logoutText}>Sair da Conta</Text>
                    </TouchableOpacity>

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveText}>Salvar e Fechar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    teuspuloRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    teuspuloLabel: {
        color: '#888',
        fontSize: 12,
    },
    privacyLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    filterLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 15,
    },
    certificationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    certBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#333',
        minWidth: 40,
        alignItems: 'center',
    },
    certSelected: {
        backgroundColor: '#E50914',
    },
    certText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    certTextSelected: {
        color: '#fff',
    },
    statusRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statusBadge: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#333',
    },
    statusSelected: {
        backgroundColor: '#E50914',
    },
    statusText: {
        color: '#ccc',
        fontSize: 12,
    },
    statusTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    ratingRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    ratingBadge: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 4,
        backgroundColor: '#333',
    },
    ratingSelected: {
        backgroundColor: '#E50914',
    },
    ratingText: {
        color: '#ccc',
        fontSize: 12,
    },
    ratingTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E50914',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 15,
    },
    providersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    providerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    providerSelected: {
        backgroundColor: '#E50914',
        borderColor: '#ff4d4d',
    },
    providerName: {
        color: '#ccc',
        marginLeft: 8,
        fontSize: 14,
    },
    providerNameSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 25,
    },
    repairButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#444',
        padding: 15,
        borderRadius: 8,
        justifyContent: 'center',
    },
    repairText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 10,
    },
    repairStatusText: {
        color: '#888',
        marginTop: 10,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#333',
        backgroundColor: '#1a1a1a',
    },
    saveBtn: {
        backgroundColor: '#E50914',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        padding: 15,
        borderRadius: 8,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E50914',
        marginBottom: 30,
    },
    logoutText: {
        color: '#E50914',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 14,
    },
});
