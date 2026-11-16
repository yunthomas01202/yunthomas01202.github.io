// 집중 화면: 어두운 전체 화면에 큰 시계만 (화면 꺼짐 방지)
import React from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useList } from '../../src/lib/store';
import { elapsedSec, pauseTimer, resumeTimer, useRunningTimer, useTick } from '../../src/features/support/timerStore';
import { endStudy } from '../../src/features/support/session';
import { fmtClock, ymd } from '../../src/lib/date';
import { toast } from '../../src/components/ui';

export default function Focus() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const running = useRunningTimer();
  useTick(true);
  const sessions = useList('sessions');
  const today = ymd();
  const total = sessions.filter((s) => ymd(s.start) === today).reduce((a, s) => a + s.sec, 0) + elapsedSec(running);
  const now = new Date();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/support/stopwatch'));

  return (
    <View style={{ flex: 1, backgroundColor: '#05060A', paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }}>
      <StatusBar hidden />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Text style={{ color: '#5C6278', fontWeight: '700' }}>
          {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}
        </Text>
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="contract" size={24} color="#5C6278" />
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {running ? (
          <>
            <Text style={{ color: running.color, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>{running.subject}</Text>
            <Text style={{ color: '#fff', fontSize: 76, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>{fmtClock(elapsedSec(running))}</Text>
            <Text style={{ color: '#5C6278', fontSize: 14, marginTop: 10 }}>오늘 총 {fmtClock(total)}</Text>
            {!running.segStart && <Text style={{ color: '#FFB224', fontSize: 15, fontWeight: '700', marginTop: 16 }}>휴식 중</Text>}
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
            onPress={async () => {
              const sec = await endStudy();
              toast(sec >= 60 ? `${Math.round(sec / 60)}분 기록했어요` : '1분 미만은 기록하지 않아요');
              close();
            }}
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#3A1418', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="stop" size={28} color="#FF6369" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
