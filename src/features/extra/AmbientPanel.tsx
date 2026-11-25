// 배경음 패널: 소리마다 켜고 끄기 + 음량, 전체 음량, 타이머 끝나면 서서히 끄기
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { alpha } from '../../lib/color';
import { AMBIENTS, fadeOutAmbient, setAmbientVolume, setMaster, stopAllAmbient, toggleAmbient, useAmbient } from '../../lib/ambient';
import { Btn, Card, Row, Stepper, T, ToggleRow } from '../../components/ui';

export function AmbientPanel({ compact, style }: { compact?: boolean; style?: any }) {
  const t = useTheme();
  const st = useAmbient();
  const onKeys = Object.keys(st.on);
  return (
    <Card style={style}>
      <Row style={{ marginBottom: 10 }}>
        <T weight="800" style={{ flex: 1 }}>
          🎧 공부 배경음 {st.fading ? '· 줄어드는 중…' : onKeys.length ? `· ${onKeys.length}개 재생 중` : ''}
        </T>
        {onKeys.length > 0 && <Btn small variant="ghost" title="모두 끄기" onPress={stopAllAmbient} />}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AMBIENTS.map((a) => {
          const on = st.on[a.key] !== undefined;
          return (
            <Pressable
              key={a.key}
              onPress={() => toggleAmbient(a.key)}
              style={{
                width: compact ? 74 : 92,
                paddingVertical: 10,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: on ? alpha(t.primary, 0.16) : t.surface2,
                borderWidth: 1.5,
                borderColor: on ? t.primary : 'transparent',
              }}
            >
              <T size={22}>{a.emoji}</T>
              <T size={12} weight={on ? '800' : '600'} color={on ? t.primary : t.textSub} style={{ marginTop: 2 }}>
                {a.name}
              </T>
            </Pressable>
          );
        })}
      </View>
      {!compact &&
        onKeys.map((k) => {
          const a = AMBIENTS.find((x) => x.key === k)!;
          return (
            <Row key={k} style={{ marginTop: 10 }}>
              <T style={{ flex: 1 }}>
                {a.emoji} {a.name}
              </T>
              <Stepper value={Math.round(st.on[k] * 100)} onChange={(v) => setAmbientVolume(k, v / 100)} step={10} min={10} max={100} format={(v) => `${v}%`} />
            </Row>
          );
        })}
      <Row style={{ marginTop: 12 }}>
        <T weight="600" style={{ flex: 1 }}>
          전체 음량
        </T>
        <Stepper value={Math.round(st.master * 100)} onChange={(v) => setMaster(v / 100)} step={10} min={0} max={100} format={(v) => `${v}%`} />
      </Row>
      <ToggleRow
        label="타이머가 끝나면 서서히 끄기"
        desc="20초 동안 작아지다가 꺼져요"
        value={st.fadeWithTimer}
        onChange={(v) => useAmbient.setState({ fadeWithTimer: v })}
      />
      {!compact && onKeys.length > 0 && <Btn small variant="secondary" title="지금 서서히 끄기" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => fadeOutAmbient()} />}
    </Card>
  );
}
