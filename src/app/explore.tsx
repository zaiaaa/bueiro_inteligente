import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ALERTA = '#E53935';
const CHUVA = '#3B82F6';
const CHUVA_SUAVE = 'rgba(59, 130, 246, 0.16)';

// Sorocaba - SP
const LATITUDE = -23.4990588;
const LONGITUDE = -47.4574044;
const HORAS_EXIBIDAS = 6;

type Hora = {
  hora: string; // "22h"
  mm: number; // precipitação em mm
  prob: number; // probabilidade em %
};

const TELEFONES = [
  { nome: 'Defesa Civil', numero: '199' },
  { nome: 'Bombeiros', numero: '193' },
  { nome: 'SAMU', numero: '192' },
];

const DICAS = [
  {
    icone: '🚗',
    titulo: 'Evite ruas alagadas',
    texto:
      'Poucos centímetros de água já fazem um carro perder o controle, e cerca de 30 cm podem arrastá-lo. Procure outro caminho.',
  },
  {
    icone: '🚶',
    titulo: 'Não ande na água',
    texto:
      'A água pode esconder bueiros abertos, buracos e lixo, além de estar contaminada (risco de leptospirose).',
  },
  {
    icone: '⚡',
    titulo: 'Cuidado com a energia',
    texto:
      'Fique longe de fios e postes caídos. Se a água entrar em casa, desligue a energia no quadro geral.',
  },
  {
    icone: '🏠',
    titulo: 'Procure um local seguro',
    texto:
      'Vá para um ponto mais alto e leve documentos, remédios e o celular carregado.',
  },
];

