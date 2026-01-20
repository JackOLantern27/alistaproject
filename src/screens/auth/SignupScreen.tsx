import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

export const SignupScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const { signUpWithEmail, loading } = useAuth();
    const { colors } = useTheme();

    const handleSignup = async () => {
        if (!email || !password || !displayName) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos.');
            return;
        }
        const { error, data } = await signUpWithEmail(email, password);
        if (error) {
            Alert.alert('Erro ao criar conta', error.message);
        } else {
            // Create profile
            if (data?.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        { id: data.user.id, display_name: displayName, is_public: false }
                    ]);

                if (profileError) {
                    console.error('Error creating profile:', profileError);
                }
            }
            Alert.alert('Sucesso', 'Conta criada com sucesso! Verifique seu e-mail se necessário.');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text }]}>Criar Conta</Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        placeholder="Como posso te chamar?"
                        placeholderTextColor="#888"
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={displayName}
                        onChangeText={setDisplayName}
                        autoCapitalize="words"
                    />
                    <TextInput
                        placeholder="E-mail"
                        placeholderTextColor="#888"
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        placeholder="Senha"
                        placeholderTextColor="#888"
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>{loading ? 'Criando...' : 'Cadastrar'}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    form: {
        width: '100%',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
