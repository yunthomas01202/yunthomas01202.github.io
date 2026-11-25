// 오답 노트: 틀린 문제를 사진으로 남기고 1·3·7·14일 뒤에 다시 풀기
import React, { useMemo, useState } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { alpha } from '../../src/lib/color';
import { remove, update, useData, useList } from '../../src/lib/store';
import type { WrongNote } from '../../src/lib/types';
import { addWrongNote, isDue, pickPhoto, reviewWrong, WRONG_STAGE_LABEL } from '../../src/features/extra/logic';
import { daysUntil, ymd } from '../../src/lib/date';
import { Badge, Btn, Card, Chip, Empty, Field, Label, Row, Screen, Segmented, Sheet, T, confirmAsk, toast } from '../../src/components/ui';

const ACCENT = '#E5484D';

function useSubjectNames() {
  const subjects = useList('subjects');
  const timerSubjects = useData((s) => s.settings.timerSubjects);
  return useMemo(() => {
    const set = new Set<string>(['국어', '수학', '영어', '과학', '사회', '한국사']);
    subjects.forEach((s) => set.add(s.name));
    timerSubjects.forEach((s) => set.add(s.name));
    return [...set];
  }, [subjects, timerSubjects]);
}

export default function WrongNotes() {
  const t = useTheme();
  const all = useList('wrongNotes');
  const [tab, setTab] = useState<'due' | 'all' | 'grad'>('due');
  const [subject, setSubject] = useState<string | null>(null);
  const [edit, setEdit] = useState<WrongNote | 'new' | null>(null);
  const [review, setReview] = useState<WrongNote[] | null>(null);
  const today = ymd();
  const due = all.filter((n) => isDue(n, today));
  const subjects = [...new Set(all.map((n) => n.subject).filter(Boolean))];
  const list = all
    .filter((n) => (tab === 'due' ? isDue(n, today) : tab === 'grad' ? !n.nextReview : !!n.nextReview))
    .filter((n) => !subject || n.subject === subject)
    .sort((a, b) => (a.nextReview || '9').localeCompare(b.nextReview || '9') || b.createdAt - a.createdAt);

  return (
    <Screen title="오답 노트" subtitle="1일 · 3일 · 7일 · 14일 뒤 다시 풀기" accent={ACCENT} right={<Btn small icon="camera" title="추가" color={ACCENT} onPress={() => setEdit('new')} />}>
      <Card style={{ marginBottom: 12, backgroundColor: alpha(ACCENT, 0.08) }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T weight="800" size={17}>
              {due.length ? `오늘 다시 볼 문제 ${due.length}개` : '오늘 복습할 문제가 없어요 ✓'}
            </T>
            <T size={12} sub style={{ marginTop: 2 }}>
              전체 {all.filter((n) => n.nextReview).length}개 진행 중 · 졸업 {all.filter((n) => !n.nextReview).length}개
            </T>
          </View>
          {due.length > 0 && <Btn title="복습 시작" icon="play" color={ACCENT} onPress={() => setReview(due)} />}
        </Row>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'due', label: `오늘 (${due.length})` },
          { value: 'all', label: '진행 중' },
          { value: 'grad', label: '졸업' },
        ]}
        style={{ marginBottom: 10 }}
      />
      {subjects.length > 1 && (
        <Row wrap style={{ marginBottom: 10 }}>
          <Chip small label="전체" selected={!subject} onPress={() => setSubject(null)} />
          {subjects.map((s) => (
            <Chip key={s} small label={s} selected={subject === s} onPress={() => setSubject(s)} />
          ))}
        </Row>
      )}

      {list.length === 0 ? (
        <Empty icon="document-text-outline" title={tab === 'due' ? '오늘은 쉬어가도 돼요' : '아직 없어요'} desc="틀린 문제를 사진으로 찍어 두면, 잊어버릴 때쯤 다시 풀어보라고 알려줘요." />
      ) : (
        list.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10 }} onPress={() => setEdit(n)}>
            <Row>
              {n.image ? (
                <Image source={{ uri: n.image }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.surface2 }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text-outline" size={26} color={t.textFaint} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  {n.subject ? <Badge label={n.subject} color={ACCENT} /> : null}
                  {n.wrongCount > 1 ? <Badge label={`${n.wrongCount}번 틀림`} color={t.warn} /> : null}
                </Row>
                <T weight="800" numberOfLines={1} style={{ marginTop: 4 }}>
                  {n.title || '제목 없음'}
                </T>
                <T size={12} sub>
                  {n.nextReview
                    ? isDue(n, today)
                      ? '오늘 복습'
                      : `${daysUntil(n.nextReview)}일 뒤 복습 · ${WRONG_STAGE_LABEL[n.stage]} 단계`
                    : '🎓 졸업'}
                </T>
              </View>
              {isDue(n, today) && <Btn small title="풀기" color={ACCENT} onPress={() => setReview([n])} />}
            </Row>
          </Card>
        ))
      )}

      <WrongEditor note={edit} onClose={() => setEdit(null)} />
      <ReviewSheet queue={review} onClose={() => setReview(null)} />
    </Screen>
  );
}

