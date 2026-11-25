// 무음 타이머: 소리 없이 화면(링·깜빡임)과 선택적 진동으로만 알려줌
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { useTheme } from '../../src/theme';
import { Btn, Card, Chip, Row, Screen, Stepper, T, ToggleRow } from '../../src/components/ui';
import { Ring } from '../../src/components/charts';
import { useTick } from '../../src/features/support/timerStore';
import { cancelById, scheduleAt } from '../../src/lib/notify';
import { onTimerFinished } from '../../src/lib/ambient';
import { AmbientPanel } from '../../src/features/extra/AmbientPanel';

interface TState {
  total: number; // 초
  endAt: number | null;
  pausedLeft: number | null;
  finished: boolean;
  vibrate: boolean;
  flash: boolean;
  notifId: string | null;
}
const useT = create<TState>(() => ({ total: 25 * 60, endAt: null, pausedLeft: null, finished: false, vibrate: false, flash: true, notifId: null }));

const PRESETS = [5, 10, 15, 25, 30, 45, 50, 60, 90];

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function SilentTimer() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const s = useT();
  const running = !!s.endAt;
  useTick(running, 250);
  const flash = useRef(new Animated.Value(0)).current;

  const left = s.endAt ? Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000)) : s.pausedLeft ?? s.total;

  useEffect(() => {
    if (running && left <= 0 && !s.finished) {
      useT.setState({ endAt: null, pausedLeft: null, finished: true });
      cancelById(s.notifId);
      onTimerFinished();
      if (s.vibrate && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 500);
      }
      if (s.flash) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(flash, { toValue: 1, duration: 450, useNativeDriver: true }),
            Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }),
          ]),
          { iterations: 6 },
        ).start();
      }
    }
  }, [running, left, s, flash]);

  const start = async () => {
    const l = s.pausedLeft ?? s.total;
    const endAt = Date.now() + l * 1000;
    const id = await scheduleAt('⏳ 무음 타이머 끝', '설정한 시간이 다 됐어요', endAt, 'silent-timer');
    useT.setState({ endAt, pausedLeft: null, finished: false, notifId: id });
  };
  const pause = () => {
    cancelById(s.notifId);
    useT.setState({ pausedLeft: left, endAt: null, notifId: null });
  };
  const reset = () => {
    cancelById(s.notifId);
    flash.stopAnimation();
    flash.setValue(0);
    useT.setState({ endAt: null, pausedLeft: null, finished: false, notifId: null });
  };
  const setTotal = (sec: number) => {
    if (running) return;
    useT.setState({ total: sec, pausedLeft: null, finished: false });
  };

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const size = Math.min(width - 60, 320);

  return (
    <Screen title="무음 타이머" subtitle="소리 없이 화면으로만 알려줘요" accent="#3E63DD">
      {running && <KeepAwake />}
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <Ring size={size} stroke={16} progress={s.finished ? 1 : left / Math.max(1, s.total)} color={s.finished ? t.success : '#3E63DD'}>
          <Text style={{ fontSize: size / 4.2, fontWeight: '200', color: t.text, fontVariant: ['tabular-nums'] }}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </Text>
          <T sub>{s.finished ? '끝났어요 ✓' : running ? '진행 중' : s.pausedLeft !== null ? '일시정지' : '준비'}</T>
        </Ring>
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: -40, right: -40, top: -200, bottom: -200, backgroundColor: '#3E63DD', opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }}
        />
      </View>
      <Row style={{ marginVertical: 12 }}>
        {running ? <Btn title="일시정지" icon="pause" flex variant="secondary" onPress={pause} /> : <Btn title={s.pausedLeft !== null ? '계속' : '시작'} icon="play" flex color="#3E63DD" onPress={start} />}
        <Btn title="초기화" icon="refresh" variant="secondary" onPress={reset} />
      </Row>
      <Card>
        <T weight="800" style={{ marginBottom: 10 }}>
          시간
        </T>
        <Row wrap>
          {PRESETS.map((m) => (
            <Chip key={m} small label={`${m}분`} selected={s.total === m * 60} onPress={() => setTotal(m * 60)} color="#3E63DD" />
          ))}
        </Row>
        <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Stepper value={Math.round(s.total / 60)} onChange={(v) => setTotal(v * 60)} step={1} min={1} max={300} format={(v) => `${v}분`} />
        </View>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <ToggleRow label="끝나면 화면 깜빡임" value={s.flash} onChange={(v) => useT.setState({ flash: v })} />
        <ToggleRow label="끝나면 진동" desc="완전 무음이 필요하면 꺼두세요" value={s.vibrate} onChange={(v) => useT.setState({ vibrate: v })} />
        <T size={12} sub style={{ marginTop: 6 }}>
          {Platform.OS === 'web'
            ? '웹에서는 이 탭을 열어두세요. 진행 중엔 화면이 꺼지지 않게 해요(지원하는 브라우저).'
            : '앱을 나가도 끝나는 시각에 소리 없는 알림이 와요. 진행 중엔 화면이 꺼지지 않아요.'}
        </T>
      </Card>
      <AmbientPanel compact style={{ marginTop: 12 }} />
    </Screen>
  );
}
