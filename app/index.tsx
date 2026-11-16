// 메인 화면: 오늘 요약 + 4개 부문 + 2주 이내 D-day
import React, { useMemo } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/lib/auth';
import { useData, useList } from '../src/lib/store';
import { Badge, Card, IconBtn, Row, SectionTitle, T, Empty } from '../src/components/ui';
import { Ring } from '../src/components/charts';
import { alpha } from '../src/lib/color';
import { daysUntil, ddayLabel, fmtKDate, fmtShortDur, fmtTime, ymd } from '../src/lib/date';
import { useRunningTimer } from '../src/features/support/timerStore';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useAuth((s) => s.user);
  const tasks = useList('tasks');
  const seasons = useList('seasons');
  const perfItems = useList('perfItems');
  const categories = useData((s) => s.perfCategories);
  const events = useList('events');
  const cards = useList('cards');
  const sessions = useList('sessions');
  const running = useRunningTimer();
  const today = ymd();

  const todayTasks = useMemo(() => tasks.filter((x) => x.start && ymd(x.start) === today), [tasks, today]);
  const doneToday = todayTasks.filter((x) => x.status === 'done').length;
  const nextTask = useMemo(
    () => todayTasks.filter((x) => x.status === 'todo' && (x.end || 0) > Date.now()).sort((a, b) => a.start! - b.start!)[0],
    [todayTasks],
  );
  const studySec = useMemo(() => sessions.filter((s) => ymd(s.start) === today).reduce((a, s) => a + s.sec, 0), [sessions, today]);
  const dueCards = useMemo(() => cards.filter((c) => c.srs.due <= Date.now()).length, [cards]);

  const upcoming = useMemo(() => {
    const out: { key: string; date: string; title: string; sub: string; color: string; route: string }[] = [];
    for (const i of perfItems) {
      if (!i.dueDate || i.status === 'done') continue;
      const d = daysUntil(i.dueDate);
      if (d < 0 || d > 14) continue;
      out.push({
        key: 'i' + i.id,
        date: i.dueDate,
        title: i.title,
        sub: categories[i.categoryId]?.name || '수행',
        color: i.color || categories[i.categoryId]?.color || t.section.perf,
        route: `/perf/item/${i.id}`,
      });
    }
    for (const e of events) {
      const d = daysUntil(e.date);
      if (d < 0 || d > 14) continue;
      out.push({ key: 'e' + e.id, date: e.date, title: e.title, sub: '일정', color: e.color, route: '/perf' });
    }
    for (const s of seasons) {
      if (s.archived) continue;
      for (const ex of s.exams || []) {
        const d = daysUntil(ex.date);
        if (d < 0 || d > 14) continue;
        out.push({
          key: 'x' + s.id + ex.id,
          date: ex.date,
          title: `${ex.label} 시험`,
          sub: s.name,
          color: t.section.plan,
          route: `/planner/season/${s.id}`,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [perfItems, events, seasons, categories, t]);

  const wide = width >= 700;
  const sections = [
    {
      key: 'plan',
      title: '계획 / 스케줄',
      icon: 'calendar' as const,
      color: t.section.plan,
      info: todayTasks.length ? `오늘 ${doneToday}/${todayTasks.length} 완료` : '오늘 계획을 세워보세요',
      route: '/planner',
    },
    {
      key: 'study',
      title: '학습',
      icon: 'book' as const,
      color: t.section.study,
      info: dueCards ? `복습할 카드 ${dueCards}장` : 'PDF · 노트 · 암기 덱',
      route: '/study',
    },
    {
      key: 'perf',
      title: '수행 / 세특',
      icon: 'ribbon' as const,
      color: t.section.perf,
      info: upcoming.filter((u) => u.key[0] !== 'x').length ? `2주 내 ${upcoming.filter((u) => u.key[0] !== 'x').length}건` : '수행평가 · 활동 기록',
      route: '/perf',
    },
    {
      key: 'support',
      title: '공부 도구',
      icon: 'timer' as const,
      color: t.section.support,
      info: running ? `⏱ ${running.subject} 공부 중` : studySec ? `오늘 ${fmtShortDur(studySec)} 공부` : '타이머 · 예열 · 잠금',
      route: '/support',
    },
  ];

  const hour = new Date().getHours();
  const greet = hour < 6 ? '늦은 밤이에요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '오늘도 수고했어요';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        <Row style={{ marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <T sub size={14}>
              {fmtKDate(new Date())}
            </T>
            <T size={24} weight="900">
              {greet}, {user?.name?.split(' ')[0] || ''}님
            </T>
          </View>
          <Pressable onPress={() => router.push('/settings')}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <IconBtn name="settings-outline" onPress={() => router.push('/settings')} />
            )}
          </Pressable>
        </Row>

        {/* 오늘 요약 */}
        <Card onPress={() => router.push('/planner/today')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring size={86} stroke={10} progress={todayTasks.length ? doneToday / todayTasks.length : 0} color={t.success}>
            <T size={18} weight="900">
              {todayTasks.length ? Math.round((doneToday / todayTasks.length) * 100) : 0}%
            </T>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <T weight="800" size={16}>
              오늘 할 일 {doneToday}/{todayTasks.length}
            </T>
            <T sub size={13}>
              공부 시간 {fmtShortDur(studySec)}
            </T>
            {nextTask ? (
              <T size={13} weight="600" color={t.primary} numberOfLines={1}>
                다음 · {fmtTime(nextTask.start!)} {nextTask.title}
              </T>
            ) : (
              <T size={13} faint>
                {todayTasks.length ? '오늘 계획을 모두 마쳤거나 지났어요' : '캘린더에 할 일을 배치해 보세요'}
              </T>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.textFaint} />
        </Card>

        {/* 4개 부문 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          {sections.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => router.push(s.route as any)}
              style={({ pressed }) => ({
                width: wide ? (width - 32 - 36) / 4 : (width - 32 - 12) / 2,
                minHeight: 130,
                borderRadius: 22,
                padding: 16,
                backgroundColor: s.color,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                justifyContent: 'space-between',
              })}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={s.icon} size={24} color="#fff" />
              </View>
              <View>
                <T size={17} weight="900" color="#fff">
                  {s.title}
                </T>
                <T size={12} color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ marginTop: 2 }}>
                  {s.info}
                </T>
              </View>
            </Pressable>
          ))}
        </View>

        {/* 바로가기 */}
        <Row style={{ marginTop: 14 }} gap={8}>
          {[
            { label: '공부 시작', icon: 'play' as const, route: '/support/stopwatch', color: t.section.support },
            { label: '5분 예열', icon: 'flame' as const, route: '/support/starter', color: '#F76B15' },
            { label: '캘린더', icon: 'grid' as const, route: '/planner/calendar', color: t.section.plan },
            { label: '카드 복습', icon: 'albums' as const, route: '/study/decks', color: t.section.study },
          ].map((q) => (
            <Pressable
              key={q.label}
              onPress={() => router.push(q.route as any)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: pressed ? alpha(q.color, 0.2) : alpha(q.color, t.dark ? 0.18 : 0.1),
                gap: 4,
              })}
            >
              <Ionicons name={q.icon} size={20} color={q.color} />
              <T size={12} weight="700" color={q.color}>
                {q.label}
              </T>
            </Pressable>
          ))}
        </Row>

        {/* 2주 이내 */}
        <SectionTitle title="다가오는 일 · 2주 이내" />
        {upcoming.length === 0 ? (
          <Card>
            <Empty icon="sparkles-outline" title="2주 안에 예정된 수행평가·시험이 없어요" desc="수행/세특에서 마감일을, 계획에서 시험 날짜를 등록하면 여기에 D-day로 보여요" />
          </Card>
        ) : (
          upcoming.map((u) => {
            const d = daysUntil(u.date);
            return (
              <Pressable
                key={u.key}
                onPress={() => router.push(u.route as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: pressed ? t.surface2 : t.surface,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 8,
                })}
              >
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: u.color }} />
                <View style={{ flex: 1 }}>
                  <T weight="700" numberOfLines={1}>
                    {u.title}
                  </T>
                  <T size={12} sub>
                    {u.sub} · {fmtKDate(u.date)}
                  </T>
                </View>
                <Badge label={ddayLabel(d)} color={d <= 3 ? t.danger : d <= 7 ? t.warn : t.primary} solid={d <= 3} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
