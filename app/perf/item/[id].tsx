// 수행/세특 하위 항목 상세: 체크리스트 · 세특 기록장 · 작업 블록
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../../src/theme';
import { batch, getState, newId, update, useData, useDoc, useList } from '../../../src/lib/store';
import type { ChecklistItem, SetukRecord } from '../../../src/lib/types';
import { MIN, daysUntil, ddayLabel, fmtKDate, fmtMin, fmtTime } from '../../../src/lib/date';
import { Badge, Btn, Card, EnergyBolts, Field, IconBtn, ProgressBar, Row, Screen, SectionTitle, Segmented, T, confirmAsk, toast } from '../../../src/components/ui';
import { EMPTY_RECORD, ItemEditor, itemColor, setukDraft } from '../../../src/features/perf/components';

const RECORD_FIELDS: { key: keyof SetukRecord; label: string; ph: string }[] = [
  { key: 'motive', label: '동기 · 계기', ph: '왜 이 주제를 골랐나요? 수업의 어떤 내용에서 궁금증이 생겼나요?' },
  { key: 'process', label: '탐구 · 활동 과정', ph: '무엇을 조사하고, 어떤 방법으로, 어떤 어려움을 어떻게 해결했나요?' },
  { key: 'result', label: '결과물', ph: '보고서, 발표, 실험 결과 등 구체적으로' },
  { key: 'learned', label: '배운 점 · 느낀 점', ph: '새로 알게 된 개념, 생각이 바뀐 지점, 역량의 변화' },
  { key: 'followup', label: '후속 탐구', ph: '더 알아보고 싶은 것, 진로와의 연결' },
];

