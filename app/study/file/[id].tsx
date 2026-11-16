// 파일 열기: PDF·빈 노트·백지 복습·코넬 노트를 필기 엔진(WebView)으로 표시
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebFrame } from '../../../src/components/WebFrame';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { add, getState, loadInk, saveInk, update, updateSettings, useData, useList } from '../../../src/lib/store';
import { connectDrive, ensureLocal, isDriveAuthError, readBase64 } from '../../../src/lib/files';
import { PDFJS_BASE, engineCall, loadEngineHtml, sendBase64 } from '../../../src/features/study/engine';
import { CardDraft, CardSheet, addCardsQuick, splitForCard } from '../../../src/features/study/cards';
import { recallNextDays } from '../../../src/lib/srs';
import { addDays, ymd } from '../../../src/lib/date';
import { Btn, Empty, ListItem, Sheet, Stepper, T, toast, Row } from '../../../src/components/ui';
import { useTheme } from '../../../src/theme';
import { Ionicons } from '@expo/vector-icons';

export default function FileViewer() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const file = useData((s) => s.files[id]);
  const penOnly = useData((s) => s.settings.penOnly);
  const web = useRef<any>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [needDrive, setNeedDrive] = useState(false);
  const [card, setCard] = useState<CardDraft | null>(null);
  const [pickSource, setPickSource] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    started.current = false;
    setErr(null);
    setNeedDrive(false);
    setHtml(null);
    loadEngineHtml().then(value => { if (!cancelled) setHtml(value); }).catch((e) => { if (!cancelled) setErr(String(e?.message || e)); });
    if (id) update('files', id, { lastOpenedAt: Date.now() });
    return () => { cancelled = true; };
  }, [id]);

  const inject = (js: string) => web.current?.injectJavaScript(js);
  const flushAndBack = () => {
    inject(engineCall({ type: 'flush' }));
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/study')), 200);
  };

  // 안드로이드 뒤로가기 / 앱 백그라운드 → 저장
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      flushAndBack();
      return true;
    });
    const st = AppState.addEventListener('change', (s: string) => {
      if (s !== 'active') inject(engineCall({ type: 'flush' }));
    });
    return () => {
      sub.remove();
      st.remove();
    };
  }, []);

  const sendSource = async (srcId: string, start: number) => {
    const src = getState().files[srcId];
    if (!src) return;
    try {
      const local = await ensureLocal(src.driveId, src.id, 'pdf');
      const b64 = await readBase64(local);
      sendBase64(inject, 'src', b64, { srcStart: start });
    } catch (e: any) {
      if (isDriveAuthError(e)) toast('원본을 받으려면 구글 드라이브 연결이 필요해요', { label: '연결', onPress: () => connectDrive().then(() => sendSource(srcId, start)) });
      else toast('원본을 불러오지 못했어요: ' + (e?.message || e));
    }
  };

  const start = async () => {
    if (started.current || !file) return;
    started.current = true;
    try {
      const ink = await loadInk(file.id);
      inject(
        engineCall({
          type: 'init',
          mode: file.kind,
          fileId: file.id,
          title: file.name,
          pageCount: file.pageCount || 1,
          template: file.template || (file.kind === 'recall' ? 'lined' : 'blank'),
          ink,
          content: file.content || {},
          penOnly,
          dark: t.dark,
          lastPage: file.lastPage || 1,
          hasSource: !!file.sourceFileId,
          srcStart: file.sourceStartPage || 1,
        }),
      );
      if (file.kind === 'pdf') {
        const local = await ensureLocal(file.driveId, file.id, 'pdf');
        const b64 = await readBase64(local);
        sendBase64(inject, 'main', b64);
      }
      if (file.kind === 'recall' && file.sourceFileId) await sendSource(file.sourceFileId, file.sourceStartPage || 1);
    } catch (e: any) {
      setNeedDrive(isDriveAuthError(e));
      setErr(e?.message || String(e));
    }
  };

  const onMessage = (e: any) => {
    let m: any;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const f = getState().files[id];
    switch (m.type) {
      case 'ready':
        start();
        break;
      case 'close':
        setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/study')), 120);
        break;
      case 'saveInk':
        saveInk(id, m.key, m.data);
        break;
      case 'saveDoc': {
        const patch: any = { ...m.patch };
        if (patch.content) patch.content = { ...(f?.content || {}), ...patch.content };
        update('files', id, patch);
        break;
      }
      case 'state':
        if (m.page) update('files', id, { lastPage: m.page });
        break;
      case 'prefs':
        if (typeof m.penOnly === 'boolean') updateSettings({ penOnly: m.penOnly });
        break;
      case 'createCard': {
        if (m.text) {
          const sp = splitForCard(m.text);
          setCard({ front: sp.front, back: sp.back, page: m.page });
        } else setCard({ front: m.front || '', back: m.back || '', backImg: m.backImg || null, page: m.page });
        break;
      }
      case 'createCards':
        addCardsQuick(m.cards || [], { sourceFileId: id });
        inject(engineCall({ type: 'toast', text: `${(m.cards || []).length}장을 카드로 만들었어요` }));
        break;
      case 'createCardImage':
        setCard({ front: '', back: '', frontImg: m.img, page: m.page });
        break;
      case 'needSource':
        setPickSource(true);
        break;
      case 'recallScore': {
        const prev = Object.values(getState().recallLogs).filter((r) => r.fileId === id).length;
        add('recallLogs', { fileId: id, score: m.score });
        const days = recallNextDays(m.score, prev);
        update('files', id, { nextReview: ymd(addDays(new Date(), days)) });
        inject(engineCall({ type: 'toast', text: `기억률 ${m.score}% · ${days}일 뒤에 다시 백지 복습해요` }));
        break;
      }
      case 'error':
        console.warn('[engine]', m.message);
        break;
    }
  };

  if (!file) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <Empty title="파일을 찾을 수 없어요" action={<Btn title="돌아가기" onPress={() => router.back()} />} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface, paddingTop: insets.top }}>
      {err ? (
        <Empty
          icon={needDrive ? 'cloud-outline' : 'warning-outline'}
          title={needDrive ? '구글 드라이브 연결이 필요해요' : '열 수 없어요'}
          desc={needDrive ? '보안상 웹에서는 1시간마다 드라이브 연결을 다시 확인해요. 아래 버튼을 눌러주세요.' : err}
          action={
            needDrive ? (
              <Btn
                title="구글 드라이브 연결"
                icon="logo-google"
                onPress={async () => {
                  try {
                    await connectDrive();
                    started.current = false;
                    setNeedDrive(false);
                    setErr(null);
                  } catch (e: any) {
                    toast(e?.message || '연결하지 못했어요');
                  }
                }}
              />
            ) : (
              <Btn title="돌아가기" onPress={() => router.back()} />
            )
          }
        />
      ) : !html ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <WebFrame
          key={id}
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: PDFJS_BASE }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          overScrollMode="never"
          bounces={false}
          scrollEnabled={false}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          textInteractionEnabled
          webviewDebuggingEnabled={__DEV__ && Platform.OS !== 'web'}
          onContentProcessDidTerminate={() => { started.current = false; web.current?.reload(); }}
          style={{ flex: 1, backgroundColor: t.bg }}
        />
      )}

      <CardSheet draft={card} sourceFileId={id} onClose={() => setCard(null)} />
      <SourcePicker
        visible={pickSource}
        currentId={file.sourceFileId || null}
        currentStart={file.sourceStartPage || 1}
        onClose={() => setPickSource(false)}
        onPick={(srcId, startPage) => {
          setPickSource(false);
          update('files', id, { sourceFileId: srcId, sourceStartPage: startPage });
          sendSource(srcId, startPage);
        }}
      />
    </View>
  );
}

