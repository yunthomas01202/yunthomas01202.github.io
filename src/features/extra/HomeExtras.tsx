// 홈 화면 추가 카드: 지금/다음 교시, 오늘 급식, 연속 공부, 오답·마감 바로가기
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { alpha } from '../../lib/color';
import { useData, useList } from '../../lib/store';
import { todayLunch } from '../../lib/neis';
import { fmtTime, ymd } from '../../lib/date';
import { Card, Row, T } from '../../components/ui';
import { useNowNext } from './nowNext';
import { isDue, streakInfo, studyMinutesByDay } from './logic';

function useMinuteTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  return n;
}

export function NowNextCard() {
  const t = useTheme();
  const tick = useMinuteTick();
  const nn = useNowNext(tick);
  const school = useData((s) => s.settings.school);
  const [lunch, setLunch] = useState<string | null>(null);
  useEffect(() => {
    todayLunch().then(setLunch);
  }, [school?.code]);
  if (!nn.now && !nn.next && !lunch) return null;
  const left = nn.now ? Math.max(1, Math.ceil((nn.now.end - Date.now()) / 60000)) : 0;
  const until = nn.next ? Math.max(1, Math.ceil((nn.next.start - Date.now()) / 60000)) : 0;
  const isTomorrow = nn.next && nn.next.date !== ymd();
  return (
    <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }} onPress={() => router.push('/planner/calendar')}>
      <View style={{ padding: 16, backgroundColor: alpha(t.primary, t.dark ? 0.22 : 0.1) }}>
        {nn.now ? (
          <>
            <T size={12} weight="800" color={t.primary}>
              지금
            </T>
            <Row style={{ marginTop: 2 }}>
              <T size={22} weight="900" style={{ flex: 1 }} numberOfLines={1}>
                {nn.now.title}
              </T>
              <T size={15} weight="800" color={t.primary}>
                {left}분 남음
              </T>
            </Row>
          </>
        ) : (
          <T size={15} weight="800">
            지금은 고정 일정이 없어요
          </T>
        )}
        {nn.next ? (
          <T size={13} sub style={{ marginTop: 6 }}>
            다음 · {nn.next.title} {isTomorrow ? `내일 ${fmtTime(nn.next.start)}` : `${fmtTime(nn.next.start)} (${until}분 뒤)`}
          </T>
        ) : null}
      </View>
      {lunch ? (
        <Pressable onPress={() => router.push('/support/school')} style={{ flexDirection: 'row', gap: 8, padding: 12, paddingHorizontal: 16, alignItems: 'center' }}>
          <T size={16}>🍚</T>
          <T size={13} style={{ flex: 1 }} numberOfLines={2}>
            {lunch}
          </T>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function ExtraShortcuts() {
  const t = useTheme();
  const sessions = useList('sessions');
  const wrong = useList('wrongNotes');
  const hw = useList('homework');
  const minMin = useData((s) => s.settings.streakMin ?? 10);
  const streak = useMemo(() => streakInfo(studyMinutesByDay(sessions), minMin), [sessions, minMin]);
  const today = ymd();
  const dueWrong = wrong.filter((n) => isDue(n, today)).length;
  const openHw = hw.filter((h) => !h.done && h.due <= ymd(new Date(Date.now() + 86400000))).length;
  const items = [
    { label: streak.current ? `${streak.current}일 연속` : '연속 공부', emoji: streak.doneToday ? '🔥' : '🌱', route: '/support/streak', badge: 0 },
    { label: '오답 노트', emoji: '📒', route: '/support/wrong', badge: dueWrong },
    { label: '마감', emoji: '⏰', route: '/support/homework', badge: openHw },
    { label: '급식·학사', emoji: '🏫', route: '/support/school', badge: 0 },
    { label: '배경음', emoji: '🎧', route: '/support/sound', badge: 0 },
    { label: '수면', emoji: '🌙', route: '/support/sleep', badge: 0 },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {items.map((q) => (
        <Pressable
          key={q.route}
          onPress={() => router.push(q.route as any)}
          style={({ pressed }) => ({
            width: '31.5%',
            flexGrow: 1,
            alignItems: 'center',
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: pressed ? t.surface2 : t.surface,
            gap: 4,
          })}
        >
          <T size={20}>{q.emoji}</T>
          <T size={12} weight="700" sub>
            {q.label}
          </T>
          {q.badge > 0 && (
            <View style={{ position: 'absolute', top: 6, right: 10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <T size={11} weight="900" color="#fff">
                {q.badge}
              </T>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
