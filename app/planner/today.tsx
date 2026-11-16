// 오늘 실행: 실제로 보고, 완료 체크하는 화면 (장소 태그 기반 보기 포함)
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useData, useList } from '../../src/lib/store';
import { Badge, Btn, Card, Empty, IconBtn, Row, Screen, SectionTitle, T } from '../../src/components/ui';
import { Ring } from '../../src/components/charts';
import { PlaceTabs, TaskEditor, TaskRow, matchesPlace } from '../../src/features/planner/components';
import { scheduleTask, setTaskDone } from '../../src/features/planner/actions';
import { pickActiveSeason, taskXP } from '../../src/features/planner/logic';
import { addDays, fmtKDate, fmtTime, isToday, roundTo, ymd } from '../../src/lib/date';
import { energyShade } from '../../src/lib/color';
import type { Task } from '../../src/lib/types';

export default function Today() {
  const t = useTheme();
  const tasks = useList('tasks');
  const seasons = useList('seasons');
  const subjects = useData((s) => s.subjects);
  const places = useData((s) => s.settings.places);
  const [place, setPlace] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [edit, setEdit] = useState<Task | null>(null);
  const day = ymd(addDays(new Date(), offset));
  const now = Date.now();
  const active = pickActiveSeason(seasons);

  const dayTasks = useMemo(
    () => tasks.filter((x) => x.start && ymd(x.start) === day && x.status !== 'failed').sort((a, b) => a.start! - b.start!),
    [tasks, day],
  );
  const shown = dayTasks.filter((x) => matchesPlace(x, place));
  const done = dayTasks.filter((x) => x.status === 'done');
  const xpToday = done.reduce((a, x) => a + taskXP(x), 0);
  const current = offset === 0 ? dayTasks.find((x) => x.status === 'todo' && x.start! <= now && x.end! > now) : undefined;

  // 5분 예열 추천: 기피 과목이거나 에너지 4 이상인 아직 안 한 일
  const starter = useMemo(() => {
    if (offset !== 0) return undefined;
    const pool = dayTasks.filter((x) => x.status === 'todo' && !x.starter && (x.end || 0) > now);
    return pool.find((x) => subjects[x.subjectId]?.reluctant) || pool.find((x) => x.energy >= 4);
  }, [dayTasks, subjects, offset, now]);

  // 장소 탭: 여기서 할 수 있는 (아직 배치 안 한) 일
  const here = useMemo(() => {
    if (!place) return [];
    return tasks
      .filter((x) => x.status === 'todo' && !x.start && (x.places || []).includes(place) && (!active || x.seasonId === active.id))
      .sort((a, b) => b.energy - a.energy);
  }, [tasks, place, active]);
  const placeName = places.find((p) => p.id === place);

  return (
    <Screen
      title={offset === 0 ? '오늘 실행' : fmtKDate(day)}
      subtitle={offset === 0 ? fmtKDate(day) : offset > 0 ? `${offset}일 뒤` : `${-offset}일 전`}
      accent={t.section.plan}
      right={
        <Row gap={0}>
          <IconBtn name="chevron-back" size={20} onPress={() => setOffset(offset - 1)} />
          <IconBtn name="today-outline" size={20} onPress={() => setOffset(0)} />
          <IconBtn name="chevron-forward" size={20} onPress={() => setOffset(offset + 1)} />
          <IconBtn name="grid-outline" size={20} onPress={() => router.push('/planner/calendar')} />
        </Row>
      }
    >
      <T size={12} weight="700" sub style={{ marginBottom: 2 }}>
        지금 어디에 있나요?
      </T>
      <PlaceTabs value={place} onChange={setPlace} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
        <Ring size={84} stroke={10} progress={dayTasks.length ? done.length / dayTasks.length : 0} color={t.success}>
          <T weight="900" size={17}>
            {done.length}/{dayTasks.length}
          </T>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <T weight="800" size={16}>
            {dayTasks.length === 0 ? '배치된 일이 없어요' : done.length === dayTasks.length ? '전부 끝냈어요! 🎉' : `${dayTasks.length - done.length}개 남았어요`}
          </T>
          <T sub size={13}>
            오늘 얻은 경험치 +{xpToday} XP
          </T>
          {dayTasks.length === 0 && (
            <Btn small title="캘린더에서 배치하기" variant="secondary" onPress={() => router.push('/planner/calendar')} style={{ alignSelf: 'flex-start' }} />
          )}
        </View>
      </Card>

      {current && (
        <Card style={{ marginTop: 12, borderWidth: 2, borderColor: energyShade(subjects[current.subjectId]?.color || t.primary, 4) }}>
          <Row>
            <Badge label="지금 할 일" color={t.primary} solid />
            <T size={12} sub>
              {fmtTime(current.start!)}–{fmtTime(current.end!)}
            </T>
          </Row>
          <T size={20} weight="900" style={{ marginVertical: 8 }}>
            {current.title}
          </T>
          <Row>
            <Btn title="완료" icon="checkmark" color={t.success} flex onPress={() => setTaskDone(current, true)} />
            <Btn title="타이머 시작" icon="play" variant="secondary" flex onPress={() => router.push(`/support/stopwatch?task=${current.id}`)} />
          </Row>
        </Card>
      )}

      {starter && (
        <Card style={{ marginTop: 12, backgroundColor: t.dark ? '#3A2414' : '#FFF4EA' }}>
          <T weight="900" color="#F76B15">
            🔥 하기 싫다면, 딱 5분만
          </T>
          <T size={13} sub style={{ marginTop: 4, marginBottom: 10 }}>
            '{starter.title}' — 시작이 제일 어려워요. 5분만 하고 덮어도 괜찮아요.
          </T>
          <Btn title="5분 예열 시작" icon="flame" color="#F76B15" onPress={() => router.push(`/support/starter?task=${starter.id}`)} />
        </Card>
      )}

      <SectionTitle title={place ? `${placeName?.emoji} #${placeName?.name}에서 할 일` : '타임라인'} />
      {shown.length === 0 ? (
        <Empty icon="calendar-clear-outline" title={place ? '이 장소 태그가 붙은 일정이 없어요' : '이 날 배치된 일정이 없어요'} />
      ) : (
        shown.map((x) => (
          <TaskRow
            key={x.id}
            task={x}
            subject={subjects[x.subjectId]}
            onToggle={() => setTaskDone(x, x.status !== 'done')}
            onPress={() => setEdit(x)}
            right={
              x.status === 'todo' ? (
                <IconBtn name="play-circle" size={26} color={t.primary} onPress={() => router.push(`/support/stopwatch?task=${x.id}`)} />
              ) : undefined
            }
          />
        ))
      )}

      {place && (
        <>
          <SectionTitle title="여기서 할 수 있는 일 (미배치)" />
          {here.length === 0 ? (
            <T size={13} faint>
              이 장소 태그가 붙은 남은 할 일이 없어요
            </T>
          ) : (
            here.map((x) => (
              <TaskRow
                key={x.id}
                task={x}
                subject={subjects[x.subjectId]}
                onPress={() => setEdit(x)}
                right={
                  <Btn
                    small
                    title="지금 하기"
                    onPress={() => {
                      const s = roundTo(Date.now(), 5);
                      scheduleTask(x.id, s);
                      router.push(`/support/stopwatch?task=${x.id}`);
                    }}
                  />
                }
              />
            ))
          )}
        </>
      )}

      {offset === 0 && isToday(day) && dayTasks.some((x) => x.status === 'todo' && x.end! < now) && (
        <Btn title="놓친 일 정리하기" icon="alert-circle" color={t.danger} variant="secondary" style={{ marginTop: 16 }} onPress={() => router.push('/failure')} />
      )}

      <TaskEditor visible={!!edit} task={edit} seasonId={edit?.seasonId || ''} onClose={() => setEdit(null)} />
    </Screen>
  );
}
