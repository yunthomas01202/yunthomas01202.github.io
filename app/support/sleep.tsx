// 수면 계산기: 90분 수면 주기에 맞춰 잘 시간 / 일어날 시간 추천
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { alpha } from '../../src/lib/color';
import { updateSettings, useData } from '../../src/lib/store';
import { DEFAULT_SETTINGS } from '../../src/lib/types';
import { bedtimesFor, wakeTimesFrom } from '../../src/features/extra/logic';
import { alarmAvailable, newAlarm, saveAlarm, untilText } from '../../src/lib/alarm';
import { Btn, Card, Row, Screen, Segmented, Stepper, T, ToggleRow, toast } from '../../src/components/ui';

const ACCENT = '#6E56CF';
const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, '0')}`;
};

async function makeAlarm(min: number, label: string, days: number[]) {
  if (!alarmAvailable()) return toast('알람은 안드로이드 앱에서 만들 수 있어요');
  const at = await saveAlarm(newAlarm({ hour: Math.floor(min / 60), minute: min % 60, label, days }));
  toast(`알람을 만들었어요 · ${untilText(at)}`, { label: '알람 보기', onPress: () => router.push('/support/alarm') });
}

export default function Sleep() {
  const t = useTheme();
  const sl = useData((s) => s.settings.sleep) || DEFAULT_SETTINGS.sleep!;
  const set = (p: Partial<typeof sl>) => updateSettings({ sleep: { ...sl, ...p } });
  const [mode, setMode] = useState<'wake' | 'now'>('wake');
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const beds = bedtimesFor(sl.wake, sl.fallAsleepMin);
  const wakes = wakeTimesFrom(nowMin, sl.fallAsleepMin);

  return (
    <Screen title="수면 계산기" subtitle="90분 주기 끝에 일어나면 덜 피곤해요" accent={ACCENT}>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'wake', label: '⏰ 일어날 시간으로' },
          { value: 'now', label: '🛏️ 지금 자면' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {mode === 'wake' ? (
        <>
          <Card style={{ alignItems: 'center', marginBottom: 12 }}>
            <T sub>일어날 시간</T>
            <T size={40} weight="300" style={{ marginVertical: 6 }}>
              {fmt(sl.wake)}
            </T>
            <Row gap={10}>
              <Stepper value={Math.floor(sl.wake / 60)} onChange={(h) => set({ wake: h * 60 + (sl.wake % 60) })} min={0} max={23} format={(v) => `${v}시`} />
              <Stepper value={sl.wake % 60} onChange={(m) => set({ wake: Math.floor(sl.wake / 60) * 60 + m })} step={5} min={0} max={55} format={(v) => `${v}분`} />
            </Row>
          </Card>
          <T weight="800" style={{ marginBottom: 8 }}>
            이때 자면 좋아요
          </T>
          {beds.map((b) => {
            const sel = (sl.cycles || 5) === b.cycles;
            return (
              <Card key={b.cycles} style={{ marginBottom: 8, borderWidth: 2, borderColor: sel ? ACCENT : 'transparent' }} onPress={() => set({ cycles: b.cycles })}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T size={22} weight="800">
                      {fmt(b.bedMin)}
                    </T>
                    <T size={12} sub>
                      {b.cycles}주기 · {b.sleepH}시간 수면 {b.cycles === 5 || b.cycles === 6 ? '· 추천' : b.cycles === 3 ? '· 너무 짧아요' : ''}
                    </T>
                  </View>
                  {sel && <T color={ACCENT} weight="900">✓ 선택</T>}
                </Row>
              </Card>
            );
          })}
          <Card style={{ marginTop: 6 }}>
            <ToggleRow
              label="잘 시간 15분 전에 알려주기"
              desc={Platform.OS === 'web' ? '안드로이드 앱에서 알림이 와요' : `매일 ${fmt(((beds.find((b) => b.cycles === (sl.cycles || 5))!.bedMin - 15) + 1440) % 1440)}`}
              value={sl.bedRemind}
              onChange={(v) => set({ bedRemind: v })}
            />
            <Btn
              small
              icon="alarm"
              title={`${fmt(sl.wake)} 기상 알람 만들기 (평일)`}
              variant="secondary"
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              onPress={() => makeAlarm(sl.wake, '기상', [1, 2, 3, 4, 5])}
            />
          </Card>
        </>
      ) : (
        <>
          <Card style={{ alignItems: 'center', marginBottom: 12, backgroundColor: alpha(ACCENT, 0.08) }}>
            <T sub>지금 {fmt(nowMin)}에 누우면, 잠드는 데 {sl.fallAsleepMin}분 걸린다고 치고</T>
          </Card>
          {wakes
            .slice()
            .reverse()
            .map((w) => (
              <Card key={w.cycles} style={{ marginBottom: 8 }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T size={22} weight="800">
                      {fmt(w.wakeMin)}
                    </T>
                    <T size={12} sub>
                      {w.cycles}주기 · {w.sleepH}시간
                    </T>
                  </View>
                  <Btn small icon="alarm" title="알람" variant="secondary" onPress={() => makeAlarm(w.wakeMin, '기상', [])} />
                </Row>
              </Card>
            ))}
        </>
      )}

      <Card style={{ marginTop: 12 }}>
        <Row>
          <T style={{ flex: 1 }}>잠드는 데 걸리는 시간</T>
          <Stepper value={sl.fallAsleepMin} onChange={(v) => set({ fallAsleepMin: v })} step={5} min={0} max={60} format={(v) => `${v}분`} />
        </Row>
        <T size={12} faint style={{ marginTop: 8 }}>
          청소년은 하루 8~10시간 수면이 권장돼요. 시험 전날 밤샘보다 5~6주기 잠이 기억 정리에 더 좋아요.
        </T>
      </Card>
    </Screen>
  );
}