function nivelDeChuva(maxMm: number) {
  if (maxMm < 0.1) return { texto: 'Sem chuva significativa', cor: '#2E9E5B' };
  if (maxMm < 2.5) return { texto: 'Chuva fraca', cor: CHUVA };
  if (maxMm < 7.5) return { texto: 'Chuva moderada', cor: '#F59E0B' };
  return { texto: 'Chuva forte', cor: ALERTA };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function ExploreScreen() {
  const theme = useTheme();

  const [horas, setHoras] = useState<Hora[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const [local, setLocal] = useState('');

  const carregarPrevisao = useCallback(async () => {
    setCarregando(true);
    setErro(false);

    try {
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
        '&hourly=precipitation,precipitation_probability' +
        '&timezone=America%2FSao_Paulo&forecast_days=2';

      const resposta = await fetch(url);
      const dados = await resposta.json();

      const tempos: string[] = dados.hourly.time;
      const chuva: number[] = dados.hourly.precipitation;
      const probs: number[] = dados.hourly.precipitation_probability;

      // Hora atual no mesmo formato da API ("2026-10-05T22:00")
      const agora = new Date();
      const atual =
        `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}` +
        `T${pad(agora.getHours())}:00`;

      let inicio = tempos.findIndex((t) => t >= atual);
      if (inicio < 0) inicio = 0;

      const proximas: Hora[] = [];
      for (let i = inicio; i < inicio + HORAS_EXIBIDAS && i < tempos.length; i++) {
        proximas.push({
          hora: `${tempos[i].slice(11, 13)}h`,
          mm: chuva[i] ?? 0,
          prob: probs[i] ?? 0,
        });
      }

      setHoras(proximas);
    } catch (e) {
      console.log('Erro ao carregar previsão:', e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPrevisao();
  }, [carregarPrevisao]);

  const totalMm = horas.reduce((soma, h) => soma + h.mm, 0);
  const maxMm = horas.reduce((m, h) => Math.max(m, h.mm), 0);
  const maxProb = horas.reduce((m, h) => Math.max(m, h.prob), 0);
  const nivel = nivelDeChuva(maxMm);

  const enviarAviso = () => {
    // TODO: enviar para o backend quando ele existir
    console.log('Aviso de problema:', local.trim());

    Alert.alert(
      'Aviso registrado',
      'Obrigado por ajudar a manter a cidade segura!'
    );
    setLocal('');
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cabeçalho */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
              Explorar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Informações para se manter seguro
            </ThemedText>
          </View>

          {/* Previsão de chuva */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: CHUVA_SUAVE }]}>
                <ThemedText style={styles.iconText}>🌧️</ThemedText>
              </View>

              <View style={styles.flex}>
                <ThemedText type="smallbold">Previsão de chuva</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sorocaba, próximas {HORAS_EXIBIDAS} horas
                </ThemedText>
              </View>
            </View>

            {carregando && (
              <View style={styles.centered}>
                <ActivityIndicator color={CHUVA} />
              </View>
            )}

            {!carregando && erro && (
              <View style={styles.centered}>
                <ThemedText type="small" themeColor="textSecondary">
                  Não foi possível carregar a previsão.
                </ThemedText>
                <Pressable
                  onPress={carregarPrevisao}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallbold" style={{ color: CHUVA }}>
                    Tentar novamente
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {!carregando && !erro && horas.length > 0 && (
              <>
                <View style={styles.summaryRow}>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: nivel.cor },
                    ]}
                  >
                    <ThemedText type="smallbold" style={styles.levelText}>
                      {nivel.texto}
                    </ThemedText>
                  </View>

                  <ThemedText type="small" themeColor="textSecondary">
                    {totalMm.toFixed(1)} mm · até {maxProb}% de chance
                  </ThemedText>
                </View>

                <View style={styles.chartRow}>
                  {horas.map((h) => (
                    <View key={h.hora} style={styles.chartItem}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {h.prob}%
                      </ThemedText>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.max(h.prob, 6)}%` },
                          ]}
                        />
                      </View>

                      <ThemedText type="smallbold">{h.hora}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {h.mm.toFixed(1)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.footnote}
                >
                  Barras: chance de chuva. Número abaixo: milímetros por hora.
                </ThemedText>
              </>
            )}
          </ThemedView>

          {/* Dicas de segurança */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, styles.iconBoxAlert]}>
                <ThemedText style={styles.iconText}>🛟</ThemedText>
              </View>

              <View style={styles.flex}>
                <ThemedText type="smallbold">Em caso de alagamento</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  O que fazer e o que evitar
                </ThemedText>
              </View>
            </View>

            {DICAS.map((dica, index) => (
              <View key={dica.titulo}>
                {index > 0 && <View style={styles.divider} />}

                <View style={styles.tipRow}>
                  <ThemedText style={styles.tipIcon}>{dica.icone}</ThemedText>

                  <View style={styles.flex}>
                    <ThemedText type="smallbold">{dica.titulo}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {dica.texto}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.divider} />

            <ThemedText type="smallbold" style={styles.phonesTitle}>
              Telefones úteis
            </ThemedText>

            <View style={styles.phonesRow}>
              {TELEFONES.map((t) => (
                <Pressable
                  key={t.numero}
                  onPress={() => Linking.openURL(`tel:${t.numero}`)}
                  style={({ pressed }) => [
                    styles.phoneButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText style={styles.phoneNumber}>{t.numero}</ThemedText>
                  <ThemedText style={styles.phoneName}>{t.nome}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          {/* Reportar problema */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, styles.iconBoxAlert]}>
                <ThemedText style={styles.iconText}>📢</ThemedText>
              </View>

              <View style={styles.flex}>
                <ThemedText type="smallbold">Reportar problema</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Bueiro entupido ou alagamento sem alerta
                </ThemedText>
              </View>
            </View>

            <TextInput
              value={local}
              onChangeText={setLocal}
              placeholder="Onde é? Ex.: Rua XV de Novembro, 200"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              returnKeyType="send"
              onSubmitEditing={() => local.trim() && enviarAviso()}
            />

            <Pressable
              onPress={enviarAviso}
              disabled={!local.trim()}
              style={({ pressed }) => [
                styles.reportButton,
                !local.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                style={styles.reportText}
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
              >
                Enviar aviso
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

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
    gap: 2,
    marginBottom: Spacing.one,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
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

  iconBoxAlert: {
    backgroundColor: 'rgba(229, 57, 53, 0.16)',
  },

  iconText: {
    fontSize: 20,
    lineHeight: 26,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  disabled: {
    opacity: 0.4,
  },

  /* Previsão */
  centered: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },

  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CHUVA_SUAVE,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },

  levelText: {
    color: '#FFFFFF',
  },

  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },

  chartItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  barTrack: {
    width: '70%',
    height: 80,
    borderRadius: 8,
    backgroundColor: CHUVA_SUAVE,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  barFill: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: CHUVA,
  },

  footnote: {
    textAlign: 'center',
  },

  /* Dicas */
  tipRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },

  tipIcon: {
    fontSize: 22,
    lineHeight: 28,
  },

  phonesTitle: {
    marginTop: 2,
  },

  phonesRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  phoneButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 57, 53, 0.16)',
  },

  phoneNumber: {
    color: ALERTA,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 26,
  },

  phoneName: {
    color: ALERTA,
    fontSize: 12,
    lineHeight: 16,
  },

  /* Reportar */
  input: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },

  reportButton: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ALERTA,
  },

  reportText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
