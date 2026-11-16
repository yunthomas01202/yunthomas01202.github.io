// 계획 부문 공용 컴포넌트: 시즌/과목/할 일 편집 시트, 할 일 행, 장소 탭
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { add, batch, getState, remove, update, useData, useList } from '../../lib/store';
import type { Energy, ExamDate, Season, SeasonKind, Subject, Task, TaskKind } from '../../lib/types';
import { TASK_KIND_LABEL } from '../../lib/types';
import { SUBJECT_COLORS, energyShade, readableOn } from '../../lib/color';
import { addDays, fmtKDate, fmtMin, fmtTime, ymd, isToday } from '../../lib/date';
import {
  Btn,
  Chip,
  ColorPicker,
  DateField,
  EnergyBolts,
  EnergyPicker,
  Field,
  IconBtn,
  Label,
  Row,
  Sheet,
  Stepper,
  T,
  ToggleRow,
  confirmAsk,
  haptic,
} from '../../components/ui';
import { newId } from '../../lib/store';

/* ───────── 장소 태그 탭 ───────── */

export function PlaceTabs({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const places = useData((s) => s.settings.places);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      <Chip label="전체" small selected={value === null} onPress={() => onChange(null)} />
      {places.map((p) => (
        <Chip
          key={p.id}
          small
          label={`${p.emoji} #${p.name}`}
          selected={value === p.id}
          onPress={() => onChange(value === p.id ? null : p.id)}
        />
      ))}
    </ScrollView>
  );
}

export function matchesPlace(t: { places?: string[] }, place: string | null) {
  return !place || (t.places || []).includes(place) || (t.places || []).length === 0;
}

/* ───────── 할 일 행 ───────── */

