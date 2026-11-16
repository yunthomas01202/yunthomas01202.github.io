// 플래시카드 복습 (간격 반복)
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme';
import { getState, update } from '../../../src/lib/store';
import { GRADE_LABEL, Grade, nextLabel, review } from '../../../src/lib/srs';
import { Btn, Empty, ProgressBar, Row, Screen, T, haptic } from '../../../src/components/ui';
import { Ring } from '../../../src/components/charts';
import type { Card } from '../../../src/lib/types';

export default function Review() {
  const t = useTheme();
  const { id, cram } = useLocalSearchParams<{ id: string; cram?: string }>();
  // 시작 시점의 카드 묶음을 고정 (복습 중 순서가 바뀌지 않게)
  const queue = useMemo<Card[]>(() => {
    const now = Date.now();
    return Object.values(getState().cards)
      .filter((c) => (id === 'all' || c.deckId === id) && (cram ? true : c.srs.due <= now))
      .sort(() => Math.random() - 0.5);
  }, [id, cram]);
  const [idx, setIdx] = useState(0);
  const [again, setAgain] = useState<Card[]>([]);
  const [shown, setShown] = useState(false);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const flip = useRef(new Animated.Value(0)).current;

  const list = [...queue, ...again];
  const card = list[idx];
  const total = queue.length;

  const show = () => {
    haptic();
    setShown(true);
    Animated.spring(flip, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };

  const grade = (g: Grade) => {
    haptic(g === 0 ? 'warn' : 'light');
    if (!cram) {
      const next = review(card.srs, g);
      update('cards', card.id, { srs: next });
    }
    if (g === 0) setAgain([...again, card]);
    setCounts(counts.map((c, i) => (i === g ? c + 1 : c)));
    setShown(false);
    flip.setValue(0);
    setIdx(idx + 1);
  };

  if (total === 0) {
    return (
      <Screen title="복습">
        <Empty icon="checkmark-done-circle-outline" title="지금 복습할 카드가 없어요" desc="다음 복습일이 되면 다시 알려드려요" action={<Btn title="돌아가기" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  if (!card) {
    const done = counts.reduce((a, b) => a + b, 0);
    return (
      <Screen title="복습 완료" back>
        <View style={{ alignItems: 'center', paddingTop: 30, gap: 14 }}>
          <Ring size={150} stroke={14} progress={done ? (counts[2] + counts[3]) / done : 0} color={t.success}>
            <T size={30} weight="900">
              {done}
            </T>
            <T size={12} sub>
              장 복습
            </T>
          </Ring>
          <T size={22} weight="900">
            수고했어요! 🎉
          </T>
          <Row>
            {GRADE_LABEL.map((l, i) => (
              <View key={l} style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                <T size={20} weight="900">
                  {counts[i]}
                </T>
                <T size={12} sub>
                  {l}
                </T>
              </View>
            ))}
          </Row>
          <Btn title="돌아가기" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 20 }} />
        </View>
      </Screen>
    );
  }

  const rotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const rotateBack = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const colors = [t.danger, t.warn, t.success, t.primary];

  return (
    <Screen title={cram ? '훑어보기' : '복습'} subtitle={`${Math.min(idx + 1, list.length)} / ${list.length}`} scroll={false}>
      <ProgressBar value={idx / list.length} color={t.section.study} />
      <Pressable onPress={() => !shown && show()} style={{ flex: 1, marginVertical: 18 }}>
        <Animated.View style={[cardStyle(t), { transform: [{ perspective: 1000 }, { rotateY: rotate }] }]}>
          <T size={12} faint style={{ position: 'absolute', top: 14, left: 16 }}>
            앞면
          </T>
          {card.frontImg ? <Image source={{ uri: card.frontImg }} style={{ width: '100%', height: 200 }} resizeMode="contain" /> : null}
          {card.front ? (
            <T size={22} weight="800" center>
              {card.front}
            </T>
          ) : null}
          {!shown && (
            <T size={13} faint style={{ position: 'absolute', bottom: 16 }}>
              떠올려 본 뒤 탭해서 뒤집기
            </T>
          )}
        </Animated.View>
        <Animated.View style={[cardStyle(t), { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: [{ perspective: 1000 }, { rotateY: rotateBack }] }]}>
          <T size={12} faint style={{ position: 'absolute', top: 14, left: 16 }}>
            뒷면
          </T>
          {card.backImg ? <Image source={{ uri: card.backImg }} style={{ width: '100%', height: 220 }} resizeMode="contain" /> : null}
          <T size={18} weight="600" center>
            {card.back || (card.backImg ? '' : '(뒷면 없음)')}
          </T>
        </Animated.View>
      </Pressable>
      {shown ? (
        <Row gap={8}>
          {([0, 1, 2, 3] as Grade[]).map((g) => (
            <Pressable
              key={g}
              onPress={() => grade(g)}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors[g], opacity: pressed ? 0.8 : 1 })}
            >
              <T color="#fff" weight="900">
                {GRADE_LABEL[g]}
              </T>
              {!cram && (
                <T color="rgba(255,255,255,0.85)" size={11}>
                  {nextLabel(card.srs, g)}
                </T>
              )}
            </Pressable>
          ))}
        </Row>
      ) : (
        <Btn title="정답 보기" onPress={show} />
      )}
    </Screen>
  );
}

const cardStyle = (t: any) => ({
  flex: 1,
  backgroundColor: t.surface,
  borderRadius: 26,
  padding: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 14,
  backfaceVisibility: 'hidden' as const,
  ...(t.shadow as object),
});