/** 백지 복습: 대조할 원본 PDF 고르기 */
function SourcePicker({
  visible,
  currentId,
  currentStart,
  onClose,
  onPick,
}: {
  visible: boolean;
  currentId: string | null;
  currentStart: number;
  onClose: () => void;
  onPick: (id: string, start: number) => void;
}) {
  const t = useTheme();
  const files = useList('files');
  const pdfs = files.filter((f) => f.kind === 'pdf').sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt));
  const [sel, setSel] = useState<string | null>(currentId);
  const [startPage, setStartPage] = useState(currentStart);
  useEffect(() => {
    if (visible) {
      setSel(currentId);
      setStartPage(currentStart);
    }
  }, [visible, currentId, currentStart]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="대조할 원본"
      footer={<Btn title="이 원본으로 대조하기" disabled={!sel} onPress={() => sel && onPick(sel, startPage)} />}
    >
      <T sub size={13} style={{ marginBottom: 12 }}>
        교과서나 요약본 PDF를 고르면, 백지 위에 반투명하게 겹쳐서 빠뜨린 부분을 확인할 수 있어요.
      </T>
      {pdfs.length === 0 ? (
        <Empty icon="document-outline" title="학습 폴더에 PDF가 없어요" desc="먼저 학습 화면에서 PDF를 가져오세요" />
      ) : (
        pdfs.map((f) => (
          <ListItem
            key={f.id}
            title={f.name}
            subtitle={`${f.pageCount ? f.pageCount + '쪽' : 'PDF'}`}
            onPress={() => setSel(f.id)}
            left={<Ionicons name="document-text" size={22} color={sel === f.id ? t.primary : t.textFaint} />}
            right={sel === f.id ? <Ionicons name="checkmark-circle" size={22} color={t.primary} /> : undefined}
            style={{ borderWidth: sel === f.id ? 1.5 : 0, borderColor: t.primary }}
          />
        ))
      )}
      {sel && (
        <Row style={{ marginTop: 8 }}>
          <T weight="700" style={{ flex: 1 }}>
            몇 쪽부터 대조할까요?
          </T>
          <Stepper value={startPage} onChange={setStartPage} min={1} max={2000} format={(v) => `${v}쪽`} />
        </Row>
      )}
    </Sheet>
  );
}