export function TaskRow({
  task,
  subject,
  onPress,
  onToggle,
  showTime = true,
  right,
  compact,
}: {
  task: Task;
  subject?: Subject;
  onPress?: () => void;
  onToggle?: () => void;
  showTime?: boolean;
  right?: ReactNode;
  compact?: boolean;
}) {
  const t = useTheme();
  const places = useData((s) => s.settings.places);
  const color = subject?.color || '#888';
  const shade = energyShade(color, task.energy);
  const done = task.status === 'done';
  const failed = task.status === 'failed';
  const overdue = task.status === 'todo' && !!task.end && task.end < Date.now();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: compact ? 8 : 11,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: pressed ? t.surface2 : t.surface,
        marginBottom: 6,
        borderWidth: overdue ? 1.5 : 0,
        borderColor: t.danger,
      })}
    >
      <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: shade }} />
      {onToggle && (
        <Pressable hitSlop={10} onPress={onToggle}>
          <Ionicons
            name={done ? 'checkmark-circle' : failed ? 'close-circle' : 'ellipse-outline'}
            size={26}
            color={done ? t.success : failed ? t.danger : t.textFaint}
          />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <T
          weight="700"
          numberOfLines={2}
          style={{ textDecorationLine: done ? 'line-through' : 'none', opacity: done || failed ? 0.55 : 1 }}
        >
          {task.starter ? '🔥 ' : ''}
          {task.title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <EnergyBolts energy={task.energy} color={shade} size={10} />
          <T size={11} sub>
            {fmtMin(task.estMin)}
          </T>
          {showTime && task.start ? (
            <T size={11} color={overdue ? t.danger : t.textSub} weight="600">
              {isToday(task.start) ? '' : fmtKDate(task.start, false) + ' '}
              {fmtTime(task.start)}
              {task.end ? `–${fmtTime(task.end)}` : ''}
            </T>
          ) : null}
          {(task.places || []).map((pid) => {
            const p = places.find((x) => x.id === pid);
            return p ? (
              <T key={pid} size={11} faint>
                {p.emoji}
              </T>
            ) : null;
          })}
        </View>
      </View>
      {right}
    </Pressable>
  );
}

/* ───────── 할 일 편집 ───────── */

const EST_PRESETS = [15, 30, 45, 60, 90, 120];

export function TaskEditor({
  visible,
  onClose,
  task,
  seasonId,
  subjectId,
}: {
  visible: boolean;
  onClose: () => void;
  task?: Task | null;
  seasonId: string;
  subjectId?: string;
}) {
  const t = useTheme();
  const settings = useData((s) => s.settings);
  const allSubjects = useList('subjects');
  const subjects = useMemo(
    () => allSubjects.filter((s) => s.seasonId === (task?.seasonId || seasonId)).sort((a, b) => a.order - b.order),
    [allSubjects, task, seasonId],
  );
  const [title, setTitle] = useState('');
  const [sub, setSub] = useState<string | undefined>(undefined);
  const [energy, setEnergy] = useState<Energy>(3);
  const [est, setEst] = useState(50);
  const [kind, setKind] = useState<TaskKind>('concept');
  const [places, setPlaces] = useState<string[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle(task?.title || '');
    setSub(task?.subjectId || subjectId || subjects[0]?.id);
    setEnergy(task?.energy || 3);
    setEst(task?.estMin || settings.defaultBlockMin);
    setKind(task?.kind || 'concept');
    setPlaces(task?.places || []);
    setNote(task?.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, task?.id]);

  const color = subjects.find((s) => s.id === sub)?.color || t.primary;

  const save = () => {
    if (!title.trim() || !sub) return;
    if (task) {
      update('tasks', task.id, { title: title.trim(), subjectId: sub, energy, estMin: est, kind, places, note });
    } else {
      const lines = title
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      batch(
        lines.map((l) => ({
          op: 'add' as const,
          c: 'tasks' as const,
          data: {
            seasonId,
            subjectId: sub,
            title: l,
            energy,
            estMin: est,
            kind,
            places,
            note,
            status: 'todo',
            start: null,
            end: null,
          },
        })),
      );
    }
    haptic('success');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={task ? '할 일 수정' : '할 일 추가'}
      footer={
        <Row>
          {task && (
            <Btn
              title="삭제"
              variant="secondary"
              color={t.danger}
              onPress={async () => {
                if (await confirmAsk('이 할 일을 삭제할까요?', undefined, { destructive: true, okText: '삭제' })) {
                  remove('tasks', task.id);
                  onClose();
                }
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!title.trim() || !sub} />
        </Row>
      }
    >
      {subjects.length === 0 ? (
        <T sub>먼저 이 시즌에 과목을 추가해 주세요.</T>
      ) : (
        <>
          <Field
            label={task ? '할 일' : '할 일 (한 줄에 하나씩 쓰면 여러 개가 한 번에 추가돼요)'}
            value={title}
            onChangeText={setTitle}
            placeholder="예: 수학 쎈 p.30~45 풀기"
            multiline={!task}
            autoFocus={!task}
          />
          <Label>과목</Label>
          <Row wrap style={{ marginBottom: 14 }}>
            {subjects.map((s) => (
              <Chip key={s.id} label={s.name} color={s.color} selected={sub === s.id} onPress={() => setSub(s.id)} />
            ))}
          </Row>
          <Label>에너지 코스트 (할 때 얼마나 지치나요?)</Label>
          <EnergyPicker value={energy} onChange={setEnergy} color={color} />
          <View style={{ height: 14 }} />
          <Label>예상 시간</Label>
          <Row wrap style={{ marginBottom: 8 }}>
            {EST_PRESETS.map((m) => (
              <Chip key={m} small label={fmtMin(m)} selected={est === m} onPress={() => setEst(m)} />
            ))}
          </Row>
          <Stepper value={est} onChange={setEst} step={5} min={5} max={600} format={fmtMin} />
          <View style={{ height: 14 }} />
          <Label>유형</Label>
          <Row wrap style={{ marginBottom: 14 }}>
            {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => (
              <Chip key={k} small label={TASK_KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </Row>
          <Label>할 수 있는 장소 (비워두면 어디서나)</Label>
          <Row wrap style={{ marginBottom: 14 }}>
            {settings.places.map((p) => (
              <Chip
                key={p.id}
                small
                label={`${p.emoji} ${p.name}`}
                selected={places.includes(p.id)}
                onPress={() => setPlaces(places.includes(p.id) ? places.filter((x) => x !== p.id) : [...places, p.id])}
              />
            ))}
          </Row>
          <Field label="메모" value={note} onChangeText={setNote} placeholder="범위, 참고할 자료 등" />
        </>
      )}
    </Sheet>
  );
}

/* ───────── 과목 편집 ───────── */

const SUBJECT_PRESETS = ['국어', '수학', '영어', '한국사', '통합사회', '통합과학', '물리', '화학', '생명과학', '지구과학', '사회문화', '생활과 윤리', '정보', '제2외국어'];

export function SubjectEditor({
  visible,
  onClose,
  seasonId,
  subject,
}: {
  visible: boolean;
  onClose: () => void;
  seasonId: string;
  subject?: Subject | null;
}) {
  const t = useTheme();
  const axes = useData((s) => s.settings.statAxes);
  const count = useList('subjects').filter((s) => s.seasonId === seasonId).length;
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [axis, setAxis] = useState<string | undefined>();
  const [reluctant, setReluctant] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(subject?.name || '');
    setColor(subject?.color || SUBJECT_COLORS[count % SUBJECT_COLORS.length]);
    setAxis(subject?.statKey);
    setReluctant(!!subject?.reluctant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, subject?.id]);

  const autoAxis = (n: string) => axes.find((a) => n.includes(a));

  const save = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), color, statKey: axis ?? autoAxis(name) ?? null, reluctant } as any;
    if (subject) update('subjects', subject.id, data);
    else add('subjects', { ...data, seasonId, order: count });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={subject ? '과목 수정' : '과목 추가'}
      footer={
        <Row>
          {subject && (
            <Btn
              title="삭제"
              variant="secondary"
              color={t.danger}
              onPress={async () => {
                const tasks = Object.values(getState().tasks).filter((x) => x.subjectId === subject.id);
                if (
                  await confirmAsk('과목을 삭제할까요?', `이 과목의 할 일 ${tasks.length}개도 함께 삭제돼요.`, {
                    destructive: true,
                    okText: '삭제',
                  })
                ) {
                  batch([
                    ...tasks.map((x) => ({ op: 'remove' as const, c: 'tasks' as const, id: x.id })),
                    { op: 'remove', c: 'subjects', id: subject.id },
                  ]);
                  onClose();
                }
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!name.trim()} />
        </Row>
      }
    >
      <Field label="과목 이름" value={name} onChangeText={setName} placeholder="예: 수학Ⅰ" />
      {!subject && (
        <Row wrap style={{ marginTop: -6, marginBottom: 14 }}>
          {SUBJECT_PRESETS.map((p) => (
            <Chip key={p} small label={p} selected={name === p} onPress={() => setName(p)} />
          ))}
        </Row>
      )}
      <Label>과목 색</Label>
      <ColorPicker value={color} onChange={setColor} />
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 6 }}>
        {[5, 4, 3, 2, 1].map((e) => (
          <View key={e} style={{ flex: 1, height: 26, borderRadius: 6, backgroundColor: energyShade(color, e), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: readableOn(energyShade(color, e)) }}>⚡{e}</Text>
          </View>
        ))}
      </View>
      <T size={12} sub style={{ marginBottom: 14 }}>
        에너지가 높은 일일수록 짙은 색으로 표시돼요
      </T>
      <Label>헥사곤 스탯 축</Label>
      <Row wrap style={{ marginBottom: 6 }}>
        {axes.map((a) => (
          <Chip key={a} small label={a} selected={(axis ?? autoAxis(name)) === a} onPress={() => setAxis(a)} />
        ))}
      </Row>
      <ToggleRow
        label="기피 과목 (하기 싫은 과목)"
        desc="오늘 할 일에서 '딱 5분만' 예열 블록을 먼저 제안해요"
        value={reluctant}
        onChange={setReluctant}
      />
    </Sheet>
  );
}

/* ───────── 시즌 편집 ───────── */

const SEASON_PRESETS: { label: string; kind: SeasonKind; days: number }[] = [
  { label: '1학기 중간고사', kind: 'exam', days: 28 },
  { label: '1학기 기말고사', kind: 'exam', days: 35 },
  { label: '여름방학', kind: 'vacation', days: 30 },
  { label: '2학기 중간고사', kind: 'exam', days: 28 },
  { label: '2학기 기말고사', kind: 'exam', days: 35 },
  { label: '겨울방학', kind: 'vacation', days: 60 },
  { label: '모의고사', kind: 'mock', days: 21 },
];

export function SeasonEditor({ visible, onClose, season }: { visible: boolean; onClose: () => void; season?: Season | null }) {
  const t = useTheme();
  const seasons = useList('seasons');
  const allSubjects = useList('subjects');
  const [grade, setGrade] = useState<number | null>(1);
  const [preset, setPreset] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SeasonKind>('exam');
  const [start, setStart] = useState(ymd());
  const [end, setEnd] = useState(ymd(addDays(new Date(), 28)));
  const [exams, setExams] = useState<ExamDate[]>([]);
  const [goal, setGoal] = useState('');
  const [copyFrom, setCopyFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(season?.name || '');
    setKind(season?.kind || 'exam');
    setStart(season?.startDate || ymd());
    setEnd(season?.endDate || ymd(addDays(new Date(), 28)));
    setExams(season?.exams || []);
    setGoal(season?.goal || '');
    setPreset(null);
    setCopyFrom(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, season?.id]);

  const applyPreset = (g: number | null, p: string | null) => {
    setGrade(g);
    setPreset(p);
    const pr = SEASON_PRESETS.find((x) => x.label === p);
    if (pr) {
      setName(`${g ? g + '학년 ' : ''}${pr.label}`);
      setKind(pr.kind);
      if (!season) setEnd(ymd(addDays(new Date(), pr.days)));
    }
  };

  const save = () => {
    if (!name.trim()) return;
    const lastExam = exams.map((e) => e.date).sort().pop();
    const endDate = lastExam && lastExam > end ? lastExam : end;
    const data = { name: name.trim(), kind, startDate: start, endDate, exams, goal };
    if (season) update('seasons', season.id, data);
    else {
      const id = add('seasons', data);
      if (copyFrom) {
        const subs = allSubjects.filter((s) => s.seasonId === copyFrom);
        batch(
          subs.map((s) => ({
            op: 'add' as const,
            c: 'subjects' as const,
            data: { seasonId: id, name: s.name, color: s.color, statKey: s.statKey, reluctant: s.reluctant, order: s.order },
          })),
        );
      }
    }
    haptic('success');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      full
      title={season ? '시즌 수정' : '새 시즌'}
      footer={
        <Row>
          {season && (
            <Btn
              title="삭제"
              variant="secondary"
              color={t.danger}
              onPress={async () => {
                const s = getState();
                const tasks = Object.values(s.tasks).filter((x) => x.seasonId === season.id);
                const subs = Object.values(s.subjects).filter((x) => x.seasonId === season.id);
                if (
                  await confirmAsk('시즌을 삭제할까요?', `과목 ${subs.length}개, 할 일 ${tasks.length}개가 함께 삭제돼요.`, {
                    destructive: true,
                    okText: '삭제',
                  })
                ) {
                  batch([
                    ...tasks.map((x) => ({ op: 'remove' as const, c: 'tasks' as const, id: x.id })),
                    ...subs.map((x) => ({ op: 'remove' as const, c: 'subjects' as const, id: x.id })),
                    { op: 'remove', c: 'seasons', id: season.id },
                  ]);
                  onClose();
                }
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!name.trim()} />
        </Row>
      }
    >
      {!season && (
        <>
          <Label>빠른 설정</Label>
          <Row style={{ marginBottom: 8 }}>
            {[1, 2, 3].map((g) => (
              <Chip key={g} label={`${g}학년`} selected={grade === g} onPress={() => applyPreset(g, preset)} />
            ))}
          </Row>
          <Row wrap style={{ marginBottom: 16 }}>
            {SEASON_PRESETS.map((p) => (
              <Chip key={p.label} small label={p.label} selected={preset === p.label} onPress={() => applyPreset(grade, p.label)} />
            ))}
          </Row>
        </>
      )}
      <Field label="시즌 이름" value={name} onChangeText={setName} placeholder="예: 1학년 1학기 중간고사" />
      <Row>
        <View style={{ flex: 1 }}>
          <DateField label="시작" value={start} onChange={(d) => d && setStart(d)} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="끝" value={end} onChange={(d) => d && setEnd(d)} />
        </View>
      </Row>
      <Label>시험 날짜</Label>
      {exams.map((e, i) => (
        <Row key={e.id} style={{ marginBottom: 8 }}>
          <View style={{ flex: 1.2 }}>
            <Field
              value={e.label}
              onChangeText={(v) => setExams(exams.map((x, j) => (j === i ? { ...x, label: v } : x)))}
              placeholder="과목/일차"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <DateField value={e.date} onChange={(d) => d && setExams(exams.map((x, j) => (j === i ? { ...x, date: d } : x)))} />
          </View>
          <IconBtn name="trash-outline" size={18} color={t.danger} onPress={() => setExams(exams.filter((_, j) => j !== i))} />
        </Row>
      ))}
      <Btn
        title="시험 날짜 추가"
        icon="add"
        variant="secondary"
        small
        onPress={() => setExams([...exams, { id: newId(), label: exams.length ? `${exams.length + 1}일차` : '1일차', date: end }])}
        style={{ alignSelf: 'flex-start', marginBottom: 16 }}
      />
      <Field label="이번 시즌 목표" value={goal} onChangeText={setGoal} placeholder="예: 수학 2등급 → 1등급" />
      {!season && seasons.length > 0 && (
        <>
          <Label>이전 시즌의 과목 불러오기</Label>
          <Row wrap>
            {seasons.map((s) => (
              <Chip key={s.id} small label={s.name} selected={copyFrom === s.id} onPress={() => setCopyFrom(copyFrom === s.id ? null : s.id)} />
            ))}
          </Row>
        </>
      )}
    </Sheet>
  );
}
