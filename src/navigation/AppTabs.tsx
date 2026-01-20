import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SeriesScreen } from '../screens/tabs/SeriesScreen';
import { WatchlistScreen } from '../screens/tabs/WatchlistScreen';
import { HistoryScreen } from '../screens/tabs/HistoryScreen';
import { HomeScreen } from '../screens/tabs/HomeScreen';
import { SocialScreen } from '../screens/tabs/SocialScreen';

const Tab = createBottomTabNavigator();

export const AppTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                    let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'movie';

                    if (route.name === 'Início') {
                        iconName = 'home-variant';
                    } else if (route.name === 'Séries') {
                        iconName = 'television-classic';
                    } else if (route.name === 'Watchlist') {
                        iconName = 'eye-plus-outline';
                    } else if (route.name === 'Histórico') {
                        iconName = 'history';
                    } else if (route.name === 'Social') {
                        iconName = 'account-group';
                    }

                    return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Início" component={HomeScreen} options={{ headerShown: false }} />
            <Tab.Screen name="Séries" component={SeriesScreen} options={{ headerShown: false }} />
            <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ headerShown: false }} />
            <Tab.Screen name="Histórico" component={HistoryScreen} options={{ headerShown: false }} />
            <Tab.Screen name="Social" component={SocialScreen} options={{ headerShown: true, title: 'O que tá pegando?' }} />
        </Tab.Navigator>
    );
};
