// 공부 도구 부문 허브
import React, { useMemo } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../src/theme';
import { useData, useList } from '../../src/lib/store';
import { Card, Row, Screen, SectionTitle, T } from '../../src/components/ui';
import { Ring } from '../../src/components/charts';
import { elapsedSec, useRunningTimer, useTick } from '../../src/features/support/timerStore';
import { fmtClock, fmtShortDur, ymd } from '../../src/lib/date';
import { alpha } from '../../src/lib/color';

export default function SupportHub() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const sessions = useList('sessions');
  const links = useList('links');
  const goal = useData((s) => s.settings.dailyGoalMin);
  const running = useRunningTimer();
  useTick(!!running);
  const today = ymd();
  const todaySec = useMemo(() => sessions.filter((s) => ymd(s.start) === today).reduce((a, s) => a + s.sec, 0), [sessions, today]) + elapsedSec(running);

  const tiles = [
    { title: '공부 타이머', desc: '과목별 기록 · 열품타 스타일', icon: 'stopwatch' as const, color: '#12A594', route: '/support/stopwatch' },
    { title: '5분 예열', desc: '하기 싫을 땐 딱 5분만', icon: 'flame' as const, color: '#F76B15', route: '/support/starter' },
    { title: '무음 타이머', desc: '소리 없이 화면으로만', icon: 'hourglass' as const, color: '#3E63DD', route: '/support/timer' },
    { title: '공부 리포트', desc: '일·주·월 그래프', icon: 'bar-chart' as const, color: '#8E4EC6', route: '/support/report' },
    { title: '앱 잠금', desc: '공부 중 다른 앱 막기', icon: 'lock-closed' as const, color: '#E5484D', route: '/support/lock' },
    { title: '알람', desc: '벨 · 진동 · 내 음악', icon: 'alarm' as const, color: '#F5A524', route: '/support/alarm' },
    { title: '링크', desc: links.length ? `${links.length}개 바로가기` : '자주 가는 사이트', icon: 'link' as const, color: '#687076', route: '/support/links' },
  ];
  const cols = width >= 700 ? 3 : 2;
  const w = (Math.min(width, 1100) - 32 - (cols - 1) * 12) / cols;

  return (
    <Screen title="공부 도구" accent={t.section.support}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} onPress={() => router.push(running ? '/support/stopwatch' : '/support/report')}>
        <Ring size={96} stroke={11} progress={todaySec / 60 / Math.max(1, goal)} color={t.section.support}>
          <T weight="900" size={16}>
            {Math.round((todaySec / 60 / Math.max(1, goal)) * 100)}%
          </T>
        </Ring>
        <View style={{ flex: 1 }}>
          <T size={13} sub>
            오늘 공부한 시간
          </T>
          <T size={28} weight="900" style={{ fontVariant: ['tabular-nums'] }}>
            {fmtClock(todaySec)}
          </T>
          <T size={12} sub>
            목표 {fmtShortDur(goal * 60)}
          </T>
          {running && (
            <T size={13} weight="800" color={t.section.support} style={{ marginTop: 4 }}>
              ● {running.subject} {running.segStart ? '공부 중' : '일시정지'}
            </T>
          )}
        </View>
      </Card>

      <SectionTitle title="도구" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((x) => (
          <Pressable
            key={x.title}
            onPress={() => router.push(x.route as any)}
            style={({ pressed }) => ({ width: w, padding: 16, borderRadius: 20, backgroundColor: pressed ? t.surface2 : t.surface, gap: 10, ...(t.shadow as object) })}
          >
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: alpha(x.color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={x.icon} size={23} color={x.color} />
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

      {links.length > 0 && (
        <>
          <SectionTitle title="바로가기" />
          <Row wrap gap={8}>
            {links
              .sort((a, b) => a.order - b.order)
              .slice(0, 8)
              .map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => WebBrowser.openBrowserAsync(l.url)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: t.surface }}
                >
                  <T>{l.emoji}</T>
                  <T weight="700" size={13}>
                    {l.title}
                  </T>
                </Pressable>
              ))}
          </Row>
        </>
      )}
    </Screen>
  );
}
