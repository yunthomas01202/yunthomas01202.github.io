// 웹용 WebView 대체: iframe + postMessage 다리
//  - source.html: srcdoc 로 넣고, <base>·메시지 다리·사전 주입 스크립트를 <head> 맨 앞에 끼워 넣음
//  - sandboxed: 학습 앱(외부에서 가져온 HTML)은 이 앱의 로그인 정보에 접근하지 못하게 격리
//  - injectJavaScript: 같은 출처 iframe 에서만 동작 (필기 엔진)
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

interface Props {
  source: { html: string; baseUrl?: string } | { uri: string };
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  injectedJavaScriptBeforeContentLoaded?: string;
  sandboxed?: boolean;
  style?: any;
  [k: string]: any;
}

function buildDoc(html: string, baseUrl?: string, pre?: string) {
  const safe = (js: string) => js.replace(/<\/script/gi, '<\\/script');
  const parts = [
    baseUrl ? `<base href="${baseUrl}">` : '',
    `<script>window.ReactNativeWebView={postMessage:function(s){parent.postMessage({__rnw:1,data:String(s)},'*')}};</script>`,
    pre ? `<script>${safe(pre)}</script>` : '',
  ].join('');
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + parts) : parts + html;
}

export const WebFrame = forwardRef<any, Props>(function WebFrame(props, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [nonce, setNonce] = useState(0);
  const onMsg = useRef(props.onMessage);
  onMsg.current = props.onMessage;
  const src: any = props.source;
  const isUrl = typeof src.uri === 'string';
  const srcDoc = useMemo(
    () => (isUrl ? undefined : buildDoc(src.html, props.sandboxed ? undefined : src.baseUrl, props.injectedJavaScriptBeforeContentLoaded)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src.html, src.baseUrl, props.injectedJavaScriptBeforeContentLoaded, props.sandboxed, nonce],
  );

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      try {
        (frame.current?.contentWindow as any)?.eval(js);
      } catch (e) {
        console.warn('[WebFrame] injectJavaScript', e);
      }
    },
    reload: () => setNonce((n) => n + 1),
  }));

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d: any = e.data;
      if (d && d.__rnw === 1) onMsg.current?.({ nativeEvent: { data: d.data } });
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  return (
    <View style={[{ flex: 1 }, props.style]}>
      {React.createElement('iframe', {
        key: nonce,
        ref: frame,
        srcDoc,
        src: isUrl ? src.uri : undefined,
        sandbox: props.sandboxed ? 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals' : undefined,
        allow: 'clipboard-write; fullscreen',
        style: { border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent' },
      })}
    </View>
  );
});
