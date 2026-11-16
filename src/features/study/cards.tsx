// 플래시카드: 문장 → 앞/뒤 자동 분리, 카드 저장 시트
import React, { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { add, batch, getState, update, useList } from '../../lib/store';
import { newSrs } from '../../lib/srs';
import { SUBJECT_COLORS } from '../../lib/color';
import { Btn, Chip, Field, Label, Row, Sheet, T, haptic, promptText, toast } from '../../components/ui';
import { useTheme } from '../../theme';

const LAST_DECK = 'last-deck-id';

/** "A: B", "A = B", "A는 B이다" 같은 문장을 앞/뒷면으로 나누기 */
export function splitForCard(text: string): { front: string; back: string } {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.{1,70}?)\s*(?::|=|→|->|⇒|–|—|\s-\s)\s*(.+)$/);
  if (m) return { front: m[1].trim(), back: m[2].trim() };
  const k = t.match(/^(.{1,30}?)(이란|란|이라 함은|은|는)\s+(.{4,})$/);
  if (k) {
    const subject = k[1].trim();
    return { front: `${subject}${/[가-힣]$/.test(subject) && hasJong(subject) ? '이란' : '란'}?`, back: t };
  }
  return { front: t, back: '' };
}

function hasJong(word: string): boolean {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}

export async function ensureDeckId(): Promise<string> {
  const decks = Object.values(getState().decks);
  const last = await AsyncStorage.getItem(LAST_DECK);
  if (last && getState().decks[last]) return last;
  if (decks.length) return decks[0].id;
  return add('decks', { name: '기본 덱', color: SUBJECT_COLORS[6] });
}

export async function addCardsQuick(
  cards: { front: string; back: string; frontImg?: string | null; backImg?: string | null }[],
  meta: { sourceFileId?: string | null; page?: number | null },
) {
  const deckId = await ensureDeckId();
  batch(
    cards.map((c) => ({
      op: 'add' as const,
      c: 'cards' as const,
      data: { deckId, ...c, sourceFileId: meta.sourceFileId ?? null, page: meta.page ?? null, srs: newSrs() },
    })),
  );
  const deck = getState().decks[deckId];
  toast(`${cards.length}장을 '${deck?.name || '덱'}'에 넣었어요`);
}

export interface CardDraft {
  front: string;
  back: string;
  frontImg?: string | null;
  backImg?: string | null;
  page?: number | null;
}

export function CardSheet({
  draft,
  onClose,
  sourceFileId,
  editId,
}: {
  draft: CardDraft | null;
  onClose: () => void;
  sourceFileId?: string | null;
  editId?: string | null;
}) {
  const t = useTheme();
  const decks = useList('decks');
  const sortedDecks = useMemo(() => [...decks].sort((a, b) => a.createdAt - b.createdAt), [decks]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [deckId, setDeckId] = useState<string | null>(null);
  const [imgSide, setImgSide] = useState<'front' | 'back'>('front');
  const img = draft?.frontImg || draft?.backImg || null;

  useEffect(() => {
    if (!draft) return;
    setFront(draft.front);
    setBack(draft.back);
    setImgSide(draft.backImg && !draft.frontImg ? 'back' : 'front');
    AsyncStorage.getItem(LAST_DECK).then((v: string | null) => {
      const ds = Object.values(getState().decks);
      setDeckId(v && getState().decks[v] ? v : ds[0]?.id || null);
    });
  }, [draft]);

  const save = async () => {
    let d = deckId;
    if (!d) d = await ensureDeckId();
    await AsyncStorage.setItem(LAST_DECK, d);
    const data = {
      deckId: d,
      front: front.trim(),
      back: back.trim(),
      frontImg: img && imgSide === 'front' ? img : null,
      backImg: img && imgSide === 'back' ? img : null,
    };
    if (editId) {
      update('cards', editId, data);
    } else {
      add('cards', { ...data, sourceFileId: sourceFileId ?? null, page: draft?.page ?? null, srs: newSrs() });
      toast('카드를 만들었어요');
    }
    haptic('success');
    onClose();
  };

  return (
    <Sheet
      visible={!!draft}
      onClose={onClose}
      title={editId ? '카드 수정' : '플래시카드 만들기'}
      footer={<Btn title="저장" onPress={save} disabled={!front.trim() && !(img && imgSide === 'front')} />}
    >
      {img ? (
        <View style={{ marginBottom: 12 }}>
          <Image source={{ uri: img }} style={{ width: '100%', height: 160, borderRadius: 12, backgroundColor: '#fff' }} resizeMode="contain" />
          <Row style={{ marginTop: 8 }}>
            <T size={13} sub>
              이미지를
            </T>
            <Chip small label="앞면" selected={imgSide === 'front'} onPress={() => setImgSide('front')} />
            <Chip small label="뒷면" selected={imgSide === 'back'} onPress={() => setImgSide('back')} />
            <T size={13} sub>
              에
            </T>
          </Row>
        </View>
      ) : null}
      <Field label="앞면 (질문)" value={front} onChangeText={setFront} multiline placeholder={img && imgSide === 'front' ? '(선택) 이미지에 덧붙일 질문' : '예: 미토콘드리아의 기능은?'} />
      <Field label="뒷면 (답)" value={back} onChangeText={setBack} multiline placeholder="정답" />
      <Label>덱</Label>
      <Row wrap>
        {sortedDecks.map((d) => (
          <Chip key={d.id} small label={d.name} color={d.color} selected={deckId === d.id} onPress={() => setDeckId(d.id)} />
        ))}
        <Chip
          small
          icon="add"
          label="새 덱"
          onPress={async () => {
            const name = await promptText('새 덱 이름', '', { placeholder: '예: 생명과학 1단원' });
            if (name?.trim()) setDeckId(add('decks', { name: name.trim(), color: SUBJECT_COLORS[decks.length % SUBJECT_COLORS.length] }));
          }}
        />
      </Row>
      <T size={11} faint style={{ marginTop: 10 }} color={t.textFaint}>
        만든 카드는 학습 › 암기 덱에서 간격 반복으로 복습해요
      </T>
    </Sheet>
  );
}
