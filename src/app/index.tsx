import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as Location from 'expo-location';
// import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { api } from "../services/api";
import { calcularDistancia } from '../services/calcularDistancia';

const BUEIRO = {
  latitude: -23.4990588,
  longitude: -47.4574044,
};

const ALERTA = '#E53935';
const ALERTA_SUAVE = 'rgba(229, 57, 53, 0.16)';
const ONLINE = '#2E9E5B';

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });  Comentar o notificacoes porque o expo Go nao suporta mais a partir do SDK53

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [alagamentosAtivos, setAlagamentosAtivos] = useState<any[]>([]);
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

    async function fetchData() {
      const {data: alagamentos} = await api.get("/alagamentos_ativos")
      setAlagamentosAtivos(alagamentos);
    }

    fetchData();
    getLocation();
  }, []);

  console.log("Alagamentos ativos:", alagamentosAtivos);

  // const testarNotificacao = async () => {
  //   const { status } = await Notifications.requestPermissionsAsync();

  //   if (status !== 'granted') {
  //     alert('Permissão para notificações não concedida.');
  //     return;
  //   }

  //   await Notifications.scheduleNotificationAsync({
  //     content: {
  //       title: '🚨 ALAGAMENTO DETECTADO',
  //       body: 'O bueiro BUE-001 registrou nível de alagamento.',
  //       sound: 'default',
  //     },
  //     trigger: {
  //       type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
  //       seconds: 2,
  //     },
  //   });
  // };

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
      <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
          Bueiro Inteligente
        </ThemedText>

        <View style={styles.subHeader}>
          <ThemedText type="small" themeColor="textSecondary">
            Sorocaba, SP
          </ThemedText>

          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <ThemedText type="small" style={styles.liveText}>
              Ao vivo
            </ThemedText>
          </View>
        </View>
      </View>

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
          
        {alagamentosAtivos.map((alagamento) => (
          <Marker
            key={alagamento.id}
            coordinate={{
              latitude: Number(alagamento.latitude),
              longitude: Number(alagamento.longitude),
            }}
            title={`ALAGAMENTO - ${alagamento.codigoDispositivo}`}
            description={`Status: ${alagamento.status}`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.markerHalo}>
              <View style={styles.markerCore} />
            </View>
          </Marker>
        ))}

        </MapView>
      </View>

            {/* Status dos alagamentos */}
      {alagamentosAtivos.map((alagamento) => {
        const distanciaAlagamento = userLocation
          ? calcularDistancia(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              Number(alagamento.latitude),
              Number(alagamento.longitude)
            )
          : null;

        return (
          <ThemedView
            key={alagamento.id}
            type="backgroundElement"
            style={styles.statusCard}
          >
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <ThemedText style={styles.statusIconText}>
                  ⚠️
                </ThemedText>
              </View>

              <View style={styles.statusInfo}>
                <ThemedText type="smallbold">
                  Alagamento detectado
                </ThemedText>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Bueiro {alagamento.codigoDispositivo}
                </ThemedText>
              </View>

              <View style={styles.badge}>
                <ThemedText
                  type="smallbold"
                  style={styles.badgeText}
                >
                  {alagamento.status}
                </ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Coordenadas
                </ThemedText>

                <ThemedText type="smallbold">
                  {Number(alagamento.latitude).toFixed(5)},
                  {' '}
                  {Number(alagamento.longitude).toFixed(5)}
                </ThemedText>
              </View>

              <View style={styles.metaItem}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Distância
                </ThemedText>

                <ThemedText type="smallbold">
                  {distanciaAlagamento !== null
                    ? `${distanciaAlagamento.toFixed(2)} km`
                    : 'Calculando...'}
                </ThemedText>
              </View>
            </View>
          </ThemedView>
        );
      })}

      {/* Histórico */}
      <Pressable
        onPress={() => router.push('/historico')}
        style={({ pressed }) => [
          styles.historyButton,
          pressed && styles.pressed,
        ]}
      >
        <ThemedText
          style={styles.historyText}
          lightColor="#FFFFFF"
          darkColor="#FFFFFF"
        >
          Ver histórico
        </ThemedText>
      </Pressable>

    </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.four,
  },


  /* Cabeçalho */
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
  },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(46, 158, 91, 0.14)',
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ONLINE,
  },

  liveText: {
    color: ONLINE,
    fontWeight: '600',
  },

  /* Mapa */
  mapContainer: {
    flex: 1,
    minHeight: 300,
    borderRadius: 24,
    overflow: 'hidden',
  },

  map: {
    flex: 1,
  },

  markerHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ALERTA_SUAVE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  markerCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ALERTA,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  /* Card de status */
  statusCard: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 24,
  },

  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ALERTA_SUAVE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusIconText: {
    fontSize: 20,
    lineHeight: 26,
  },

  statusInfo: {
    flex: 1,
    gap: 2,
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: ALERTA,
  },

  badgeText: {
    color: '#FFFFFF',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
    marginVertical: Spacing.three,
  },

  metaRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },

  metaItem: {
    flex: 1,
    gap: 2,
  },

  /* Botão histórico */
  historyButton: {
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
    backgroundColor: '#3C3C3C',
  },

  historyText: {
    fontWeight: '700',
    fontSize: 16,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
