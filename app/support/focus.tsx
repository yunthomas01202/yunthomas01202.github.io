// 집중 화면: 어두운 전체 화면에 큰 시계만 (화면 꺼짐 방지)
//  - 웹: 브라우저 전체 화면 + 탭·창 이탈 횟수/시간 표시 (앱 잠금 대신)
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getState, useList } from '../../src/lib/store';
import { awayStats, elapsedSec, getRunning, pauseTimer, resumeTimer, useRunningTimer, useTick } from '../../src/features/support/timerStore';
import { endStudy } from '../../src/features/support/session';
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, onFullscreenChange } from '../../src/features/support/focusGuard';
import { fmtClock, fmtShortDur, ymd } from '../../src/lib/date';
import { confirmAsk, toast } from '../../src/components/ui';
import { keyOf, useScreenHotkeys } from '../../src/lib/hotkeys';

const isWeb = Platform.OS === 'web';

export default function Focus() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const running = useRunningTimer();
  useTick(true);
  const sessions = useList('sessions');
  const today = ymd();
  const todaySessions = sessions.filter((s) => ymd(s.start) === today);
  const total = todaySessions.reduce((a, s) => a + s.sec, 0) + elapsedSec(running);
  const away = awayStats(running);
  const todayAway = todaySessions.reduce((a, s) => a + (s.awayCount || 0), 0) + away.count;
  const now = new Date();
  const fsOk = isWeb && fullscreenSupported();
  const [fs, setFs] = useState(isFullscreen());
  const [fsLost, setFsLost] = useState(false);

  // 웹: 열면 전체 화면 (설정), 닫으면 해제
  useEffect(() => {
    if (!fsOk) return undefined;
    const off = onFullscreenChange((on) => {
      setFs(on);
      if (!on && getRunning()?.segStart) setFsLost(true);
      if (on) setFsLost(false);
    });
    if (getState().settings.focusFullscreen !== false) enterFullscreen().then(setFs);
    return () => {
      off();
      exitFullscreen();
    };
  }, [fsOk]);

  const close = () => {
    exitFullscreen();
    if (router.canGoBack()) router.back();
    else router.replace('/support/stopwatch');
  };

  const toggleFs = async () => {
    if (isFullscreen()) await exitFullscreen();
    else if (!(await enterFullscreen())) toast('이 브라우저에서는 전체 화면을 쓸 수 없어요');
  };

  const stop = async () => {
    const sec = await endStudy();
    toast(sec >= 60 ? `${Math.round(sec / 60)}분 기록했어요` : '1분 미만은 기록하지 않아요');
    close();
  };

  useScreenHotkeys((e) => {
    const k = keyOf(e);
    if (k === 'Escape' || k === 'q') {
      close();
      return true;
    }
    if (k === 'f') {
      if (fsOk) toggleFs();
      return true;
    }
    const r = getRunning();
    if (k === ' ' && r) {
      r.segStart ? pauseTimer() : resumeTimer();
      return true;
    }
    if (k === 'e' && r) {
      confirmAsk('공부를 끝내고 기록할까요?', undefined, { okText: '끝내기' }).then((ok) => {
        if (ok) stop();
      });
      return true;
    }
    // 집중 화면에서는 다른 화면으로 가는 전역 단축키를 막음
    if (k === 's' || k === 'c') return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#05060A', paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }}>
      <StatusBar hidden />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 18 }}>
        <Text style={{ color: '#5C6278', fontWeight: '700', flex: 1 }}>
          {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}
        </Text>
        {fsOk && (
          <Pressable onPress={toggleFs} hitSlop={12}>
            <Ionicons name={fs ? 'scan' : 'scan-outline'} size={22} color="#5C6278" />
          </Pressable>
        )}
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="contract" size={24} color="#5C6278" />
        </Pressable>
      </View>

      {fsLost && running && (
        <Pressable
          onPress={toggleFs}
          style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: '#2A1A08', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Ionicons name="alert-circle" size={18} color="#FFB224" />
          <Text style={{ color: '#FFB224', fontWeight: '700', flex: 1 }}>전체 화면이 풀렸어요 · 눌러서 다시 집중</Text>
        </Pressable>
      )}

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {running ? (
          <>
            <Text style={{ color: running.color, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>{running.subject}</Text>
            <Text style={{ color: '#fff', fontSize: 76, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>{fmtClock(elapsedSec(running))}</Text>
            <Text style={{ color: '#5C6278', fontSize: 14, marginTop: 10 }}>오늘 총 {fmtClock(total)}</Text>
            {!running.segStart && <Text style={{ color: '#FFB224', fontSize: 15, fontWeight: '700', marginTop: 16 }}>휴식 중</Text>}
            {isWeb && (
              <Text style={{ color: away.count ? '#FF8F94' : '#3E8E6A', fontSize: 13, fontWeight: '700', marginTop: 18 }}>
                {away.count
                  ? `이번 공부 이탈 ${away.count}회 · ${fmtShortDur(away.sec)}  (오늘 ${todayAway}회)`
                  : '이번 공부에서 한 번도 벗어나지 않았어요'}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: '#5C6278', fontSize: 16 }}>진행 중인 타이머가 없어요</Text>
        )}
      </View>
      {running && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
          <Pressable
            onPress={() => (running.segStart ? pauseTimer() : resumeTimer())}
            style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#2A2F45', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={running.segStart ? 'pause' : 'play'} size={30} color="#fff" />
          </Pressable>
          <Pressable
            onPress={stop}
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#3A1418', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="stop" size={28} color="#FF6369" />
          </Pressable>
        </View>
      )}
      {isWeb && (
        <Text style={{ color: '#3A3F52', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
          Space 휴식/계속 · F 전체 화면 · E 끝내기 · Esc 닫기
        </Text>
      )}
    </View>
  );
}
