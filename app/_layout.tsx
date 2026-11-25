import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initAuth, signInWithGoogle, startLocalMode, useAuth } from '../src/lib/auth';
import { getState, useData } from '../src/lib/store';
import { Btn, OverlayHost, T, toast } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { FAILURE_SNOOZE_KEY, overdueTasks } from '../src/features/planner/logic';
import { rescheduleReminders } from '../src/lib/notify';
import { retryPendingUploads } from '../src/lib/files';
import { releaseExpiredLock } from '../src/lib/applock';
import { fmtTime } from '../src/lib/date';
import { getWebConfigError } from '../src/lib/webConfig';
import { closeHotkeyHelp, keyOf, openHotkeyHelp, useGlobalHotkeys, useHelp } from '../src/lib/hotkeys';
import { HotkeyHelp } from '../src/components/HotkeyHelp';
import { useFocusGuard } from '../src/features/support/focusGuard';
import { getRunning, pauseTimer, resumeTimer } from '../src/features/support/timerStore';

export default function RootLayout() {
  const t = useTheme();
  useEffect(() => initAuth(), []);
  const { user, initializing } = useAuth();
  const ready = useData((s) => s.ready);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="failure" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="study/file/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="study/app/[id]" options={{ animation: 'fade' }} />
          <Stack.Screen name="support/focus" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        </Stack>
        {user && ready && <AppEffects />}
        {user && ready && <HotkeyHelp />}
        {(initializing || !user || !ready) && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            {initializing || (user && !ready) ? <Splash text={user ? '데이터를 불러오는 중…' : undefined} /> : <Login />}
          </View>
        )}
        <OverlayHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Splash({ text }: { text?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Text style={{ fontSize: 44 }}>🎯</Text>
      <ActivityIndicator color={t.primary} />
      {text ? <T sub>{text}</T> : null}
    </View>
  );
}

function Login() {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setupError = Platform.OS === 'web' ? getWebConfigError() : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 28, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: t.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
          }}
        >
          <Text style={{ fontSize: 50 }}>🎯</Text>
        </View>
        <T size={30} weight="900">
          학습지원
        </T>
        <T sub style={{ marginTop: 8, textAlign: 'center', lineHeight: 21 }}>
          계획 · 필기 · 수행평가 · 집중까지{'\n'}공부의 모든 것을 한 곳에서
        </T>
      </View>
      <View style={{ gap: 10, marginBottom: 40 }}>
        {[
          ['📅', '시즌별 계획과 드래그 캘린더'],
          ['✍️', 'PDF 필기 · 백지 복습 · 코넬 노트'],
          ['🏅', '수행평가 · 세특 기록과 D-day'],
          ['⏱️', '공부 타이머 · 5분 예열 · 앱 잠금'],
        ].map(([e, s]) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 20 }}>{e}</Text>
            <T weight="600">{s}</T>
          </View>
        ))}
      </View>
      {setupError ? (
        <View style={{ gap: 10, backgroundColor: t.surface, padding: 18, borderRadius: 16 }}>
          <T weight="800">사이트 업로드 완료 · Firebase 연결이 필요해요</T>
          <T size={13} sub>{setupError}</T>
          <T size={13} sub style={{ lineHeight: 21 }}>
            web-config.js에 Firebase 웹 앱 설정을 입력하세요.{ '\n' }
            소스 프로젝트에서는 public/web-config.js를 수정합니다.{ '\n' }
            승인된 도메인과 Firestore 규칙을 설정한 뒤 새로고침하세요.
          </T>
          <Btn title="설정 반영 후 새로고침" onPress={() => { if (typeof window !== 'undefined') window.location.reload(); }} />
        </View>
      ) : <Btn
        title="Google 계정으로 시작하기"
        icon="logo-google"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setErr(null);
          try {
            await signInWithGoogle();
          } catch (e: any) {
            setErr(e?.message || '로그인에 실패했어요');
          } finally {
            setBusy(false);
          }
        }}
      />}
      {Platform.OS === 'android' && (
        <Btn
          title="로그인 없이 이 기기에서 시작"
          icon="phone-portrait-outline"
          variant="secondary"
          style={{ marginTop: 10 }}
          onPress={() => startLocalMode().catch((e: any) => setErr(e?.message || '시작하지 못했어요'))}
        />
      )}
      {err ? (
        <T size={13} color={t.danger} style={{ marginTop: 12, textAlign: 'center' }}>
          {err}
        </T>
      ) : null}
      <T size={12} faint center style={{ marginTop: 18 }}>
        로그인하면 모든 기기에서 같은 데이터를 쓸 수 있어요
      </T>
    </View>
  );
}


/** 앱이 켜질 때마다: 실패 화면 확인, 알림 재예약, 밀린 업로드 재시도 */
function AppEffects() {
  const lastCheck = useRef(0);

  // 웹: 공부 중 탭·창 이탈 기록
  useFocusGuard();

  // 웹: 어디서나 쓰는 단축키
  useGlobalHotkeys((e) => {
    const k = keyOf(e);
    if (k === '?') {
      if (useHelp.getState().open) closeHotkeyHelp();
      else openHotkeyHelp();
      return true;
    }
    if (useHelp.getState().open) return;
    if (k === 's') {
      router.navigate('/support/stopwatch');
      return true;
    }
    if (k === 'c') {
      router.navigate('/planner/calendar');
      return true;
    }
    const r = getRunning();
    if (!r) return;
    if (k === 'f') {
      router.navigate('/support/focus');
      return true;
    }
    if (k === 'p') {
      if (r.segStart) {
        pauseTimer();
        toast(`${r.subject} 휴식`);
      } else {
        resumeTimer();
        toast(`${r.subject} 다시 시작`);
      }
      return true;
    }
  });

  useEffect(() => {
    const run = async () => {
      const now = Date.now();
      if (now - lastCheck.current < 5000) return;
      lastCheck.current = now;
      const s = getState();
      const tasks = Object.values(s.tasks);
      // 1) 실패 화면
      const snooze = Number((await AsyncStorage.getItem(FAILURE_SNOOZE_KEY)) || 0);
      if (overdueTasks(tasks).length > 0 && now > snooze) {
        setTimeout(() => router.push('/failure'), 400);
      }
      // 2) 알림 (블록 시작 N분 전)
      const before = s.settings.notifyBeforeMin;
      if (before > 0) {
        const subjects = s.subjects;
        const items = [
          ...tasks
            .filter((x) => x.status === 'todo' && x.start)
            .map((x) => ({
              id: x.id,
              title: `${before}분 뒤 시작: ${x.title}`,
              body: `${subjects[x.subjectId]?.name || ''} · ${fmtTime(x.start!)}부터${x.starter ? ' (5분만!)' : ''}`,
              at: x.start! - before * 60_000,
            })),
          ...Object.values(s.perfBlocks)
            .filter((b) => !b.done)
            .map((b) => ({
              id: b.id,
              title: `${before}분 뒤 시작: ${s.perfItems[b.itemId]?.title || '수행 작업'}`,
              body: `수행/세특 · ${fmtTime(b.start)}부터`,
              at: b.start - before * 60_000,
            })),
        ];
        rescheduleReminders(items);
      }
      // 3) 업로드 재시도, 끝난 앱 잠금 해제
      retryPendingUploads();
      releaseExpiredLock();
    };
    run();
    const sub = AppState.addEventListener('change', (st: string) => {
      if (st === 'active') run();
    });
    return () => sub.remove();
  }, []);

  return null;
}
