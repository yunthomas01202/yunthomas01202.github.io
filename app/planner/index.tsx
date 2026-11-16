// 계획/스케줄 부문 홈
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useData, useList } from '../../src/lib/store';
import { Badge, Btn, Card, Empty, IconBtn, ProgressBar, Row, Screen, SectionTitle, T } from '../../src/components/ui';
import { Heatmap } from '../../src/components/charts';
import { SeasonEditor } from '../../src/features/planner/components';
import { dayStats, heatLevels, nextExam, pickActiveSeason, streakDays } from '../../src/features/planner/logic';
import { daysUntil, ddayLabel, fmtKDate, ymd } from '../../src/lib/date';

export default function PlannerHome() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const seasons = useList('seasons');
  const tasks = useList('tasks');
  const weekStartsOn = useData((s) => s.settings.weekStartsOn);
  const [editor, setEditor] = useState(false);

  const active = useMemo(() => pickActiveSeason(seasons), [seasons]);
  const stats = useMemo(() => dayStats(tasks), [tasks]);
  const levels = useMemo(() => heatLevels(stats), [stats]);
  const streak = useMemo(() => streakDays(stats), [stats]);
  const seasonTasks = useMemo(() => (active ? tasks.filter((x) => x.seasonId === active.id && !x.starter) : []), [tasks, active]);
  const done = seasonTasks.filter((x) => x.status === 'done').length;
  const todayKey = ymd();
  const todayList = tasks.filter((x) => x.start && ymd(x.start) === todayKey);
  const unscheduled = seasonTasks.filter((x) => !x.start && x.status === 'todo').length;
  const exam = active ? nextExam(active) : undefined;

  const tiles = [
    { title: '오늘 실행', desc: `${todayList.filter((x) => x.status === 'done').length}/${todayList.length} 완료`, icon: 'checkmark-done' as const, route: '/planner/today', color: '#30A46C' },
    { title: '캘린더 짜기', desc: unscheduled ? `배치 안 한 일 ${unscheduled}개` : '드래그로 시간표 만들기', icon: 'grid' as const, route: '/planner/calendar', color: t.section.plan },
    { title: '시즌 · 할 일', desc: `${seasons.filter((s) => !s.archived).length}개 시즌`, icon: 'layers' as const, route: '/planner/seasons', color: '#8E4EC6' },
    { title: '성장 스탯', desc: streak ? `🔥 ${streak}일 연속` : '잔디 · 헥사곤', icon: 'stats-chart' as const, route: '/planner/stats', color: '#F76B15' },
  ];
  const tileW = width >= 700 ? (width - 32 - 36) / 4 : (width - 32 - 12) / 2;

  return (
    <Screen title="계획 / 스케줄" accent={t.section.plan} right={<IconBtn name="add-circle-outline" onPress={() => setEditor(true)} />}>
      {active ? (
        <Card onPress={() => router.push(`/planner/season/${active.id}`)} color={t.section.plan}>
          <Row>
            <View style={{ flex: 1 }}>
              <T size={12} color="rgba(255,255,255,0.8)" weight="700">
                진행 중인 시즌
              </T>
              <T size={22} weight="900" color="#fff" numberOfLines={1}>
                {active.name}
              </T>
              <T size={12} color="rgba(255,255,255,0.85)">
                {fmtKDate(active.startDate, false)} ~ {fmtKDate(active.endDate, false)}
              </T>
            </View>
            {exam ? (
              <View style={{ alignItems: 'flex-end' }}>
                <T size={28} weight="900" color="#fff">
                  {ddayLabel(daysUntil(exam.date))}
                </T>
                <T size={11} color="rgba(255,255,255,0.85)">
                  {exam.label} 시험
                </T>
              </View>
            ) : null}
          </Row>
          {active.goal ? (
            <T size={13} color="#fff" style={{ marginTop: 10 }} weight="600">
              🎯 {active.goal}
            </T>
          ) : null}
          <View style={{ marginTop: 14 }}>
            <ProgressBar value={seasonTasks.length ? done / seasonTasks.length : 0} color="#fff" />
            <T size={12} color="rgba(255,255,255,0.9)" style={{ marginTop: 6 }}>
              할 일 {done}/{seasonTasks.length} 완료
            </T>
          </View>
        </Card>
      ) : (
        <Card>
          <Empty
            icon="flag-outline"
            title="첫 시즌을 만들어 보세요"
            desc="'1학년 1학기 중간고사', '겨울방학'처럼 계획을 실행할 큰 단위예요. 시즌 안에 과목과 할 일을 넣어요."
            action={<Btn title="시즌 만들기" icon="add" onPress={() => setEditor(true)} style={{ marginTop: 8 }} />}
          />
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
        {tiles.map((x) => (
          <Pressable
            key={x.title}
            onPress={() => router.push(x.route as any)}
            style={({ pressed }) => ({
              width: tileW,
              padding: 16,
              borderRadius: 20,
              backgroundColor: t.surface,
              gap: 10,
              opacity: pressed ? 0.85 : 1,
              ...(t.shadow as object),
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: x.color, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={x.icon} size={22} color="#fff" />
            </View>
            <View>
              <T weight="800" size={16}>
                {x.title}
              </T>
              <T size={12} sub numberOfLines={1}>
                {x.desc}
              </T>
            </View>
          </Pressable>
        ))}
      </View>

      <SectionTitle
        title="공부 잔디"
        right={streak ? <Badge label={`🔥 ${streak}일 연속`} color="#F76B15" /> : undefined}
      />
      <Card>
        <Heatmap levels={levels} weeks={width >= 700 ? 30 : 17} weekStartsOn={weekStartsOn} onPressDay={() => router.push('/planner/stats')} />
      </Card>

      {seasons.length > 1 && (
        <>
          <SectionTitle title="다른 시즌" right={<Btn small variant="ghost" title="전체 보기" onPress={() => router.push('/planner/seasons')} />} />
          {seasons
            .filter((s) => s.id !== active?.id && !s.archived)
            .slice(0, 3)
            .map((s) => (
              <Card key={s.id} onPress={() => router.push(`/planner/season/${s.id}`)} style={{ marginBottom: 8, paddingVertical: 12 }}>
                <Row>
                  <T weight="700" style={{ flex: 1 }}>
                    {s.name}
                  </T>
                  <T size={12} sub>
                    {fmtKDate(s.startDate, false)} ~ {fmtKDate(s.endDate, false)}
                  </T>
                </Row>
              </Card>
            ))}
        </>
      )}
      <SeasonEditor visible={editor} onClose={() => setEditor(false)} />
    </Screen>
  );
}
