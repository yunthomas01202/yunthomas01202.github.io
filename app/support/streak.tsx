// 연속 공부 기록(스트릭): 잔디 달력 + 연속 일수
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../src/theme';
import { updateSettings, useData, useList } from '../../src/lib/store';
import { Heatmap } from '../../src/components/charts';
import { grassLevel, streakInfo, studyMinutesByDay } from '../../src/features/extra/logic';
import { addDays, addMonths, fmtKDate, fmtMin, startOfMonth, ymd } from '../../src/lib/date';
import { Card, IconBtn, Row, Screen, Stepper, T } from '../../src/components/ui';

export default function Streak() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const sessions = useList('sessions');
  const settings = useData((s) => s.settings);
  const minMin = settings.streakMin ?? 10;
  const byDay = useMemo(() => studyMinutesByDay(sessions), [sessions]);
  const info = streakInfo(byDay, minMin);
  const levels = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [d, v] of Object.entries(byDay)) m[d] = v >= minMin ? grassLevel(v, settings.dailyGoalMin) : 0;
    return m;
  }, [byDay, minMin, settings.dailyGoalMin]);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));

  const msg = info.doneToday
    ? '오늘도 잔디를 심었어요 🌱'
    : info.current
      ? `오늘 ${minMin}분만 하면 ${info.current + 1}일 연속!`
      : `오늘 ${minMin}분 공부하고 첫 칸을 채워보세요`;

  // 월 달력 (큰 칸)
  const first = startOfMonth(month);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cell = Math.floor((Math.min(width, 640) - 32 - 32 - 6 * 6) / 7);

  return (
    <Screen title="연속 공부" subtitle="날마다 잔디 한 칸씩" accent="#30A46C">
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <T size={52}>{info.current >= 7 ? '🔥' : info.current ? '🌱' : '🪴'}</T>
        <T size={40} weight="900" style={{ marginTop: 2 }}>
          {info.current}일
        </T>
        <T sub>연속 공부 중</T>
        <T weight="700" style={{ marginTop: 10 }} color={info.doneToday ? t.success : t.primary}>
          {msg}
        </T>
        <Row style={{ marginTop: 16 }} gap={24}>
          <View style={{ alignItems: 'center' }}>
            <T weight="900" size={18}>
              {info.best}일
            </T>
            <T size={12} sub>
              최고 기록
            </T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <T weight="900" size={18}>
              {info.totalDays}일
            </T>
            <T size={12} sub>
              심은 잔디
            </T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <T weight="900" size={18}>
              {fmtMin(Math.round(byDay[ymd()] || 0))}
            </T>
            <T size={12} sub>
              오늘
            </T>
          </View>
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Row style={{ marginBottom: 8 }}>
          <IconBtn name="chevron-back" onPress={() => setMonth(addMonths(month, -1))} />
          <T weight="800" center style={{ flex: 1 }}>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </T>
          <IconBtn name="chevron-forward" onPress={() => setMonth(addMonths(month, 1))} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
            <T key={d} size={11} faint center style={{ width: cell }}>
              {d}
            </T>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <View key={'e' + i} style={{ width: cell, height: cell }} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const d = ymd(addDays(first, i));
            const lv = levels[d] || 0;
            const isT = d === ymd();
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 8,
                  backgroundColor: t.heat[lv],
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isT || day === d ? 2 : 0,
                  borderColor: t.primary,
                }}
              >
                <T size={11} weight="700" color={lv >= 3 ? '#fff' : t.textSub}>
                  {i + 1}
                </T>
              </Pressable>
            );
          })}
        </View>
        {day && (
          <T size={13} sub style={{ marginTop: 10 }}>
            {fmtKDate(day)} · {byDay[day] ? fmtMin(Math.round(byDay[day])) : '기록 없음'}
          </T>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <T weight="800" style={{ marginBottom: 8 }}>
          최근 26주
        </T>
        <Heatmap levels={levels} weeks={width >= 700 ? 40 : 26} weekStartsOn={settings.weekStartsOn} onPressDay={setDay} selected={day} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T weight="700">하루 최소 공부 시간</T>
            <T size={12} sub>
              이만큼 공부해야 잔디가 심어져요
            </T>
          </View>
          <Stepper value={minMin} onChange={(v) => updateSettings({ streakMin: v })} step={5} min={5} max={180} format={(v) => `${v}분`} />
        </Row>
      </Card>
    </Screen>
  );
}
