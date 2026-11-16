// 시즌 상세: 시험 날짜, 과목별 할 일, 진행률
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme';
import { useData, useDoc, useList } from '../../../src/lib/store';
import { Badge, Btn, Card, Dot, Empty, IconBtn, ProgressBar, Row, Screen, SectionTitle, T } from '../../../src/components/ui';
import { PlaceTabs, SeasonEditor, SubjectEditor, TaskEditor, TaskRow, matchesPlace } from '../../../src/features/planner/components';
import { setTaskDone } from '../../../src/features/planner/actions';
import type { Subject, Task } from '../../../src/lib/types';
import { daysUntil, ddayLabel, fmtKDate, fmtMin } from '../../../src/lib/date';

export default function SeasonDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const season = useDoc('seasons', id);
  const allSubjects = useList('subjects');
  const allTasks = useList('tasks');
  const subjectsMap = useData((s) => s.subjects);
  const [place, setPlace] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [seasonEdit, setSeasonEdit] = useState(false);
  const [subEdit, setSubEdit] = useState<{ open: boolean; subject: Subject | null }>({ open: false, subject: null });
  const [taskEdit, setTaskEdit] = useState<{ open: boolean; task: Task | null; subjectId?: string }>({ open: false, task: null });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const subjects = useMemo(() => allSubjects.filter((s) => s.seasonId === id).sort((a, b) => a.order - b.order), [allSubjects, id]);
  const tasks = useMemo(() => allTasks.filter((x) => x.seasonId === id && !x.starter), [allTasks, id]);

  if (!season) {
    return (
      <Screen title="시즌">
        <Empty title="시즌을 찾을 수 없어요" />
      </Screen>
    );
  }

  const done = tasks.filter((x) => x.status === 'done').length;
  const totalMin = tasks.filter((x) => x.status === 'todo').reduce((a, x) => a + x.estMin, 0);
  const exams = [...(season.exams || [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Screen
      title={season.name}
      subtitle={`${fmtKDate(season.startDate, false)} ~ ${fmtKDate(season.endDate, false)}`}
      accent={t.section.plan}
      right={<IconBtn name="create-outline" onPress={() => setSeasonEdit(true)} />}
    >
      {exams.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <T weight="800" style={{ marginBottom: 8 }}>
            시험 일정
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {exams.map((e) => {
              const d = daysUntil(e.date);
              return (
                <View key={e.id} style={{ backgroundColor: t.surface2, borderRadius: 12, padding: 10, minWidth: 96 }}>
                  <T size={12} sub>
                    {fmtKDate(e.date)}
                  </T>
                  <T weight="800">{e.label}</T>
                  <T size={13} weight="900" color={d < 0 ? t.textFaint : d <= 3 ? t.danger : t.section.plan}>
                    {d < 0 ? '끝' : ddayLabel(d)}
                  </T>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      <Card style={{ marginBottom: 12 }}>
        <Row>
          <T weight="800" style={{ flex: 1 }}>
            전체 진행률
          </T>
          <T weight="900" color={t.section.plan}>
            {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
          </T>
        </Row>
        <View style={{ marginVertical: 8 }}>
          <ProgressBar value={tasks.length ? done / tasks.length : 0} color={t.section.plan} height={10} />
        </View>
        <T size={12} sub>
          {done}/{tasks.length} 완료 · 남은 예상 시간 {fmtMin(totalMin)}
        </T>
        {season.goal ? (
          <T size={13} weight="600" style={{ marginTop: 8 }}>
            🎯 {season.goal}
          </T>
        ) : null}
        <Row style={{ marginTop: 14 }}>
          <Btn title="캘린더에 배치하기" icon="grid-outline" flex onPress={() => router.push(`/planner/calendar?season=${season.id}`)} />
          <Btn
            title="할 일"
            icon="add"
            variant="secondary"
            onPress={() => setTaskEdit({ open: true, task: null })}
            disabled={subjects.length === 0}
          />
        </Row>
      </Card>

      <PlaceTabs value={place} onChange={setPlace} />

      <SectionTitle
        title={`과목 ${subjects.length}`}
        right={
          <Row gap={4}>
            <Btn small variant="ghost" title={showDone ? '완료 숨기기' : '완료 보기'} onPress={() => setShowDone(!showDone)} />
            <Btn small variant="secondary" icon="add" title="과목" onPress={() => setSubEdit({ open: true, subject: null })} />
          </Row>
        }
      />

      {subjects.length === 0 && (
        <Empty icon="book-outline" title="과목을 먼저 추가하세요" desc="과목마다 색을 정하면 캘린더 블록이 그 색으로 칠해져요" />
      )}

      {subjects.map((s) => {
        const list = tasks
          .filter((x) => x.subjectId === s.id && matchesPlace(x, place) && (showDone || x.status !== 'done'))
          .sort((a, b) => (a.status === 'todo' ? 0 : 1) - (b.status === 'todo' ? 0 : 1) || b.energy - a.energy);
        const all = tasks.filter((x) => x.subjectId === s.id);
        const d = all.filter((x) => x.status === 'done').length;
        const isCol = collapsed[s.id];
        return (
          <View key={s.id} style={{ marginBottom: 14 }}>
            <Pressable
              onPress={() => setCollapsed({ ...collapsed, [s.id]: !isCol })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
            >
              <Dot color={s.color} size={12} />
              <T weight="800" size={16}>
                {s.name}
              </T>
              {s.reluctant && <Badge label="기피" color="#F76B15" />}
              <T size={12} sub>
                {d}/{all.length}
              </T>
              <View style={{ flex: 1 }} />
              <IconBtn name="settings-outline" size={18} onPress={() => setSubEdit({ open: true, subject: s })} />
              <IconBtn name="add" size={20} onPress={() => setTaskEdit({ open: true, task: null, subjectId: s.id })} />
              <Ionicons name={isCol ? 'chevron-down' : 'chevron-up'} size={18} color={t.textFaint} />
            </Pressable>
            <View style={{ marginBottom: 6 }}>
              <ProgressBar value={all.length ? d / all.length : 0} color={s.color} height={5} />
            </View>
            {!isCol &&
              (list.length === 0 ? (
                <T size={13} faint style={{ paddingVertical: 8 }}>
                  {all.length ? '조건에 맞는 할 일이 없어요' : '+ 를 눌러 할 일을 추가하세요'}
                </T>
              ) : (
                list.map((x) => (
                  <TaskRow
                    key={x.id}
                    task={x}
                    subject={subjectsMap[x.subjectId]}
                    onToggle={() => setTaskDone(x, x.status !== 'done')}
                    onPress={() => setTaskEdit({ open: true, task: x })}
                  />
                ))
              ))}
          </View>
        );
      })}

      <SeasonEditor visible={seasonEdit} season={season} onClose={() => setSeasonEdit(false)} />
      <SubjectEditor
        visible={subEdit.open}
        subject={subEdit.subject}
        seasonId={season.id}
        onClose={() => setSubEdit({ open: false, subject: null })}
      />
      <TaskEditor
        visible={taskEdit.open}
        task={taskEdit.task}
        seasonId={season.id}
        subjectId={taskEdit.subjectId}
        onClose={() => setTaskEdit({ open: false, task: null })}
      />
    </Screen>
  );
}