function WrongEditor({ note, onClose }: { note: WrongNote | 'new' | null; onClose: () => void }) {
  const names = useSubjectNames();
  const isNew = note === 'new';
  const n = note && note !== 'new' ? note : null;
  const [image, setImage] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();

  React.useEffect(() => {
    if (!note) return;
    setImage(n?.image || null);
    setSubject(n?.subject || '');
    setTitle(n?.title || '');
    setMemo(n?.note || '');
    setAnswer(n?.answer || '');
  }, [note]);

  const pick = async (camera: boolean) => {
    try {
      setBusy(true);
      const img = await pickPhoto(camera);
      if (img) setImage(img);
    } catch (e: any) {
      toast(e?.message || '사진을 불러오지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={!!note}
      onClose={onClose}
      title={isNew ? '오답 추가' : '오답 보기·수정'}
      full
      footer={
        <Row>
          {n && (
            <Btn
              title="삭제"
              variant="danger"
              onPress={async () => {
                if (await confirmAsk('이 오답을 지울까요?', undefined, { destructive: true, okText: '삭제' })) {
                  remove('wrongNotes', n.id);
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
              if (!image && !title.trim()) return toast('사진이나 제목을 넣어주세요');
              if (n) update('wrongNotes', n.id, { image, subject, title, note: memo, answer });
              else {
                addWrongNote({ image, subject, title, note: memo, answer });
                toast('내일 다시 풀어보라고 알려드릴게요');
              }
              onClose();
            }}
          />
        </Row>
      }
    >
      {image ? (
        <Pressable onPress={() => pick(false)}>
          <Image source={{ uri: image }} style={{ width: '100%', height: Math.min(width, 600) * 0.8, borderRadius: 14 }} resizeMode="contain" />
        </Pressable>
      ) : null}
      <Row style={{ marginVertical: 10 }}>
        <Btn small icon="camera" title="사진 찍기" variant="secondary" flex onPress={() => pick(true)} loading={busy} />
        <Btn small icon="images" title="앨범에서" variant="secondary" flex onPress={() => pick(false)} />
        {image ? <Btn small variant="ghost" title="사진 빼기" onPress={() => setImage(null)} /> : null}
      </Row>
      <Label>과목</Label>
      <Row wrap style={{ marginBottom: 12 }}>
        {names.map((s) => (
          <Chip key={s} small label={s} selected={subject === s} onPress={() => setSubject(subject === s ? '' : s)} />
        ))}
      </Row>
      <Field label="제목" value={title} onChangeText={setTitle} placeholder="예: 수학 2단원 23번" />
      <Field label="왜 틀렸나요?" value={memo} onChangeText={setMemo} placeholder="예: 부호 실수, 공식 헷갈림" multiline />
      <Field label="정답·풀이" value={answer} onChangeText={setAnswer} placeholder="복습할 때 '정답 보기'로 확인해요" multiline />
      {n && (
        <T size={12} faint>
          {n.nextReview ? `다음 복습: ${n.nextReview} (${WRONG_STAGE_LABEL[n.stage]} 단계)` : '졸업한 문제예요'} · 틀린 횟수 {n.wrongCount}
        </T>
      )}
    </Sheet>
  );
}

function ReviewSheet({ queue, onClose }: { queue: WrongNote[] | null; onClose: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [score, setScore] = useState({ ok: 0, bad: 0 });
  React.useEffect(() => {
    setI(0);
    setShow(false);
    setScore({ ok: 0, bad: 0 });
  }, [queue]);
  const n = queue?.[i];
  const next = (ok: boolean) => {
    if (!n) return;
    reviewWrong(n, ok);
    setScore((s) => (ok ? { ...s, ok: s.ok + 1 } : { ...s, bad: s.bad + 1 }));
    setShow(false);
    setI(i + 1);
  };
  return (
    <Sheet visible={!!queue} onClose={onClose} title={n ? `복습 ${i + 1} / ${queue!.length}` : '복습 끝'} full>
      {n ? (
        <>
          <Row gap={6} style={{ marginBottom: 8 }}>
            {n.subject ? <Badge label={n.subject} color={ACCENT} /> : null}
            <T weight="800" style={{ flex: 1 }}>
              {n.title}
            </T>
          </Row>
          {n.image ? <Image source={{ uri: n.image }} style={{ width: '100%', height: Math.min(width, 600) * 0.9, borderRadius: 14, backgroundColor: t.surface2 }} resizeMode="contain" /> : null}
          {n.note ? (
            <T size={13} sub style={{ marginTop: 8 }}>
              지난번 실수: {n.note}
            </T>
          ) : null}
          {show ? (
            <Card style={{ marginTop: 10, backgroundColor: alpha(t.success, 0.1) }}>
              <T weight="700">{n.answer || '정답 메모가 없어요'}</T>
            </Card>
          ) : (
            <Btn title="정답 보기" variant="secondary" style={{ marginTop: 10 }} onPress={() => setShow(true)} />
          )}
          <Row style={{ marginTop: 14 }}>
            <Btn title="또 틀렸어요" icon="close" variant="danger" flex onPress={() => next(false)} />
            <Btn title="맞혔어요" icon="checkmark" flex color={t.success} onPress={() => next(true)} />
          </Row>
          <T size={12} faint center style={{ marginTop: 8 }}>
            맞히면 다음 복습이 더 멀어지고, 틀리면 내일 다시 나와요
          </T>
        </>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <T size={40}>🎉</T>
          <T weight="800" size={18} style={{ marginTop: 8 }}>
            맞힘 {score.ok} · 다시 {score.bad}
          </T>
          <Btn title="닫기" style={{ marginTop: 16 }} onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}
