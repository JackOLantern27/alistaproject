import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Dimensions, View } from 'react-native';

interface ToastProps {
    visible: boolean;
    message: string;
    onHide: () => void;
    duration?: number;
}

export const Toast = ({ visible, message, onHide, duration = 3000 }: ToastProps) => {
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            // Slide Down
            Animated.spring(slideAnim, {
                toValue: 50,
                useNativeDriver: true,
                tension: 20,
                friction: 7
            }).start();

            // Auto Hide
            const timer = setTimeout(() => {
                hide();
            }, duration);

            return () => clearTimeout(timer);
        } else {
            hide();
        }
    }, [visible]);

    const hide = () => {
        Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true
        }).start(() => {
            onHide();
        });
    };

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.content}>
                <Text style={styles.text}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
    },
    content: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#4CAF50',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    text: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
    }
});
