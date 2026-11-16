// 공부 타이머 (열품타 스타일): 과목별 스톱워치, 오늘 총 공부 시간, 휴식 시간
import React, { useEffect, useMemo, useRef } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { getState, updateSettings, useData, useList } from '../../src/lib/store';
import { Btn, Card, Dot, IconBtn, ProgressBar, Row, Screen, SectionTitle, T, ToggleRow, confirmAsk, promptText, showActions, toast } from '../../src/components/ui';
import { elapsedSec, getRunning, pauseTimer, resumeTimer, useRunningTimer, useTick } from '../../src/features/support/timerStore';
import { beginStudy, endStudy } from '../../src/features/support/session';
import { pickActiveSeason } from '../../src/features/planner/logic';
import { setTaskDone } from '../../src/features/planner/actions';
import { itemColor } from '../../src/features/perf/components';
import { SUBJECT_COLORS } from '../../src/lib/color';
import { fmtClock, fmtShortDur, ymd } from '../../src/lib/date';
import { lockAvailable } from '../../src/lib/applock';

export default function Stopwatch() {
  const t = useTheme();
  const params = useLocalSearchParams<{ task?: string; perf?: string }>();
  const running = useRunningTimer();
  useTick(!!running?.segStart);
  const sessions = useList('sessions');
  const seasons = useList('seasons');
  const subjectsAll = useList('subjects');
  const settings = useData((s) => s.settings);
  const handled = useRef(false);

  const active = pickActiveSeason(seasons);
  const subjects = useMemo(() => {
    const out: { name: string; color: string }[] = [];
    const seen = new Set<string>();
    for (const s of subjectsAll.filter((x) => x.seasonId === active?.id).sort((a, b) => a.order - b.order)) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        out.push({ name: s.name, color: s.color });
      }
    }
    for (const s of settings.timerSubjects) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        out.push(s);
      }
    }
    return out;
  }, [subjectsAll, active, settings.timerSubjects]);

  // 할 일/수행 항목에서 '타이머로 시작'으로 들어온 경우 바로 시작
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const s = getState();
    let target: { name: string; color: string; taskId: string | null } | null = null;
    if (params.task && s.tasks[params.task]) {
      const task = s.tasks[params.task];
      const sub = s.subjects[task.subjectId];
      target = { name: sub?.name || task.title, color: sub?.color || SUBJECT_COLORS[5], taskId: task.id };
    } else if (params.perf && s.perfItems[params.perf]) {
      const it = s.perfItems[params.perf];
      target = { name: it.title, color: itemColor(it, s.perfCategories), taskId: null };
    }
    if (!target) return;
    const r = getRunning();
    if (r && r.taskId === target.taskId && r.subject === target.name) return;
    (async () => {
      if (r && !(await confirmAsk(`'${r.subject}' 기록을 저장하고 새로 시작할까요?`))) return;
      if (r) await endStudy();
      beginStudy(target!.name, target!.color, target!.taskId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 앱을 나가면 일시정지 (설정)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st: string) => {
      const r = getRunning();
      if (st !== 'active' && r?.segStart && getState().settings.pauseOnLeave) {
        pauseTimer();
      }
      if (st === 'active' && r && !r.segStart && getState().settings.pauseOnLeave) toast('자리를 비워서 일시정지했어요');
    });
    return () => sub.remove();
  }, []);

  const today = ymd();
  const todaySessions = sessions.filter((s) => ymd(s.start) === today);
  const bySubject: Record<string, number> = {};
  for (const s of todaySessions) bySubject[s.subject] = (bySubject[s.subject] || 0) + s.sec;
  const runSec = elapsedSec(running);
  if (running) bySubject[running.subject] = (bySubject[running.subject] || 0) + runSec;
  const totalSec = todaySessions.reduce((a, s) => a + s.sec, 0) + runSec;
  const restSec = todaySessions.reduce((a, s) => a + (s.restSec || 0), 0) + (running?.restSec || 0);

  const stop = async () => {
    const r = getRunning();
    const sec = await endStudy();
    toast(sec >= 60 ? `${fmtShortDur(sec)} 기록했어요` : '1분 미만은 기록하지 않아요');
    if (r?.taskId) {
      const task = getState().tasks[r.taskId];
      if (task && task.status === 'todo' && (await confirmAsk(`'${task.title}' 완료로 체크할까요?`, undefined, { okText: '완료' }))) setTaskDone(task, true);
    }
  };

  const toggle = async (name: string, color: string) => {
    const r = getRunning();
    if (r && r.subject === name) {
      r.segStart ? pauseTimer() : resumeTimer();
      return;
    }
    if (r) await endStudy();
    beginStudy(name, color);
  };

  const addSubject = async () => {
    const name = await promptText('타이머 과목 추가', '', { placeholder: '예: 수능특강 영어' });
    if (!name?.trim()) return;
    showActions(
      '색 고르기',
      SUBJECT_COLORS.slice(0, 8).map((c, i) => ({
        label: ['빨강', '주황', '노랑', '초록', '청록', '파랑', '남색', '보라'][i],
        icon: 'ellipse' as const,
        onPress: () => updateSettings({ timerSubjects: [...settings.timerSubjects, { name: name.trim(), color: c }] }),
      })),
    );
  };

  return (
    <Screen title="공부 타이머" accent={t.section.support} right={<IconBtn name="bar-chart-outline" onPress={() => router.push('/support/report')} />}>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }} color={t.dark ? '#0F2A27' : '#E6F7F4'}>
        <T size={13} weight="700" sub>
          오늘 총 공부 시간
        </T>
        <Text style={{ fontSize: 48, fontWeight: '900', color: t.text, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{fmtClock(totalSec)}</Text>
        <View style={{ width: '80%', marginTop: 6 }}>
          <ProgressBar value={totalSec / 60 / Math.max(1, settings.dailyGoalMin)} color={t.section.support} />
        </View>
        <T size={12} sub style={{ marginTop: 6 }}>
          목표 {fmtShortDur(settings.dailyGoalMin * 60)} · 휴식 {fmtShortDur(restSec)}
        </T>
      </Card>

      {running && (
        <Card style={{ marginTop: 12, borderWidth: 2, borderColor: running.color }}>
          <Row>
            <Dot color={running.color} size={12} />
            <T weight="800" size={16} style={{ flex: 1 }} numberOfLines={1}>
              {running.subject}
              {running.source === 'starter' ? ' (예열에서 이어감)' : ''}
            </T>
            <T size={12} color={running.segStart ? t.success : t.warn} weight="800">
              {running.segStart ? '● 공부 중' : '❚❚ 휴식 중'}
            </T>
          </Row>
          <Text style={{ fontSize: 40, fontWeight: '900', color: running.color, fontVariant: ['tabular-nums'], marginVertical: 8 }}>{fmtClock(runSec)}</Text>
          <Row>
            <Btn title={running.segStart ? '휴식' : '계속'} icon={running.segStart ? 'pause' : 'play'} flex variant="secondary" color={running.color} onPress={() => (running.segStart ? pauseTimer() : resumeTimer())} />
            <Btn title="끝내기" icon="stop" flex color={t.danger} onPress={stop} />
            <Btn title="" icon="expand" variant="secondary" onPress={() => router.push('/support/focus')} />
          </Row>
        </Card>
      )}

      <SectionTitle title="과목" right={<Btn small variant="ghost" icon="add" title="과목 추가" onPress={addSubject} />} />
      {subjects.length === 0 && (
        <T sub size={13} style={{ marginBottom: 8 }}>
          계획 부문에서 시즌 과목을 만들거나, ‘과목 추가’로 타이머 전용 과목을 만들어요.
        </T>
      )}
      {subjects.map((s) => {
        const on = running?.subject === s.name;
        return (
          <Pressable
            key={s.name}
            onPress={() => toggle(s.name, s.color)}
            onLongPress={() => {
              if (settings.timerSubjects.some((x) => x.name === s.name))
                showActions(s.name, [
                  { label: '타이머 과목에서 빼기', icon: 'trash-outline', destructive: true, onPress: () => updateSettings({ timerSubjects: settings.timerSubjects.filter((x) => x.name !== s.name) }) },
                ]);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 16,
              marginBottom: 8,
              backgroundColor: pressed ? t.surface2 : t.surface,
              borderWidth: on ? 2 : 0,
              borderColor: s.color,
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={on && running?.segStart ? 'pause' : 'play'} size={20} color="#fff" />
            </View>
            <T weight="700" style={{ flex: 1 }}>
              {s.name}
            </T>
            <T weight="800" style={{ fontVariant: ['tabular-nums'] }} color={on ? s.color : t.textSub}>
              {fmtClock(bySubject[s.name] || 0)}
            </T>
          </Pressable>
        );
      })}

      <SectionTitle title="집중 설정" />
      <Card>
        <ToggleRow label="앱을 나가면 자동 일시정지" desc="다른 앱을 쓰는 시간은 공부 시간에서 빠져요" value={settings.pauseOnLeave} onChange={(v) => updateSettings({ pauseOnLeave: v })} />
        <ToggleRow
          label="타이머를 켜면 앱 잠금"
          desc={lockAvailable() ? '공부 도구 › 앱 잠금에서 고른 앱을 공부하는 동안 막아요' : '개발 빌드에서만 쓸 수 있어요'}
          value={settings.lockApps.withTimer}
          onChange={(v) => updateSettings({ lockApps: { ...settings.lockApps, withTimer: v } })}
        />
      </Card>
    </Screen>
  );
}
