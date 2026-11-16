// 덱 상세: 카드 목록, 추가/수정/삭제
import React, { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme';
import { remove, useDoc, useList } from '../../../src/lib/store';
import { Btn, Empty, Fab, Field, Row, Screen, T, confirmAsk } from '../../../src/components/ui';
import { CardDraft, CardSheet } from '../../../src/features/study/cards';
import { fmtKDate } from '../../../src/lib/date';
import type { Card } from '../../../src/lib/types';

export default function DeckDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deck = useDoc('decks', id);
  const all = useList('cards');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const cards = useMemo(
    () =>
      all
        .filter((c) => c.deckId === id && (!q || (c.front + c.back).toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.srs.due - b.srs.due),
    [all, id, q],
  );
  const due = cards.filter((c) => c.srs.due <= Date.now()).length;

  const open = (c: Card | null) => {
    setEditId(c?.id || null);
    setDraft(c ? { front: c.front, back: c.back, frontImg: c.frontImg, backImg: c.backImg } : { front: '', back: '' });
  };

  return (
    <Screen title={deck?.name || '덱'} subtitle={`${cards.length}장 · 오늘 복습 ${due}장`} accent={deck?.color} overlay={<Fab color={deck?.color || t.section.study} onPress={() => open(null)} />}>
      <Row>
        <Btn title={`복습 시작 (${due})`} icon="play" flex disabled={!due} onPress={() => router.push(`/study/review/${id}`)} />
        <Btn title="전부 훑어보기" variant="secondary" disabled={!cards.length} onPress={() => router.push(`/study/review/${id}?cram=1`)} />
      </Row>
      <Field value={q} onChangeText={setQ} placeholder="카드 검색" style={{ marginTop: 14 }} />
      {cards.length === 0 ? (
        <Empty icon="albums-outline" title="카드가 없어요" desc="+ 버튼으로 직접 만들거나, PDF·노트에서 바로 만들 수 있어요" />
      ) : (
        cards.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => open(c)}
            onLongPress={async () => {
              if (await confirmAsk('이 카드를 삭제할까요?', undefined, { destructive: true, okText: '삭제' })) remove('cards', c.id);
            }}
            style={({ pressed }) => ({ backgroundColor: pressed ? t.surface2 : t.surface, borderRadius: 16, padding: 14, marginBottom: 8, gap: 6 })}
          >
            {c.frontImg ? <Image source={{ uri: c.frontImg }} style={{ width: '100%', height: 90, borderRadius: 8 }} resizeMode="contain" /> : null}
            {c.front ? (
              <T weight="700" numberOfLines={3}>
                {c.front}
              </T>
            ) : null}
            <View style={{ height: 1, backgroundColor: t.border }} />
            {c.backImg ? <Image source={{ uri: c.backImg }} style={{ width: '100%', height: 90, borderRadius: 8 }} resizeMode="contain" /> : null}
            {c.back ? (
              <T sub numberOfLines={3}>
                {c.back}
              </T>
            ) : null}
            <T size={11} faint>
              {c.srs.due <= Date.now() ? '오늘 복습' : `다음 복습 ${fmtKDate(c.srs.due, false)}`} · 간격 {c.srs.interval}일
              {c.srs.lapses ? ` · 틀림 ${c.srs.lapses}` : ''}
            </T>
          </Pressable>
        ))
      )}
      <View style={{ height: 90 }} />
      <CardSheet
        draft={draft}
        editId={editId}
        onClose={() => {
          setDraft(null);
          setEditId(null);
        }}
      />
    </Screen>
  );
}
