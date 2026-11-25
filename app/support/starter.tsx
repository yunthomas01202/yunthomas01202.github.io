// 5분 예열: 하기 싫은 과목은 '딱 5분만' → 5분이 지나면 계속할지 묻기
import { AmbientPanel } from '../../src/features/extra/AmbientPanel';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../../src/theme';
import { getState, useData, useList } from '../../src/lib/store';
import { Btn, Card, Dot, Empty, Row, Screen, SectionTitle, T, confirmAsk, haptic, toast } from '../../src/components/ui';
import { Ring } from '../../src/components/charts';
import { elapsedSec, getRunning, useRunningTimer, useTick } from '../../src/features/support/timerStore';
import { beginStudy, endStudy } from '../../src/features/support/session';
import { pickActiveSeason } from '../../src/features/planner/logic';
import { setTaskDone } from '../../src/features/planner/actions';
import { cancelById, scheduleAt } from '../../src/lib/notify';
import { fmtTime, ymd } from '../../src/lib/date';
import type { Task } from '../../src/lib/types';

const FIVE = 5 * 60;

function Awake() {
  useKeepAwake();
  return null;
}

export default function Starter() {
  const t = useTheme();
  const params = useLocalSearchParams<{ task?: string }>();
  const running = useRunningTimer();
  const isStarter = running?.source === 'starter';
  useTick(!!isStarter);
  const tasks = useList('tasks');
  const subjects = useData((s) => s.subjects);
  const seasons = useList('seasons');
  const [asked, setAsked] = useState(false);
  const notif = useRef<string | null>(null);
  const autostarted = useRef(false);

  const elapsed = isStarter ? elapsedSec(running) : 0;
  const left = Math.max(0, FIVE - elapsed);

  // 추천: 오늘 할 일 중 기피 과목 → 에너지 높은 순
  const suggestions = useMemo(() => {
    const today = ymd();
    const active = pickActiveSeason(seasons);
    return tasks
      .filter((x) => x.status === 'todo' && !x.starter && ((x.start && ymd(x.start) === today) || (!x.start && x.seasonId === active?.id)))
      .sort((a, b) => Number(!!subjects[b.subjectId]?.reluctant) - Number(!!subjects[a.subjectId]?.reluctant) || b.energy - a.energy)
      .slice(0, 8);
  }, [tasks, subjects, seasons]);

  const begin = async (task: Task | null, name?: string, color?: string) => {
    const r = getRunning();
    if (r && !(await confirmAsk(`'${r.subject}' 타이머를 저장하고 예열을 시작할까요?`))) return;
    if (r) await endStudy();
    const sub = task ? subjects[task.subjectId] : undefined;
    await beginStudy(sub?.name || name || '예열', sub?.color || color || '#F76B15', task?.id || null, 'starter');
    setAsked(false);
    notif.current = await scheduleAt('🔥 5분 끝!', '여기서 멈춰도 괜찮아요. 조금 더 해볼까요?', Date.now() + FIVE * 1000, 'starter');
  };

  useEffect(() => {
    if (autostarted.current || !params.task) return;
    autostarted.current = true;
    const task = getState().tasks[params.task];
    if (task && !(getRunning()?.source === 'starter' && getRunning()?.taskId === task.id)) begin(task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isStarter && left === 0 && !asked) {
      setAsked(true);
      haptic('success');
    }
  }, [isStarter, left, asked]);

  const keepGoing = () => {
    cancelById(notif.current);
    setAsked(false);
    router.replace('/support/stopwatch');
  };
  const stopHere = async () => {
    cancelById(notif.current);
    const r = getRunning();
    await endStudy();
    setAsked(false);
    if (r?.taskId) {
      const task = getState().tasks[r.taskId];
      if (task?.starter) setTaskDone(task, true);
    }
    toast('5분 해냈어요. 시작한 것 자체가 제일 어려운 일이었어요 👏');
    router.back();
  };

  if (isStarter && running) {
    const mm = Math.floor(left / 60);
    const ss = left % 60;
    return (
      <Screen title="5분 예열" accent="#F76B15" scroll={false}>
        <Awake />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <T size={16} weight="800" color={running.color}>
            {running.subject}
          </T>
          <Ring size={260} stroke={16} progress={elapsed / FIVE} color="#F76B15">
            <Text style={{ fontSize: 60, fontWeight: '200', color: t.text, fontVariant: ['tabular-nums'] }}>
              {left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : '5:00 ✓'}
            </Text>
          </Ring>
          <T sub center style={{ lineHeight: 22 }}>
            {left > 0 ? '딱 5분만 해보세요.\n끝나면 덮어도 돼요.' : `5분을 넘겨 ${Math.floor((elapsed - FIVE) / 60)}분째 계속하는 중이에요!`}
          </T>
          <Row>
            <Btn title="그만하기" variant="secondary" onPress={stopHere} />
            <Btn title="공부 타이머로 이어가기" color="#F76B15" onPress={keepGoing} />
          </Row>
        </View>
        <Modal visible={asked} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: t.surface, borderRadius: 26, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 50 }}>🔥</Text>
              <T size={22} weight="900">
                5분 끝!
              </T>
              <T sub center>
                예열 완료. 몸이 풀렸다면 조금 더 이어가 볼까요?{'\n'}여기서 멈춰도 오늘은 '시작한 날'이에요.
              </T>
              <Btn title="계속 공부하기" color="#F76B15" onPress={keepGoing} style={{ alignSelf: 'stretch', marginTop: 8 }} />
              <Btn title="여기서 멈추기" variant="secondary" onPress={stopHere} style={{ alignSelf: 'stretch' }} />
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  return (
    <Screen title="5분 예열" subtitle="공부는 시작 직전이 제일 힘들어요" accent="#F76B15">
      <Card color={t.dark ? '#3A2414' : '#FFF4EA'}>
        <T weight="900" size={17} color="#F76B15">
          🔥 딱 5분만 하고 덮기
        </T>
        <T sub size={13} style={{ marginTop: 6, lineHeight: 20 }}>
          하기 싫은 과목은 '5분만' 약속하고 시작하세요. 5분이 지나면 계속할지 물어봐요. 대부분은 그대로 이어가게 돼요.
        </T>
      </Card>
      <SectionTitle title="추천 (기피 과목 · 힘든 일 먼저)" />
      {suggestions.length === 0 ? (
        <Empty icon="flame-outline" title="예열할 할 일이 없어요" desc="계획 부문에서 할 일을 만들고, 하기 싫은 과목은 '기피 과목'으로 표시해 두세요" />
      ) : (
        suggestions.map((x) => {
          const sub = subjects[x.subjectId];
          return (
            <Pressable
              key={x.id}
              onPress={() => begin(x)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: pressed ? t.surface2 : t.surface, marginBottom: 8 })}
            >
              <Dot color={sub?.color || '#888'} size={12} />
              <View style={{ flex: 1 }}>
                <T weight="700" numberOfLines={1}>
                  {x.title}
                </T>
                <T size={12} sub>
                  {sub?.name}
                  {sub?.reluctant ? ' · 기피 과목' : ''} · {'⚡'.repeat(x.energy)}
                  {x.start ? ` · ${fmtTime(x.start)}` : ''}
                </T>
              </View>
              <T weight="800" color="#F76B15">
                5분 시작
              </T>
            </Pressable>
          );
        })
      )}
      <Btn title="그냥 5분 시작" variant="secondary" color="#F76B15" style={{ marginTop: 10 }} onPress={() => begin(null, '예열', '#F76B15')} />
      <AmbientPanel compact style={{ marginTop: 12 }} />
    </Screen>
  );
}
