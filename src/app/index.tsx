import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { calcularDistancia } from '../services/calcularDistancia';

const BUEIRO = {
  latitude: -23.4990588,
  longitude: -47.4574044,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();

const [userLocation, setUserLocation] =
  useState<Location.LocationObject | null>(null);

  useEffect(() => {
    async function getLocation() {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.log('Permissão de localização negada');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation(location);

      console.log('Latitude:', location.coords.latitude);
      console.log('Longitude:', location.coords.longitude);
    }

    getLocation();
  }, []);

  const testarNotificacao = async () => {
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      alert('Permissão para notificações não concedida.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 ALAGAMENTO DETECTADO',
        body: 'O bueiro BUE-001 registrou nível de alagamento.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
  };

  const distancia = userLocation
  ? calcularDistancia(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      BUEIRO.latitude,
      BUEIRO.longitude
    )
  : null;

  return (
    <ThemedView style={styles.container}>

      {/* Cabeçalho */}
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">
          Bueiro Inteligente
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Monitoramento em tempo real
        </ThemedText>
      </ThemedView>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          showsUserLocation={true}
          initialRegion={{
            latitude: BUEIRO.latitude,
            longitude: BUEIRO.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={BUEIRO}
            title="ALAGAMENTO REGISTRADO"
            description="Centro - Sorocaba"
            pinColor="red"
          />
        </MapView>
      </View>

      {/* Status */}
      <ThemedView
        type="backgroundElement"
        style={styles.statusCard}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />

          <View style={styles.statusInfo}>
            <ThemedText type="smallbold">
              Alagamento detectado
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              BUE-001
            </ThemedText>
            {distancia !== null && (
              <ThemedText
              type="small"
              themeColor="textSecondary">
              Distância: {distancia.toFixed(2)} km
              </ThemedText>
            )}
          </View>
        </View>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.address}
        >
          📍 Centro - Sorocaba/SP
        </ThemedText>
      </ThemedView>

      {/* Histórico */}
      <Pressable
        onPress={() => router.push('/historico')}
        style={({ pressed }) => [
          styles.historyButton,
          {
            backgroundColor: '#727272',
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText
          style={styles.historyText}
          lightColor="#FFFFFF"
          darkColor="#FFFFFF"
        >
          📋  Ver histórico
        </ThemedText>
      </Pressable>

      <Pressable
  onPress={testarNotificacao}
  style={({ pressed }) => [
    styles.historyButton,
    {
      backgroundColor: theme.link,
    },
    pressed && styles.pressed,
  ]}
>
  <ThemedText
    style={styles.historyText}
    lightColor="#FFFFFF"
    darkColor="#FFFFFF"
  >
    🔔 Testar notificação
  </ThemedText>
</Pressable>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },

  header: {
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },

  mapContainer: {
    height: 300,
    borderRadius: Spacing.four,
    overflow: 'hidden',

    // Android
    elevation: 4,

    // iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  map: {
    flex: 1,
  },

  statusCard: {
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E53935',
    marginRight: Spacing.three,
  },

  statusInfo: {
    gap: 2,
  },

  address: {
    marginTop: Spacing.three,
  },

  historyButton: {
    height: 54,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },

  historyText: {
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.7,
  },
});