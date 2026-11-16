// 암기 덱 목록
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { add, batch, getState, update, useList } from '../../src/lib/store';
import { SUBJECT_COLORS, alpha } from '../../src/lib/color';
import { Badge, Btn, Card, Empty, Fab, Screen, T, confirmAsk, promptText, showActions } from '../../src/components/ui';

export default function Decks() {
  const t = useTheme();
  const decks = useList('decks');
  const cards = useList('cards');
  const now = Date.now();
  const stats = useMemo(() => {
    const m: Record<string, { total: number; due: number; learned: number }> = {};
    for (const c of cards) {
      const s = (m[c.deckId] ||= { total: 0, due: 0, learned: 0 });
      s.total++;
      if (c.srs.due <= now) s.due++;
      if (c.srs.interval >= 21) s.learned++;
    }
    return m;
  }, [cards, now]);
  const totalDue = cards.filter((c) => c.srs.due <= now).length;

  const newDeck = async () => {
    const name = await promptText('새 덱 이름', '', { placeholder: '예: 영단어 Day 1~10' });
    if (name?.trim()) add('decks', { name: name.trim(), color: SUBJECT_COLORS[decks.length % SUBJECT_COLORS.length] });
  };

  return (
    <Screen title="암기 덱" accent={t.section.study} overlay={<Fab color={t.section.study} onPress={newDeck} />}>
      <Card color={t.section.study} style={{ marginBottom: 14 }}>
        <T color="#fff" size={13} weight="700">
          오늘 복습할 카드
        </T>
        <T color="#fff" size={34} weight="900">
          {totalDue}장
        </T>
        <Btn
          title={totalDue ? '전체 복습 시작' : '복습할 카드가 없어요'}
          color="#fff"
          disabled={!totalDue}
          onPress={() => router.push('/study/review/all')}
          style={{ marginTop: 8 }}
        />
      </Card>
      {decks.length === 0 && <Empty icon="albums-outline" title="덱이 없어요" desc="PDF나 노트에서 문장을 선택해 '카드 만들기'를 누르면 자동으로 덱이 생겨요" />}
      {decks
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((d) => {
          const s = stats[d.id] || { total: 0, due: 0, learned: 0 };
          return (
            <Pressable
              key={d.id}
              onPress={() => router.push(`/study/deck/${d.id}`)}
              onLongPress={() =>
                showActions(d.name, [
                  {
                    label: '이름 바꾸기',
                    icon: 'pencil',
                    onPress: async () => {
                      const n = await promptText('덱 이름', d.name);
                      if (n?.trim()) update('decks', d.id, { name: n.trim() });
                    },
                  },
                  {
                    label: '삭제',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: async () => {
                      if (!(await confirmAsk(`'${d.name}' 덱을 삭제할까요?`, `카드 ${s.total}장도 함께 삭제돼요.`, { destructive: true, okText: '삭제' }))) return;
                      batch([
                        ...Object.values(getState().cards)
                          .filter((c) => c.deckId === d.id)
                          .map((c) => ({ op: 'remove' as const, c: 'cards' as const, id: c.id })),
                        { op: 'remove', c: 'decks', id: d.id },
                      ]);
                    },
                  },
                ])
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: 18,
                backgroundColor: pressed ? t.surface2 : t.surface,
                marginBottom: 10,
              })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: alpha(d.color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="albums" size={24} color={d.color} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="800" size={16}>
                  {d.name}
                </T>
                <T size={12} sub>
                  {s.total}장 · 장기 기억 {s.learned}장
                </T>
              </View>
              {s.due > 0 ? <Badge label={`복습 ${s.due}`} color={t.danger} solid /> : <Badge label="완료" color={t.success} />}
            </Pressable>
          );
        })}
      <View style={{ height: 90 }} />
    </Screen>
  );
}

