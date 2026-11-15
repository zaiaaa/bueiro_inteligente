import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../services/api';
import { calcularDistancia } from '../services/calcularDistancia';

const BUEIRO = {
  latitude: -23.4990588,
  longitude: -47.4574044,
};

const ALERTA = '#E53935';
const ALERTA_SUAVE = 'rgba(229, 57, 53, 0.16)';
const ONLINE = '#2E9E5B';
const POLLING_INTERVAL = 10_000; // Atualização a cada 10 segundos

// Handler de notificações (falha silenciosamente no Expo Go SDK 53+)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log('Notifications indisponível (Expo Go):', e);
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [alagamentosAtivos, setAlagamentosAtivos] = useState<any[]>([]);
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);

  /* ─── Notificação in-app (banner animado) ─── */
  const [bannerData, setBannerData] = useState<{
    mensagem: string;
  } | null>(null);
  const bannerAnim = useRef(new Animated.Value(-160)).current;
  const knownIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: -160,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setBannerData(null));
  }, [bannerAnim]);

  const showBanner = useCallback(
    (mensagem: string) => {
      // Cancelar dismiss anterior se existir
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);

      setBannerData({ mensagem });
      bannerAnim.setValue(-160);

      Animated.spring(bannerAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();

      // Auto-dismiss após 6 segundos
      bannerTimerRef.current = setTimeout(dismissBanner, 6000);
    },
    [bannerAnim, dismissBanner],
  );

  /* ─── Notificação push local ─── */
  const enviarNotificacao = useCallback(async (novos: any[]) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;

      if (status !== 'granted') {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync();
        finalStatus = newStatus;
      }

      if (finalStatus !== 'granted') return;

      for (const alagamento of novos) {
        const endereco = alagamento.endereco;
        const local = endereco
          ? `${endereco.street || 'Rua desconhecida'}${
              endereco.district ? `, ${endereco.district}` : ''
            }`
          : 'localização desconhecida';

        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 NOVO ALAGAMENTO DETECTADO',
            body: `Bueiro ${alagamento.codigoDispositivo} — ${local}`,
            sound: 'default',
          },
          trigger: null, // Imediata
        });
      }
    } catch (e) {
      // Falha esperada no Expo Go SDK 53+
      console.log('Notificação push não enviada:', e);
    }
  }, []);

  /* ─── Buscar alagamentos (com detecção de novos) ─── */
  const fetchAlagamentos = useCallback(async () => {
    try {
      const { data: alagamentos } = await api.get('/alagamentos_ativos');

      const alagamentosComEndereco = await Promise.all(
        alagamentos.map(async (alagamento: any) => {
          try {
            const endereco = await Location.reverseGeocodeAsync({
              latitude: Number(alagamento.latitude),
              longitude: Number(alagamento.longitude),
            });

            return {
              ...alagamento,
              endereco: endereco[0],
            };
          } catch (error) {
            console.log('Erro ao buscar endereço:', error);

            return {
              ...alagamento,
              endereco: null,
            };
          }
        }),
      );

      // Detectar novos alagamentos comparando IDs
      if (!isFirstLoadRef.current) {
        const novos = alagamentosComEndereco.filter(
          (a: any) => !knownIdsRef.current.has(a.id),
        );

        if (novos.length > 0) {
          const qtd = novos.length;
          const msg =
            qtd === 1
              ? `Novo alagamento: Bueiro ${novos[0].codigoDispositivo}`
              : `${qtd} novos alagamentos detectados!`;

          showBanner(msg);
          enviarNotificacao(novos);
        }
      }

      // Atualizar IDs conhecidos
      knownIdsRef.current = new Set(
        alagamentosComEndereco.map((a: any) => a.id),
      );
      isFirstLoadRef.current = false;

      setAlagamentosAtivos(alagamentosComEndereco);
    } catch (error) {
      console.log('Erro ao buscar alagamentos:', error);
    }
  }, [showBanner, enviarNotificacao]);

  /* ─── Effects ─── */
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
    }

    getLocation();
    fetchAlagamentos();

    // Polling em tempo real
    const interval = setInterval(fetchAlagamentos, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlagamentos]);

  const distancia = userLocation
    ? calcularDistancia(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        BUEIRO.latitude,
        BUEIRO.longitude,
      )
    : null;

  return (
    <ThemedView style={styles.container}>
      {/* Banner de notificação in-app */}
      {bannerData && (
        <Animated.View
          style={[
            styles.notifBanner,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <Pressable
            style={styles.notifContent}
            onPress={dismissBanner}
          >
            <View style={styles.notifIcon}>
              <ThemedText style={styles.notifIconText}>🚨</ThemedText>
            </View>

            <View style={styles.notifTextWrap}>
              <ThemedText type="smallBold" style={styles.notifTitle}>
                Alerta de Alagamento
              </ThemedText>
              <ThemedText type="small" style={styles.notifMsg}>
                {bannerData.mensagem}
              </ThemedText>
            </View>
          </Pressable>
        </Animated.View>
      )}

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
                description={`📍 ${alagamento.endereco?.street || 'Rua não encontrada'}${
                  alagamento.endereco?.streetNumber
                    ? `, ${alagamento.endereco.streetNumber}`
                    : ''
                }\nStatus: ${alagamento.status}`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.markerHalo}>
                  <View style={styles.markerCore} />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>

        {alagamentosAtivos.length === 0 && (
          <ThemedView
            type="backgroundElement"
            style={styles.emptyCard}
          >
            <ThemedText style={styles.emptyIcon}>
                🌧️
            </ThemedText>

            <ThemedText type="smallBold">
              Nenhum alagamento detectado
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ textAlign: 'center' }}
            >
              Não existem registros de alagamentos ativos no momento.
            </ThemedText>
          </ThemedView>
        )}    


        {/* Status dos alagamentos */}
        {alagamentosAtivos.map((alagamento) => {
          const distanciaAlagamento = userLocation
            ? calcularDistancia(
                userLocation.coords.latitude,
                userLocation.coords.longitude,
                Number(alagamento.latitude),
                Number(alagamento.longitude),
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
                  <ThemedText type="smallBold">
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
                    type="smallBold"
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
                    Localização
                  </ThemedText>

                  <ThemedText type="smallBold">
                    {alagamento.endereco?.street || 'Rua não encontrada'},
                    {' '}
                    {alagamento.endereco?.district || ''}
                  </ThemedText>
                </View>

                <View style={styles.metaItem}>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                  >
                    Distância
                  </ThemedText>

                  <ThemedText type="smallBold">
                    {distanciaAlagamento !== null
                      ? `${distanciaAlagamento.toFixed(2)} km`
                      : 'Calculando...'}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
          );
        })}

        {/* Histórico
        <Pressable
          onPress={() => router.push('/historico')}
          style={({ pressed }) => [
            styles.historyButton,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            style={[styles.historyText, { color: '#FFFFFF' }]}
          >
            Ver histórico
          </ThemedText>
        </Pressable> */}
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
    height: 300,
    width: '100%',
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

  /* Banner de notificação in-app */
  notifBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },

  notifContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: ALERTA,
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notifIconText: {
    fontSize: 20,
    lineHeight: 26,
  },

  notifTextWrap: {
    flex: 1,
    gap: 2,
  },

  notifTitle: {
    color: '#FFFFFF',
  },

  notifMsg: {
    color: 'rgba(255, 255, 255, 0.9)',
  },

  emptyCard: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  emptyIcon: {
    fontSize: 42,
    lineHeight: 58,
    textAlign: 'center',
    includeFontPadding: true,
    overflow: 'visible',
  },
});
