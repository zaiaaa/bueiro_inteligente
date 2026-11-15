import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/services/api';

/* ─── Cores ─── */
const ALERTA = '#E53935';
const ALERTA_SUAVE = 'rgba(229, 57, 53, 0.16)';
const RESOLVIDO = '#2E9E5B';
const RESOLVIDO_SUAVE = 'rgba(46, 158, 91, 0.14)';
const CHUVA = '#3B82F6';
const CHUVA_SUAVE = 'rgba(59, 130, 246, 0.16)';

/* ─── Tipos ─── */
type Alagamento = {
  id: number;
  codigoDispositivo: string;
  latitude: string;
  longitude: string;
  status: string;
  inicio?: string;
  fim?: string;
  endereco?: Location.LocationGeocodedAddress | null;
};

/* ─── Helpers ─── */
function formatarData(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

function formatarDataFim(iso?: string) {
  if (!iso) return '—';

  const d = new Date(iso);
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000);

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

function calcularDuracao(inicio?: string, fim?: string) {
  if (!inicio || !fim) return null;
  const diff = new Date(fim).getTime() - new Date(inicio).getTime();
  if (diff <= 0) return null;
  const minutos = Math.floor(diff / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`;
}

function statusConfig(status: string) {
  const lower = status.toLowerCase();
  if (lower === 'ativo' || lower === 'em andamento') {
    return { label: status, cor: ALERTA, corSuave: ALERTA_SUAVE, icone: '⚠️' };
  }
  if (lower === 'resolvido' || lower === 'finalizado' || lower === 'encerrado') {
    return { label: status, cor: RESOLVIDO, corSuave: RESOLVIDO_SUAVE, icone: '✅' };
  }
  return { label: status, cor: CHUVA, corSuave: CHUVA_SUAVE, icone: '🌊' };
}

/* ─── Componente ─── */
export default function HistoricoScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [alagamentos, setAlagamentos] = useState<Alagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);

  const buscarHistorico = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setCarregando(true);
    setErro(false);

    try {
      const { data } = await api.get('/alagamentos_historico');

      const comEndereco = await Promise.all(
      data.map(async (alagamento: Alagamento) => {
        try {
          const resultado = await Location.reverseGeocodeAsync({
            latitude: Number(alagamento.bueiro.latitude),
            longitude: Number(alagamento.bueiro.longitude),
          });

          console.log(
            `Bueiro ${alagamento.bueiro.codigoDispositivo}:`,
            resultado[0]
          );

          return {
            ...alagamento,
            endereco: resultado.length > 0 ? resultado[0] : null,
          };
        } catch (error) {
          console.log('Erro no reverse geocode:', error);
          return { ...alagamento, endereco: null };
        }
      })
    );

    setAlagamentos(comEndereco);
      // Ordena por data mais recente primeiro
      comEndereco.sort((a: Alagamento, b: Alagamento) => {
        const dataA = new Date(a.inicio || 0).getTime();
        const dataB = new Date(b.fim || 0).getTime();
        return dataB - dataA;
      });

      setAlagamentos(comEndereco);
    } catch (e) {
      console.log('Erro ao carregar histórico:', e);
      setErro(true);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  console.log(alagamentos);

  useEffect(() => {
    buscarHistorico();
  }, [buscarHistorico]);

  const onRefresh = useCallback(() => {
    buscarHistorico(true);
  }, [buscarHistorico]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textSecondary}
          />
        }
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>

          <View style={styles.headerInfo}>
            <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
              Histórico
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Todos os alagamentos registrados
            </ThemedText>
          </View>
        </View>

        {/* Contador */}
        {!carregando && !erro && (
          <View style={styles.counterRow}>
            <ThemedView type="backgroundElement" style={styles.counterCard}>
              <ThemedText style={styles.counterNumber}>
                {alagamentos.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Total
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.counterCard}>
              <ThemedText style={[styles.counterNumber, { color: ALERTA }]}>
                {alagamentos.filter(
                  (a) => statusConfig(a.status).cor === ALERTA
                ).length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ativos
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.counterCard}>
              <ThemedText style={[styles.counterNumber, { color: RESOLVIDO }]}>
                {alagamentos.filter(
                  (a) => statusConfig(a.status).cor === RESOLVIDO
                ).length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Resolvidos
              </ThemedText>
            </ThemedView>
          </View>
        )}

        {/* Loading */}
        {carregando && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Carregando histórico…
            </ThemedText>
          </View>
        )}

        {/* Erro */}
        {!carregando && erro && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.centered}>
              <ThemedText style={styles.erroIcone}>😕</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Não foi possível carregar o histórico.
              </ThemedText>
              <Pressable
                onPress={() => buscarHistorico()}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={{ color: CHUVA }}>
                  Tentar novamente
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        )}

        {/* Lista vazia */}
        {!carregando && !erro && alagamentos.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.centered}>
              <ThemedText style={styles.emptyIcon}>🎉</ThemedText>
              <ThemedText type="smallBold">Nenhum registro</ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.emptyText}
              >
                Nenhum alagamento foi registrado até o momento.
              </ThemedText>
            </View>
          </ThemedView>
        )}
{console.log(alagamentos)}        
        
        {/* Lista de alagamentos */}
        {!carregando &&
          !erro &&
          alagamentos.map((alagamento, index) => {
            const config = statusConfig(alagamento.status);
            const criado =
              alagamento.inicio || alagamento.inicio;
            const atualizado =
              alagamento.fim || alagamento.fim;
            const duracao = calcularDuracao(criado, atualizado);

            const endereco = alagamento.endereco;
            const ruaCompleta = endereco
              ? `${endereco.street || 'Rua não encontrada'}${
                  endereco.streetNumber ? `, ${endereco.streetNumber}` : ''
                }`
              : 'Endereço indisponível';
            const bairro = endereco?.district || '';

            return (
              <ThemedView
                key={alagamento.id}
                type="backgroundElement"
                style={styles.card}
              >
                {/* Header do card */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: config.corSuave },
                    ]}
                  >
                    <ThemedText style={styles.iconText}>
                      {config.icone}
                    </ThemedText>
                  </View>

                  <View style={styles.cardInfo}>
                    <ThemedText type="smallBold">
                      Alagamento #{alagamento.id}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Bueiro {alagamento?.bueiro?.codigoDispositivo}
                    </ThemedText>
                  </View>

                  <View
                    style={[styles.badge, { backgroundColor: config.cor }]}
                  >
                    <ThemedText type="smallBold" style={styles.badgeText}>
                      {config.label}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Localização */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Localização
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {ruaCompleta}
                    </ThemedText>
                    {bairro ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {bairro}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Datas */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Início
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {formatarData(criado)}
                    </ThemedText>
                  </View>

                  <View style={styles.metaItem}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Atualização
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {formatarDataFim(atualizado)}
                    </ThemedText>
                  </View>
                </View>

                {/* Duração (se disponível) */}
                {duracao && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.duracaoRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Duração
                      </ThemedText>
                      <View
                        style={[
                          styles.duracaoBadge,
                          { backgroundColor: config.corSuave },
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: config.cor }}
                        >
                          {duracao}
                        </ThemedText>
                      </View>
                    </View>
                  </>
                )}
              </ThemedView>
            );
          })}
      </ScrollView>
    </ThemedView>
  );
}

/* ─── Estilos ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },

  content: {
    gap: Spacing.three,
    paddingBottom: 120,
  },

  /* Cabeçalho */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    fontSize: 20,
    lineHeight: 26,
  },

  headerInfo: {
    flex: 1,
    gap: 2,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
  },

  /* Contadores */
  counterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  counterCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 20,
    gap: 2,
  },

  counterNumber: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },

  /* Cards */
  card: {
    padding: Spacing.three,
    borderRadius: 24,
    gap: Spacing.three,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconText: {
    fontSize: 20,
    lineHeight: 26,
  },

  cardInfo: {
    flex: 1,
    gap: 2,
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },

  badgeText: {
    color: '#FFFFFF',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
  },

  metaRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },

  metaItem: {
    flex: 1,
    gap: 2,
  },

  duracaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  duracaoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },

  /* Estados */
  centered: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },

  erroIcone: {
    fontSize: 36,
    lineHeight: 42,
  },

  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CHUVA_SUAVE,
    marginTop: Spacing.one,
  },

  emptyIcon: {
    fontSize: 36,
    lineHeight: 42,
  },

  emptyText: {
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