export default function PerfItemDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useDoc('perfItems', id);
  const cats = useData((s) => s.perfCategories);
  const allBlocks = useList('perfBlocks');
  const [edit, setEdit] = useState(false);
  const [newCheck, setNewCheck] = useState('');
  const [rec, setRec] = useState<SetukRecord>(EMPTY_RECORD);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (item) {
      setRec({ ...EMPTY_RECORD, ...(item.record || {}) });
      setNote(item.note || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // 입력이 멈추면 저장
  useEffect(() => {
    if (!item) return;
    const h = setTimeout(() => {
      if (JSON.stringify(rec) !== JSON.stringify({ ...EMPTY_RECORD, ...(item.record || {}) }) || note !== (item.note || '')) {
        update('perfItems', item.id, { record: rec, note });
      }
    }, 700);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, note]);

  const blocks = useMemo(() => allBlocks.filter((b) => b.itemId === id).sort((a, b) => a.start - b.start), [allBlocks, id]);

  if (!item) return <Screen title="항목">{null}</Screen>;
  const color = itemColor(item, cats);
  const cat = cats[item.categoryId];
  const checks = item.checklist || [];
  const doneChecks = checks.filter((c) => c.done).length;
  const worked = blocks.filter((b) => b.done).reduce((a, b) => a + (b.end - b.start) / MIN, 0);
  const d = item.dueDate ? daysUntil(item.dueDate) : null;

  const setChecks = (c: ChecklistItem[]) => update('perfItems', item.id, { checklist: c });

  return (
    <Screen title={item.title} subtitle={cat?.name} accent={color} right={<IconBtn name="create-outline" onPress={() => setEdit(true)} />}>
      <Card>
        <Row>
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={6}>
              <EnergyBolts energy={item.energy} color={color} />
              <T size={12} sub>
                한 번에 {fmtMin(item.estMin)}
              </T>
            </Row>
            <T size={13} sub>
              {item.dueDate ? `마감 ${fmtKDate(item.dueDate)}` : '마감일 없음'} · 작업한 시간 {fmtMin(worked)}
            </T>
          </View>
          {d !== null && <Badge label={ddayLabel(d)} color={d <= 3 ? t.danger : color} solid={d <= 3} />}
        </Row>
        <Segmented
          style={{ marginTop: 14 }}
          value={item.status}
          onChange={(v) => update('perfItems', item.id, { status: v })}
          options={[
            { value: 'todo', label: '할 일' },
            { value: 'doing', label: '진행 중' },
            { value: 'done', label: '완료' },
          ]}
        />
        <Btn title="캘린더에 작업 블록 배치하기" icon="grid-outline" variant="secondary" color={color} style={{ marginTop: 12 }} onPress={() => router.push('/perf')} />
      </Card>

      <SectionTitle title={`체크리스트 ${doneChecks}/${checks.length}`} />
      <Card>
        {checks.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <ProgressBar value={checks.length ? doneChecks / checks.length : 0} color={color} />
          </View>
        )}
        {checks.map((c) => (
          <Row key={c.id} style={{ paddingVertical: 6 }}>
            <Pressable hitSlop={8} onPress={() => setChecks(checks.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}>
              <Ionicons name={c.done ? 'checkbox' : 'square-outline'} size={22} color={c.done ? color : t.textFaint} />
            </Pressable>
            <T style={{ flex: 1, textDecorationLine: c.done ? 'line-through' : 'none', opacity: c.done ? 0.5 : 1 }}>{c.text}</T>
            <IconBtn name="close" size={16} color={t.textFaint} onPress={() => setChecks(checks.filter((x) => x.id !== c.id))} />
          </Row>
        ))}
        <Row>
          <TextInput
            value={newCheck}
            onChangeText={setNewCheck}
            placeholder="단계 추가 (예: 자료 조사, 개요 작성, 발표 연습)"
            placeholderTextColor={t.textFaint}
            onSubmitEditing={() => {
              if (!newCheck.trim()) return;
              setChecks([...checks, { id: newId(), text: newCheck.trim(), done: false }]);
              setNewCheck('');
            }}
            style={{ flex: 1, color: t.text, paddingVertical: 10, fontSize: 15 }}
            returnKeyType="done"
          />
          <IconBtn
            name="add-circle"
            color={color}
            onPress={() => {
              if (!newCheck.trim()) return;
              setChecks([...checks, { id: newId(), text: newCheck.trim(), done: false }]);
              setNewCheck('');
            }}
          />
        </Row>
      </Card>

      <SectionTitle
        title="세특 기록장"
        right={
          <Btn
            small
            variant="secondary"
            icon="copy-outline"
            title="세특 초안 복사"
            color={color}
            onPress={async () => {
              const text = setukDraft({ ...item, record: rec }, cat?.name);
              await Clipboard.setStringAsync(text);
              toast('초안을 복사했어요 · 선생님께 드릴 활동 보고서에 다듬어 쓰세요');
            }}
          />
        }
      />
      <T size={12} sub style={{ marginBottom: 10 }}>
        활동 직후에 짧게라도 적어두면, 학기 말 세특 자료를 쓸 때 그대로 쓸 수 있어요.
      </T>
      {RECORD_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} value={rec[f.key]} onChangeText={(v) => setRec({ ...rec, [f.key]: v })} placeholder={f.ph} multiline />
      ))}
      <Field label="메모" value={note} onChangeText={setNote} placeholder="채점 기준, 선생님 피드백 등" multiline />

      <SectionTitle title={`작업 블록 ${blocks.length}`} />
      {blocks.length === 0 ? (
        <T sub size={13}>
          아직 배치한 작업이 없어요
        </T>
      ) : (
        blocks.map((b) => (
          <Row key={b.id} style={{ paddingVertical: 8 }}>
            <Pressable hitSlop={8} onPress={() => update('perfBlocks', b.id, { done: !b.done })}>
              <Ionicons name={b.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={b.done ? t.success : t.textFaint} />
            </Pressable>
            <T style={{ flex: 1 }}>
              {fmtKDate(b.start)} {fmtTime(b.start)}–{fmtTime(b.end)}
            </T>
          </Row>
        ))
      )}
      <Btn
        title="이 항목 삭제"
        variant="ghost"
        color={t.danger}
        style={{ marginTop: 24 }}
        onPress={async () => {
          if (!(await confirmAsk('이 항목을 삭제할까요?', '세특 기록과 작업 블록이 함께 지워져요.', { destructive: true, okText: '삭제' }))) return;
          batch([
            ...Object.values(getState().perfBlocks).filter((b) => b.itemId === item.id).map((b) => ({ op: 'remove' as const, c: 'perfBlocks' as const, id: b.id })),
            { op: 'remove', c: 'perfItems', id: item.id },
          ]);
          router.back();
        }}
      />
      <ItemEditor visible={edit} item={item} onClose={() => setEdit(false)} />
    </Screen>
  );
}
