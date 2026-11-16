// 링크 바로가기
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../src/theme';
import { add, remove, update, useList } from '../../src/lib/store';
import type { QuickLink } from '../../src/lib/types';
import { Btn, Chip, Empty, Fab, Field, Label, Row, Screen, Sheet, T, showActions } from '../../src/components/ui';

const EMOJIS = ['🔗', '📺', '📚', '🏫', '📝', '🎧', '🧮', '🌐', '📖', '🎓', '💻', '📊'];
const PRESETS = [
  { title: 'EBSi', url: 'https://www.ebsi.co.kr', emoji: '📺' },
  { title: '네이버 사전', url: 'https://dict.naver.com', emoji: '📖' },
  { title: '구글 클래스룸', url: 'https://classroom.google.com', emoji: '🏫' },
  { title: '한국교육과정평가원', url: 'https://www.kice.re.kr', emoji: '📝' },
];

export default function Links() {
  const t = useTheme();
  const links = useList('links').sort((a, b) => a.order - b.order);
  const [edit, setEdit] = useState<{ open: boolean; link: QuickLink | null }>({ open: false, link: null });

  const open = (l: QuickLink) => WebBrowser.openBrowserAsync(l.url).catch(() => Linking.openURL(l.url));

  return (
    <Screen title="링크" subtitle="자주 가는 공부 사이트를 한 번에" overlay={<Fab color="#687076" onPress={() => setEdit({ open: true, link: null })} />}>
      {links.length === 0 && (
        <>
          <Empty icon="link-outline" title="링크를 추가해 보세요" desc="인강 사이트, 학교 홈페이지, 과제 제출 링크 등" />
          <Label>빠른 추가</Label>
          <Row wrap>
            {PRESETS.map((p) => (
              <Chip key={p.url} label={`${p.emoji} ${p.title}`} onPress={() => add('links', { ...p, order: links.length })} />
            ))}
          </Row>
        </>
      )}
      {links.map((l, i) => (
        <Pressable
          key={l.id}
          onPress={() => open(l)}
          onLongPress={() =>
            showActions(l.title, [
              { label: '수정', icon: 'create-outline', onPress: () => setEdit({ open: true, link: l }) },
              { label: '외부 브라우저로 열기', icon: 'open-outline', onPress: () => Linking.openURL(l.url) },
              ...(i > 0 ? [{ label: '위로', icon: 'arrow-up' as const, onPress: () => { update('links', l.id, { order: links[i - 1].order }); update('links', links[i - 1].id, { order: l.order }); } }] : []),
              { label: '삭제', icon: 'trash-outline', destructive: true, onPress: () => remove('links', l.id) },
            ])
          }
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, backgroundColor: pressed ? t.surface2 : t.surface })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{l.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="700">{l.title}</T>
            <T size={12} faint numberOfLines={1}>
              {l.url.replace(/^https?:\/\//, '')}
            </T>
          </View>
        </Pressable>
      ))}
      <LinkSheet visible={edit.open} link={edit.link} count={links.length} onClose={() => setEdit({ open: false, link: null })} />
    </Screen>
  );
}

function LinkSheet({ visible, link, count, onClose }: { visible: boolean; link: QuickLink | null; count: number; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [emoji, setEmoji] = useState('🔗');
  useEffect(() => {
    if (!visible) return;
    setTitle(link?.title || '');
    setUrl(link?.url || 'https://');
    setEmoji(link?.emoji || '🔗');
  }, [visible, link]);
  const save = () => {
    let u = url.trim();
    if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
    const data = { title: title.trim() || u.replace(/^https?:\/\//, '').split('/')[0], url: u, emoji };
    if (link) update('links', link.id, data);
    else add('links', { ...data, order: count });
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={link ? '링크 수정' : '링크 추가'} footer={<Btn title="저장" onPress={save} disabled={url.trim().length < 5} />}>
      <Field label="이름" value={title} onChangeText={setTitle} placeholder="예: 수학 인강" />
      <Field label="주소" value={url} onChangeText={setUrl} keyboardType="url" placeholder="https://" />
      <Label>아이콘</Label>
      <Row wrap>
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </Row>
    </Sheet>
  );
}
