// 수행/세특 부문: 상위 항목·하위 항목·이벤트 편집 시트
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { add, batch, getState, remove, update, useList } from '../../lib/store';
import type { Energy, PerfCategory, PerfEvent, PerfItem } from '../../lib/types';
import { SUBJECT_COLORS } from '../../lib/color';
import { fmtMin, fmtMinOfDay, ymd } from '../../lib/date';
import { Btn, Chip, ColorPicker, DateField, EnergyPicker, Field, Label, Row, Sheet, Stepper, T, ToggleRow, confirmAsk } from '../../components/ui';

export const itemColor = (i: PerfItem, cats: Record<string, PerfCategory>) => i.color || cats[i.categoryId]?.color || '#F76B15';

export const EMPTY_RECORD = { motive: '', process: '', result: '', learned: '', followup: '' };

const CATEGORY_PRESETS = ['수행평가', '세특 활동', '동아리', '대회·발표', '봉사', '독서', '진로 탐구'];

export function CategoryEditor({ visible, onClose, cat }: { visible: boolean; onClose: () => void; cat?: PerfCategory | null }) {
  const t = useTheme();
  const count = useList('perfCategories').length;
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[1]);
  useEffect(() => {
    if (!visible) return;
    setName(cat?.name || '');
    setColor(cat?.color || SUBJECT_COLORS[(count + 1) % SUBJECT_COLORS.length]);
  }, [visible, cat, count]);
  const save = () => {
    if (!name.trim()) return;
    if (cat) update('perfCategories', cat.id, { name: name.trim(), color });
    else add('perfCategories', { name: name.trim(), color, order: count });
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={cat ? '상위 항목 수정' : '상위 항목 추가'}
      footer={
        <Row>
          {cat && (
            <Btn
              title="삭제"
              variant="secondary"
              color={t.danger}
              onPress={async () => {
                const s = getState();
                const items = Object.values(s.perfItems).filter((i) => i.categoryId === cat.id);
                if (!(await confirmAsk('상위 항목을 삭제할까요?', `하위 항목 ${items.length}개와 배치한 블록도 함께 삭제돼요.`, { destructive: true, okText: '삭제' }))) return;
                const ids = new Set(items.map((i) => i.id));
                batch([
                  ...Object.values(s.perfBlocks).filter((b) => ids.has(b.itemId)).map((b) => ({ op: 'remove' as const, c: 'perfBlocks' as const, id: b.id })),
                  ...items.map((i) => ({ op: 'remove' as const, c: 'perfItems' as const, id: i.id })),
                  { op: 'remove', c: 'perfCategories', id: cat.id },
                ]);
                onClose();
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!name.trim()} />
        </Row>
      }
    >
      <Field label="이름" value={name} onChangeText={setName} placeholder="예: 수행평가" />
      {!cat && (
        <Row wrap style={{ marginTop: -6, marginBottom: 14 }}>
          {CATEGORY_PRESETS.map((p) => (
            <Chip key={p} small label={p} selected={name === p} onPress={() => setName(p)} />
          ))}
        </Row>
      )}
      <Label>색</Label>
      <ColorPicker value={color} onChange={setColor} />
    </Sheet>
  );
}

export function ItemEditor({
  visible,
  onClose,
  item,
  categoryId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  item?: PerfItem | null;
  categoryId?: string;
  onCreated?: (id: string) => void;
}) {
  const t = useTheme();
  const cats = useList('perfCategories').sort((a, b) => a.order - b.order);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<string | undefined>();
  const [energy, setEnergy] = useState<Energy>(3);
  const [est, setEst] = useState(60);
  const [due, setDue] = useState<string | null>(null);
  const [ownColor, setOwnColor] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title || '');
    setCat(item?.categoryId || categoryId || cats[0]?.id);
    setEnergy(item?.energy || 3);
    setEst(item?.estMin || 60);
    setDue(item?.dueDate || null);
    setOwnColor(item?.color || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);
  const catColor = cats.find((c) => c.id === cat)?.color || t.section.perf;
  const save = () => {
    if (!title.trim() || !cat) return;
    const data = { title: title.trim(), categoryId: cat, energy, estMin: est, dueDate: due, color: ownColor };
    if (item) update('perfItems', item.id, data);
    else {
      const n = Object.values(getState().perfItems).filter((i) => i.categoryId === cat).length;
      const id = add('perfItems', { ...data, places: [], checklist: [], record: EMPTY_RECORD, status: 'todo', order: n, note: '' });
      onCreated?.(id);
    }
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={item ? '하위 항목 수정' : '하위 항목 추가'} footer={<Btn title="저장" onPress={save} disabled={!title.trim() || !cat} />}>
      {cats.length === 0 ? (
        <T sub>먼저 상위 항목(예: 수행평가)을 만들어 주세요.</T>
      ) : (
        <>
          <Field label="이름" value={title} onChangeText={setTitle} placeholder="예: 수학 수행 - 통계 탐구 보고서" autoFocus={!item} />
          <Label>상위 항목</Label>
          <Row wrap style={{ marginBottom: 14 }}>
            {cats.map((c) => (
              <Chip key={c.id} label={c.name} color={c.color} selected={cat === c.id} onPress={() => setCat(c.id)} />
            ))}
          </Row>
          <DateField label="마감 / 수행일 (메인 화면 D-day에 표시)" value={due} onChange={setDue} allowClear placeholder="날짜 없음" />
          <Label>에너지 코스트</Label>
          <EnergyPicker value={energy} onChange={setEnergy} color={ownColor || catColor} />
          <View style={{ height: 14 }} />
          <Label>한 번 작업할 때 시간</Label>
          <Stepper value={est} onChange={setEst} step={15} min={15} max={480} format={fmtMin} />
          <View style={{ height: 14 }} />
          <Label>색 (비우면 상위 항목 색)</Label>
          <ColorPicker value={ownColor || ''} onChange={(c) => setOwnColor(ownColor === c ? null : c)} />
        </>
      )}
    </Sheet>
  );
}

export function EventEditor({
  visible,
  onClose,
  event,
  date,
}: {
  visible: boolean;
  onClose: () => void;
  event?: PerfEvent | null;
  date?: string;
}) {
  const t = useTheme();
  const items = useList('perfItems');
  const [title, setTitle] = useState('');
  const [d, setD] = useState<string>(ymd());
  const [timed, setTimed] = useState(false);
  const [sMin, setSMin] = useState(9 * 60);
  const [eMin, setEMin] = useState(10 * 60);
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!visible) return;
    setTitle(event?.title || '');
    setD(event?.date || date || ymd());
    setTimed(event?.startMin != null);
    setSMin(event?.startMin ?? 9 * 60);
    setEMin(event?.endMin ?? 10 * 60);
    setColor(event?.color || SUBJECT_COLORS[0]);
    setItemId(event?.itemId || null);
    setNote(event?.note || '');
  }, [visible, event, date]);
  const save = () => {
    if (!title.trim()) return;
    const data = { title: title.trim(), date: d, startMin: timed ? sMin : null, endMin: timed ? Math.max(eMin, sMin + 15) : null, color, itemId, note };
    if (event) update('events', event.id, data);
    else add('events', data);
    onClose();
  };
  const open = items.filter((i) => i.status !== 'done');
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={event ? '일정 수정' : '특별 일정 추가'}
      footer={
        <Row>
          {event && (
            <Btn
              title="삭제"
              variant="secondary"
              color={t.danger}
              onPress={() => {
                remove('events', event.id);
                onClose();
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!title.trim()} />
        </Row>
      }
    >
      <Field label="일정" value={title} onChangeText={setTitle} placeholder="예: 수학 수행평가 당일, 영어 발표" autoFocus={!event} />
      <DateField label="날짜" value={d} onChange={(v) => v && setD(v)} />
      <ToggleRow label="시간 정하기" desc="끄면 하루 종일 일정으로 표시돼요" value={timed} onChange={setTimed} />
      {timed && (
        <View style={{ gap: 8, marginBottom: 10 }}>
          <Row>
            <T weight="700" style={{ width: 50 }}>
              시작
            </T>
            <Stepper value={sMin} onChange={setSMin} step={15} min={0} max={23 * 60 + 45} format={fmtMinOfDay} />
          </Row>
          <Row>
            <T weight="700" style={{ width: 50 }}>
              끝
            </T>
            <Stepper value={eMin} onChange={setEMin} step={15} min={15} max={24 * 60} format={fmtMinOfDay} />
          </Row>
        </View>
      )}
      <Label>색</Label>
      <ColorPicker value={color} onChange={setColor} />
      {open.length > 0 && (
        <>
          <Label>관련 항목 (선택)</Label>
          <Row wrap style={{ marginBottom: 14 }}>
            {open.map((i) => (
              <Chip key={i.id} small label={i.title} selected={itemId === i.id} onPress={() => setItemId(itemId === i.id ? null : i.id)} />
            ))}
          </Row>
        </>
      )}
      <Field label="메모" value={note} onChangeText={setNote} placeholder="준비물, 장소 등" />
    </Sheet>
  );
}

/** 세특 기록 → 학생부 문장 초안 */
export function setukDraft(item: PerfItem, category?: string): string {
  const r = item.record || EMPTY_RECORD;
  const parts = [
    r.motive && `${r.motive.replace(/[.。]\s*$/, '')}을(를) 계기로`,
    `'${item.title}'${category ? `(${category})` : ''} 활동에서`,
    r.process && `${r.process.replace(/[.。]\s*$/, '')}.`,
    r.result && `그 결과 ${r.result.replace(/[.。]\s*$/, '')}.`,
    r.learned && `이 과정에서 ${r.learned.replace(/[.。]\s*$/, '')}.`,
    r.followup && `이후 ${r.followup.replace(/[.。]\s*$/, '')}(으)로 탐구를 확장함.`,
  ].filter(Boolean);
  return parts.join(' ');
}
