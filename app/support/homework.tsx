// 수행평가·숙제 마감 트래커: 마감일별로 모아 보고, 전날·당일 알림
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { remove, update, updateSettings, useData, useList } from '../../src/lib/store';
import { HOMEWORK_KIND_LABEL, type Homework, type HomeworkKind } from '../../src/lib/types';
import { addHomework } from '../../src/features/extra/logic';
import { addDays, daysUntil, ddayLabel, fmtKDate, ymd } from '../../src/lib/date';
import { Badge, Btn, Card, Chip, DateField, Empty, Field, Label, Row, Screen, Segmented, Sheet, Stepper, T, ToggleRow, confirmAsk, promptText, toast } from '../../src/components/ui';

const ACCENT = '#F76B15';
const KIND_COLOR: Record<HomeworkKind, string> = { perf: '#F76B15', homework: '#3E63DD', exam: '#E5484D', etc: '#687076' };

interface Row_ {
  id: string;
  title: string;
  subject: string;
  kind: HomeworkKind;
  due: string;
  dueMin?: number | null;
  done: boolean;
  fromPerf?: boolean;
  hw?: Homework;
}

export default function HomeworkScreen() {
  const t = useTheme();
  const hws = useList('homework');
  const perf = useList('perfItems');
  const cats = useData((s) => s.perfCategories);
  const notify = useData((s) => s.settings.homeworkNotify) || { dayBefore: true, dayBeforeHour: 20, dayOf: true, dayOfHour: 7 };
  const [edit, setEdit] = useState<Homework | 'new' | null>(null);
  const [showDone, setShowDone] = useState(false);
  const today = ymd();

  const rows: Row_[] = useMemo(() => {
    const a: Row_[] = hws.map((h) => ({ ...h, hw: h }));
    for (const p of perf) {
      if (!p.dueDate) continue;
      a.push({ id: 'perf:' + p.id, title: p.title, subject: cats[p.categoryId]?.name || '', kind: 'perf', due: p.dueDate, done: p.status === 'done', fromPerf: true });
    }
    return a.sort((x, y) => (x.due + (x.dueMin ?? 1439)).localeCompare(y.due + (y.dueMin ?? 1439)));
  }, [hws, perf, cats]);

  const open = rows.filter((r) => !r.done);
  const groups: { title: string; color?: string; items: Row_[] }[] = [
    { title: '마감 지남', color: t.danger, items: open.filter((r) => r.due < today) },
    { title: '오늘', color: ACCENT, items: open.filter((r) => r.due === today) },
    { title: '내일', items: open.filter((r) => r.due === ymd(addDays(new Date(), 1))) },
    { title: '이번 주', items: open.filter((r) => daysUntil(r.due) >= 2 && daysUntil(r.due) <= 7) },
    { title: '나중', items: open.filter((r) => daysUntil(r.due) > 7) },
  ];
  const done = rows.filter((r) => r.done);

  const toggle = (r: Row_) => {
    if (r.fromPerf) return router.push(`/perf/item/${r.id.slice(5)}` as any);
    update('homework', r.id, { done: !r.done, doneAt: r.done ? null : Date.now() });
  };

  return (
    <Screen title="마감 트래커" subtitle="수행평가 · 숙제 · 시험" accent={ACCENT} right={<Btn small icon="add" title="추가" color={ACCENT} onPress={() => setEdit('new')} />}>
      {open.length === 0 && <Empty icon="checkmark-done-outline" title="남은 마감이 없어요" desc="수행평가나 숙제 마감일을 넣으면 전날 저녁과 당일 아침에 알려줘요." />}
      {groups.map((g) =>
        g.items.length ? (
          <View key={g.title} style={{ marginBottom: 6 }}>
            <T weight="800" size={13} color={g.color || t.textSub} style={{ marginTop: 6, marginBottom: 6 }}>
              {g.title} · {g.items.length}
            </T>
            {g.items.map((r) => (
              <HwRow key={r.id} r={r} onToggle={() => toggle(r)} onPress={() => (r.hw ? setEdit(r.hw) : toggle(r))} />
            ))}
          </View>
        ) : null,
      )}
      {done.length > 0 && (
        <Pressable onPress={() => setShowDone(!showDone)} style={{ paddingVertical: 10 }}>
          <T weight="700" sub>
            {showDone ? '▾' : '▸'} 끝낸 것 {done.length}개
          </T>
        </Pressable>
      )}
      {showDone && done.slice(-30).reverse().map((r) => <HwRow key={r.id} r={r} onToggle={() => toggle(r)} onPress={() => (r.hw ? setEdit(r.hw) : toggle(r))} />)}

      <Card style={{ marginTop: 16 }}>
        <T weight="800" style={{ marginBottom: 6 }}>
          마감 알림 {Platform.OS === 'web' ? '(안드로이드 앱에서 울려요)' : ''}
        </T>
        <ToggleRow label="전날 알림" value={notify.dayBefore} onChange={(v) => updateSettings({ homeworkNotify: { ...notify, dayBefore: v } })} />
        {notify.dayBefore && (
          <Row style={{ marginBottom: 6 }}>
            <T style={{ flex: 1 }} sub>
              전날
            </T>
            <Stepper value={notify.dayBeforeHour} onChange={(v) => updateSettings({ homeworkNotify: { ...notify, dayBeforeHour: v } })} min={12} max={23} format={(v) => `${v}시`} />
          </Row>
        )}
        <ToggleRow label="당일 알림" value={notify.dayOf} onChange={(v) => updateSettings({ homeworkNotify: { ...notify, dayOf: v } })} />
        {notify.dayOf && (
          <Row>
            <T style={{ flex: 1 }} sub>
              당일
            </T>
            <Stepper value={notify.dayOfHour} onChange={(v) => updateSettings({ homeworkNotify: { ...notify, dayOfHour: v } })} min={5} max={12} format={(v) => `${v}시`} />
          </Row>
        )}
        <T size={12} faint style={{ marginTop: 8 }}>
          '수행' 탭에서 마감일을 넣은 항목도 여기에 함께 보여요.
        </T>
      </Card>

      <HwEditor hw={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}

function HwRow({ r, onToggle, onPress }: { r: Row_; onToggle: () => void; onPress: () => void }) {
  const t = useTheme();
  const d = daysUntil(r.due);
  const c = KIND_COLOR[r.kind];
  return (
    <Card style={{ marginBottom: 8, opacity: r.done ? 0.55 : 1 }} onPress={onPress}>
      <Row>
        <Pressable onPress={onToggle} hitSlop={10}>
          <Ionicons name={r.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={r.done ? t.success : c} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T weight="800" numberOfLines={1} style={r.done ? { textDecorationLine: 'line-through' } : undefined}>
            {r.title}
          </T>
          <Row gap={6} style={{ marginTop: 3 }}>
            <Badge label={HOMEWORK_KIND_LABEL[r.kind]} color={c} />
            {r.subject ? (
              <T size={12} sub>
                {r.subject}
              </T>
            ) : null}
            <T size={12} sub>
              {fmtKDate(r.due)}
              {r.dueMin != null ? ` ${Math.floor(r.dueMin / 60)}:${String(r.dueMin % 60).padStart(2, '0')}` : ''}
            </T>
          </Row>
        </View>
        {!r.done && (
          <T weight="900" color={d < 0 ? t.danger : d <= 1 ? ACCENT : t.textSub}>
            {ddayLabel(d)}
          </T>
        )}
      </Row>
    </Card>
  );
}

function HwEditor({ hw, onClose }: { hw: Homework | 'new' | null; onClose: () => void }) {
  const subjects = useList('subjects');
  const h = hw && hw !== 'new' ? hw : null;
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<HomeworkKind>('homework');
  const [due, setDue] = useState<string>(ymd(addDays(new Date(), 1)));
  const [dueMin, setDueMin] = useState<number | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!hw) return;
    setTitle(h?.title || '');
    setSubject(h?.subject || '');
    setKind(h?.kind || 'homework');
    setDue(h?.due || ymd(addDays(new Date(), 1)));
    setDueMin(h?.dueMin ?? null);
    setNote(h?.note || '');
  }, [hw]);
  const names = [...new Set(['국어', '수학', '영어', '과학', '사회', ...subjects.map((s) => s.name)])];
  return (
    <Sheet
      visible={!!hw}
      onClose={onClose}
      title={h ? '마감 수정' : '마감 추가'}
      footer={
        <Row>
          {h && (
            <Btn
              title="삭제"
              variant="danger"
              onPress={async () => {
                if (await confirmAsk('지울까요?', undefined, { destructive: true, okText: '삭제' })) {
                  remove('homework', h.id);
                  onClose();
                }
              }}
            />
          )}
          <Btn
            title="저장"
            flex
            color={ACCENT}
            onPress={() => {
              if (!title.trim()) return toast('무엇을 해야 하나요?');
              const p = { title: title.trim(), subject, kind, due, dueMin, note };
              if (h) update('homework', h.id, p);
              else addHomework(p);
              onClose();
            }}
          />
        </Row>
      }
    >
      <Field label="할 일" value={title} onChangeText={setTitle} placeholder="예: 영어 에세이 제출, 과학 탐구 보고서" />
      <Label>종류</Label>
      <Segmented
        value={kind}
        onChange={setKind}
        options={(Object.keys(HOMEWORK_KIND_LABEL) as HomeworkKind[]).map((k) => ({ value: k, label: HOMEWORK_KIND_LABEL[k] }))}
        style={{ marginBottom: 12 }}
      />
      <Label>과목</Label>
      <Row wrap style={{ marginBottom: 12 }}>
        {names.map((s) => (
          <Chip key={s} small label={s} selected={subject === s} onPress={() => setSubject(subject === s ? '' : s)} />
        ))}
      </Row>
      <DateField label="마감일" value={due} onChange={(d) => d && setDue(d)} />
      <Row style={{ marginVertical: 10 }}>
        <T style={{ flex: 1 }}>마감 시각 {dueMin != null ? `${Math.floor(dueMin / 60)}:${String(dueMin % 60).padStart(2, '0')}` : '(없음)'}</T>
        <Btn
          small
          variant="secondary"
          title={dueMin != null ? '바꾸기' : '시각 넣기'}
          onPress={async () => {
            const v = await promptText('마감 시각', dueMin != null ? `${Math.floor(dueMin / 60)}:${String(dueMin % 60).padStart(2, '0')}` : '23:59', { placeholder: '예: 08:30' });
            if (v == null) return;
            const m = v.match(/^(\d{1,2})\s*[:시.]?\s*(\d{1,2})?/);
            if (!m) return;
            const hh = Number(m[1]);
            const mm = Number(m[2] || 0);
            if (hh < 24 && mm < 60) setDueMin(hh * 60 + mm);
          }}
        />
        {dueMin != null && <Btn small variant="ghost" title="빼기" onPress={() => setDueMin(null)} />}
      </Row>
      <Field label="메모" value={note} onChangeText={setNote} placeholder="준비물, 분량, 제출 방법 등" multiline />
    </Sheet>
  );
}
