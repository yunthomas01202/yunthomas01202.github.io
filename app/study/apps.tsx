// 학습 앱: 클로드로 만든 학습 아티팩트(HTML)를 추가해서 앱 안에서 실행
import React, { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../src/theme';
import { add, newId, remove, update, useList } from '../../src/lib/store';
import { connectDrive, deleteLocal, deleteRemote, isDriveAuthError, readText, uploadFile, writeLocalText } from '../../src/lib/files';
import type { StudyApp } from '../../src/lib/types';
import { Btn, Chip, Empty, Fab, Field, Label, Row, Screen, Segmented, Sheet, T, confirmAsk, showActions, toast } from '../../src/components/ui';
import { alpha } from '../../src/lib/color';

const EMOJIS = ['📘', '🧪', '🧮', '🌍', '🧬', '📐', '🔤', '📝', '🎯', '🧠', '⚛️', '🗺️', '🎧', '💡', '🏛️', '📊'];

export default function Apps() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const apps = useList('apps');
  const [sheet, setSheet] = useState<{ open: boolean; app: StudyApp | null }>({ open: false, app: null });
  const cols = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const tile = (Math.min(width, 1200) - 32 - (cols - 1) * 12) / cols;

  const menu = (a: StudyApp) =>
    showActions(`${a.emoji} ${a.name}`, [
      { label: '이름·아이콘·내용 바꾸기', icon: 'create-outline', onPress: () => setSheet({ open: true, app: a }) },
      {
        label: '삭제',
        icon: 'trash-outline',
        destructive: true,
        onPress: async () => {
          if (!(await confirmAsk(`'${a.name}'을(를) 삭제할까요?`, '앱 안에 저장된 기록도 함께 지워져요.', { destructive: true, okText: '삭제' }))) return;
          remove('apps', a.id);
          deleteLocal(a.id, 'html');
          deleteRemote(a.driveId);
        },
      },
    ]);

  return (
    <Screen title="학습 앱" subtitle="클로드로 만든 학습 아티팩트를 앱처럼" accent="#12A594" overlay={<Fab color="#12A594" onPress={() => setSheet({ open: true, app: null })} />}>
      {apps.length === 0 ? (
        <Empty
          icon="apps-outline"
          title="학습 앱을 추가해 보세요"
          desc={'클로드에게 "영단어 퀴즈 아티팩트 만들어줘"처럼 부탁한 뒤,\n그 HTML을 붙여넣거나 파일·링크로 추가하면\n여기서 바로 실행할 수 있어요.'}
          action={<Btn title="학습 앱 추가" icon="add" color="#12A594" onPress={() => setSheet({ open: true, app: null })} style={{ marginTop: 8 }} />}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {apps
            .sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt))
            .map((a) => (
              <Pressable key={a.id} onPress={() => router.push(`/study/app/${a.id}`)} onLongPress={() => menu(a)} style={{ width: tile, alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                <View
                  style={{
                    width: Math.min(76, tile - 16),
                    height: Math.min(76, tile - 16),
                    borderRadius: 22,
                    backgroundColor: alpha('#12A594', t.dark ? 0.25 : 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 36 }}>{a.emoji}</Text>
                </View>
                <T size={13} weight="700" numberOfLines={2} center>
                  {a.name}
                </T>
              </Pressable>
            ))}
        </View>
      )}
      <AppSheet visible={sheet.open} app={sheet.app} onClose={() => setSheet({ open: false, app: null })} />
    </Screen>
  );
}

function AppSheet({ visible, app, onClose }: { visible: boolean; app: StudyApp | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [mode, setMode] = useState<'paste' | 'file' | 'url'>('paste');
  const [html, setHtml] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(app?.name || '');
    setEmoji(app?.emoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    setMode(app?.source === 'url' ? 'url' : 'paste');
    setHtml('');
    setFileName(null);
    setUrl(app?.url || '');
  }, [visible, app]);

  const pickFile = async () => {
    const res: any = await DocumentPicker.getDocumentAsync({ type: ['text/html', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    const text = await readText(a.uri);
    setHtml(text);
    setFileName(a.name);
    if (!name) setName((a.name || '').replace(/\.html?$/i, ''));
  };

  const save = async () => {
    const n = name.trim() || '학습 앱';
    setBusy(true);
    try {
      if (mode === 'url') {
        const u = url.trim();
        if (!/^https?:\/\//.test(u)) {
          toast('http:// 또는 https:// 로 시작하는 링크를 넣어주세요');
          return;
        }
        if (app) update('apps', app.id, { name: n, emoji, source: 'url', url: u });
        else add('apps', { name: n, emoji, source: 'url', url: u });
      } else {
        let body = html.trim();
        if (!body && app) {
          update('apps', app.id, { name: n, emoji });
          onClose();
          return;
        }
        if (!body) {
          toast('HTML 내용을 넣어주세요');
          return;
        }
        if (!/<html|<body|<!doctype/i.test(body)) {
          // 조각만 붙여넣은 경우 감싸기
          body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`;
        }
        const id = app?.id || newId();
        const local = await writeLocalText(id, 'html', body);
        if (app) {
          update('apps', id, { name: n, emoji, source: 'html', size: body.length, url: null, driveId: null });
          deleteRemote(app.driveId); // 내용이 바뀌었으니 예전 파일은 휴지통으로
        } else add('apps', { id, name: n, emoji, source: 'html', size: body.length, driveId: null });
        uploadFile(local, n, 'html')
          .then((driveId) => update('apps', id, { driveId }))
          .catch((e) => {
            if (isDriveAuthError(e)) toast('다른 기기에서도 쓰려면 드라이브 연결이 필요해요', { label: '연결', onPress: () => connectDrive() });
          });
      }
      toast(app ? '학습 앱을 고쳤어요' : '학습 앱을 추가했어요');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} full title={app ? '학습 앱 수정' : '학습 앱 추가'} footer={<Btn title="저장" loading={busy} color="#12A594" onPress={save} />}>
      <Field label="이름" value={name} onChangeText={setName} placeholder="예: 한국사 연표 퀴즈" />
      <Label>아이콘</Label>
      <Row wrap style={{ marginBottom: 14 }}>
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} color="#12A594" />
        ))}
      </Row>
      <Label>가져올 방법</Label>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'paste', label: 'HTML 붙여넣기' },
          { value: 'file', label: 'HTML 파일' },
          { value: 'url', label: '게시 링크' },
        ]}
        style={{ marginBottom: 14 }}
      />
      {mode === 'paste' && (
        <>
          <Field value={html} onChangeText={setHtml} multiline placeholder="<!DOCTYPE html> ... 아티팩트 코드 전체를 붙여넣으세요" inputStyle={{ minHeight: 180, fontFamily: 'Courier', fontSize: 12 }} />
          <T size={12} sub>
            클로드 아티팩트 화면의 ‘코드’ 보기에서 전체 복사하세요.{app ? ' 비워두면 기존 내용을 유지해요.' : ''}
          </T>
        </>
      )}
      {mode === 'file' && (
        <>
          <Btn title={fileName ? `선택됨: ${fileName}` : '.html 파일 고르기'} icon="document-attach-outline" variant="secondary" color="#12A594" onPress={pickFile} />
          <T size={12} sub style={{ marginTop: 8 }}>
            아티팩트를 ‘다운로드’해서 받은 .html 파일을 고르세요.
          </T>
        </>
      )}
      {mode === 'url' && (
        <>
          <Field value={url} onChangeText={setUrl} keyboardType="url" placeholder="https://claude.ai/public/artifacts/..." />
          <T size={12} sub>
            ‘게시(Publish)’한 아티팩트 링크를 넣으면 앱 안에서 열어요. 인터넷이 필요해요.
          </T>
        </>
      )}
      <T size={11} faint style={{ marginTop: 14 }}>
        참고: React(.jsx) 형식 아티팩트는 HTML 형식으로 다시 만들어 달라고 하면 바로 쓸 수 있어요. 학습 앱 안에서 저장한 기록(localStorage, window.storage)은 계정에 저장돼 다른 기기에서도 이어져요.
      </T>
    </Sheet>
  );
}

