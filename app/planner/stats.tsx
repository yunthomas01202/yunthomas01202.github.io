// 성장 스탯: 잔디 히트맵 + 헥사곤 스탯 + 계획 정확도
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../src/theme';
import { useData, useList } from '../../src/lib/store';
import { Badge, Card, Dot, ProgressBar, Row, Screen, SectionTitle, T } from '../../src/components/ui';
import { HexRadar, Heatmap } from '../../src/components/charts';
import { axisXP, dayStats, heatLevels, levelOf, streakDays, taskXP, titleOf } from '../../src/features/planner/logic';
import { fmtKDate, fmtShortDur, ymd } from '../../src/lib/date';

const REASON_LABEL: Record<string, string> = {
  time: '시간 부족',
  tired: '피곤함',
  reluctant: '하기 싫었음',
  hard: '너무 어려움',
  changed: '일정 변경',
  forgot: '깜빡함',
  split: '쪼갬',
};

export default function Stats() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const tasks = useList('tasks');
  const sessions = useList('sessions');
  const subjects = useData((s) => s.subjects);
  const settings = useData((s) => s.settings);
  const [day, setDay] = useState<string | null>(null);

  const stats = useMemo(() => dayStats(tasks), [tasks]);
  const levels = useMemo(() => heatLevels(stats), [stats]);
  const streak = streakDays(stats);
  const studyBySubject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sessions) m[s.subject] = (m[s.subject] || 0) + s.sec / 60;
    return m;
  }, [sessions]);
  const xpByAxis = useMemo(() => axisXP(tasks, subjects, settings.statAxes, studyBySubject), [tasks, subjects, settings.statAxes, studyBySubject]);
  const totalXP = Object.values(xpByAxis).reduce((a, b) => a + b, 0);
  const lv = levelOf(totalXP);
  const maxAxis = Math.max(150, ...Object.values(xpByAxis)) * 1.1;

  const past = tasks.filter((x) => x.start && x.end && x.end < Date.now());
  const onTime = past.filter((x) => x.status === 'done' && (x.missCount || 0) === 0).length;
  const accuracy = past.length ? onTime / past.length : 0;
  const reasons = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of tasks) for (const r of x.failReasons || []) m[r] = (m[r] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [tasks]);
  const reasonMax = Math.max(1, ...reasons.map((r) => r[1]));

  const bySubject = useMemo(() => {
    const m: Record<string, { name: string; color: string; xp: number; n: number }> = {};
    for (const x of tasks) {
      if (x.status !== 'done') continue;
      const s = subjects[x.subjectId];
      const key = s?.name || '기타';
      m[key] ||= { name: key, color: s?.color || '#888', xp: 0, n: 0 };
      m[key].xp += taskXP(x);
      m[key].n++;
    }
    return Object.values(m).sort((a, b) => b.xp - a.xp);
  }, [tasks, subjects]);
  const subMax = Math.max(1, ...bySubject.map((b) => b.xp));

  const dayTasks = day ? tasks.filter((x) => (x.start && ymd(x.start) === day) || (!x.start && x.doneAt && ymd(x.doneAt) === day)) : [];
  const daySec = day ? sessions.filter((s) => ymd(s.start) === day).reduce((a, s) => a + s.sec, 0) : 0;

  return (
    <Screen title="성장 스탯" accent={t.section.plan}>
      <Card color={t.dark ? '#1E1B4B' : '#EEF0FF'} style={{ alignItems: 'center' }}>
        <Row>
          <Badge label={titleOf(lv.level)} color={t.primary} solid />
          {streak > 0 && <Badge label={`🔥 ${streak}일 연속`} color="#F76B15" />}
        </Row>
        <T size={40} weight="900" style={{ marginTop: 6 }}>
          Lv.{lv.level}
        </T>
        <View style={{ width: '80%', marginTop: 6 }}>
          <ProgressBar value={lv.progress} color={t.primary} height={10} />
        </View>
        <T size={12} sub style={{ marginTop: 6 }}>
          총 {Math.round(totalXP)} XP · 다음 레벨까지 {lv.toNext} XP
        </T>
        <HexRadar
          size={Math.min(width - 64, 340)}
          axes={settings.statAxes.map((a) => ({
            label: a,
            value: (xpByAxis[a] || 0) / maxAxis,
            sub: `Lv.${levelOf(xpByAxis[a] || 0).level}`,
          }))}
        />
        <T size={11} faint center>
          할 일을 완료하면 과목 축과 유형(암기·문제풀이 등) 축에 경험치가 쌓여요.{'\n'}축 이름은 설정에서 바꿀 수 있어요.
        </T>
      </Card>

      <SectionTitle title="공부 잔디" />
      <Card>
        <Heatmap levels={levels} weeks={width >= 700 ? 40 : 26} weekStartsOn={settings.weekStartsOn} onPressDay={setDay} selected={day} />
        {day && (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: t.border, paddingTop: 12 }}>
            <Row>
              <T weight="800" style={{ flex: 1 }}>
                {fmtKDate(day)}
              </T>
              <T size={12} sub>
                {stats[day]?.done || 0}/{stats[day]?.total || 0} 완료 · 공부 {fmtShortDur(daySec)}
              </T>
            </Row>
            {dayTasks.map((x) => (
              <Row key={x.id} style={{ marginTop: 6 }}>
                <Dot color={subjects[x.subjectId]?.color || '#888'} size={8} />
                <T size={13} style={{ flex: 1, opacity: x.status === 'done' ? 1 : 0.5 }} numberOfLines={1}>
                  {x.status === 'done' ? '✓ ' : x.status === 'failed' ? '✗ ' : '· '}
                  {x.title}
                </T>
              </Row>
            ))}
          </View>
        )}
      </Card>

      <SectionTitle title="계획 정확도" />
      <Card>
        <Row>
          <T size={32} weight="900" color={accuracy >= 0.8 ? t.success : accuracy >= 0.5 ? t.warn : t.danger}>
            {Math.round(accuracy * 100)}%
          </T>
          <T size={13} sub style={{ flex: 1 }}>
            시간이 지난 계획 {past.length}개 중 {onTime}개를 미루지 않고 완료했어요
          </T>
        </Row>
        {reasons.length > 0 && (
          <View style={{ marginTop: 14, gap: 8 }}>
            <T size={13} weight="700" sub>
              못 지킨 이유
            </T>
            {reasons.map(([r, n]) => (
              <Row key={r}>
                <T size={13} style={{ width: 86 }}>
                  {REASON_LABEL[r] || r}
                </T>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={n / reasonMax} color={t.danger} />
                </View>
                <T size={12} sub style={{ width: 28, textAlign: 'right' }}>
                  {n}
                </T>
              </Row>
            ))}
          </View>
        )}
      </Card>

      <SectionTitle title="과목별 경험치" />
      <Card>
        {bySubject.length === 0 ? (
          <T sub>아직 완료한 할 일이 없어요</T>
        ) : (
          bySubject.map((b) => (
            <View key={b.name} style={{ marginBottom: 10 }}>
              <Row>
                <Dot color={b.color} />
                <T weight="700" style={{ flex: 1 }}>
                  {b.name}
                </T>
                <T size={12} sub>
                  {b.n}개 · {Math.round(b.xp)} XP
                </T>
              </Row>
              <View style={{ marginTop: 5 }}>
                <ProgressBar value={b.xp / subMax} color={b.color} />
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
