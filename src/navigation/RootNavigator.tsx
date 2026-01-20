import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { AppTabs } from './AppTabs';
// ... imports
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
// ...
import { GenericModal } from '../screens/modals/GenericModal';
// ...
// ... rest of imports
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
    const { session, loading } = useAuth();
    const scheme = useColorScheme();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <NavigationContainer theme={DarkTheme}>
            <Stack.Navigator>
                {session ? (
                    <>
                        <Stack.Screen name="AppTabs" component={AppTabs} options={{ headerShown: false }} />
                        <Stack.Screen
                            name="GenericModal"
                            component={GenericModal}
                            options={{ presentation: 'modal', title: 'Modal' }}
                        />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true, title: 'Criar Conta' }} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};
