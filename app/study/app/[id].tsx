// 학습 앱 실행: 아티팩트 HTML을 WebView로 열고, 저장 기능(localStorage / window.storage)을 계정에 연결
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebFrame } from '../../../src/components/WebFrame';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { loadAppData, saveAppData, update, useDoc } from '../../../src/lib/store';
import { connectDrive, ensureLocal, isDriveAuthError, readText } from '../../../src/lib/files';
import { Btn, Empty, IconBtn, Row, T } from '../../../src/components/ui';

function shim(kv: Record<string, string>, ls: Record<string, string>) {
  return `(function(){
  var KV = ${JSON.stringify(kv)}; var LS = ${JSON.stringify(ls)};
  var t; function save(){ clearTimeout(t); t = setTimeout(function(){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'appData', kv: KV, ls: LS })); } catch(e){} }, 400); }
  var has = function(o,k){ return Object.prototype.hasOwnProperty.call(o,k); };
  var mem = {
    getItem: function(k){ k = String(k); return has(LS,k) ? LS[k] : null; },
    setItem: function(k,v){ LS[String(k)] = String(v); save(); },
    removeItem: function(k){ delete LS[String(k)]; save(); },
    clear: function(){ LS = {}; save(); },
    key: function(i){ return Object.keys(LS)[i] || null; }
  };
  Object.defineProperty(mem, 'length', { get: function(){ return Object.keys(LS).length; } });
  try { Object.defineProperty(window, 'localStorage', { value: mem, configurable: true }); } catch(e) {}
  window.storage = {
    get: function(key){ return Promise.resolve(has(KV,key) ? { key: key, value: KV[key], shared: false } : null); },
    set: function(key, value){ KV[key] = value; save(); return Promise.resolve({ key: key, value: value, shared: false }); },
    delete: function(key){ var had = has(KV,key); delete KV[key]; save(); return Promise.resolve({ key: key, deleted: had, shared: false }); },
    list: function(prefix){ var keys = Object.keys(KV).filter(function(k){ return !prefix || k.indexOf(prefix) === 0; }); return Promise.resolve({ keys: keys, prefix: prefix, shared: false }); }
  };
})(); true;`;
}

export default function RunApp() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useDoc('apps', id);
  const web = useRef<any>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [inject, setInject] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [needDrive, setNeedDrive] = useState(false);

  useEffect(() => {
    if (!app) return;
    update('apps', app.id, { lastOpenedAt: Date.now() });
    (async () => {
      try {
        const data = await loadAppData(app.id).catch(() => ({ kv: {}, ls: {} }));
        setInject(shim(data.kv, data.ls));
        if (app.source === 'html') {
          const local = await ensureLocal(app.driveId, app.id, 'html');
          setHtml(await readText(local));
        }
      } catch (e: any) {
        setNeedDrive(isDriveAuthError(e));
        setErr(e?.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id, key]);

  if (!app) return <Empty title="앱을 찾을 수 없어요" action={<Btn title="돌아가기" onPress={() => router.back()} />} />;

  const ready = inject && (app.source === 'url' || html);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
        <IconBtn name="chevron-back" onPress={() => router.back()} />
        <T weight="800" style={{ flex: 1 }} numberOfLines={1}>
          {app.emoji} {app.name}
        </T>
        <IconBtn name="refresh" size={20} onPress={() => setKey(key + 1)} />
      </Row>
      {err ? (
        <Empty
          icon="warning-outline"
          title={needDrive ? '구글 드라이브 연결이 필요해요' : '앱을 열 수 없어요'}
          desc={needDrive ? undefined : err}
          action={
            needDrive ? (
              <Btn
                title="구글 드라이브 연결"
                icon="logo-google"
                onPress={async () => {
                  await connectDrive();
                  setErr(null);
                  setNeedDrive(false);
                  setKey(key + 1);
                }}
              />
            ) : undefined
          }
        />
      ) : Platform.OS === 'web' && app.source === 'url' ? (
        <Empty
          icon="open-outline"
          title="게시 링크는 새 탭에서 열려요"
          desc="claude.ai 페이지는 다른 사이트 안에 넣어 보여줄 수 없어서, 새 탭으로 열어요."
          action={<Btn title="새 탭에서 열기" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(app.url!)} />}
        />
      ) : !ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <WebFrame
          key={key}
          sandboxed
          ref={web}
          originWhitelist={['*']}
          source={app.source === 'url' ? { uri: app.url! } : { html: html!, baseUrl: Platform.OS === 'web' ? undefined : `https://studyapp.local/${app.id}/` }}
          injectedJavaScriptBeforeContentLoaded={inject!}
          onMessage={(e: any) => {
            try {
              const m = JSON.parse(e.nativeEvent.data);
              if (m.type === 'appData') saveAppData(app.id, { kv: m.kv || {}, ls: m.ls || {} });
            } catch {}
          }}
          onShouldStartLoadWithRequest={(req: any) => {
            const u: string = req.url || '';
            if (req.isTopFrame === false) return true;
            if (/^(about|data|blob):/.test(u)) return true;
            if (app.source === 'html' && u.startsWith('https://studyapp.local/')) return true;
            if (app.source === 'url' && (u.split('#')[0] === (app.url || '').split('#')[0] || req.navigationType !== 'click')) return true;
            // 앱 안의 외부 링크는 브라우저로
            WebBrowser.openBrowserAsync(u);
            return false;
          }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={__DEV__ && Platform.OS !== 'web'}
          style={{ flex: 1, backgroundColor: '#fff' }}
        />
      )}
    </View>
  );
}
