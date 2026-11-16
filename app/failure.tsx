// 실패! 화면: 계획 시간이 지났는데 완료하지 못한 일이 있으면 앱을 열 때 빨간 화면으로 알림 + 후속 조치
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getState, update, useData, useList } from '../src/lib/store';
import { FAILURE_SNOOZE_KEY, overdueTasks } from '../src/features/planner/logic';
import {
  giveUpTask,
  rescheduleToNext,
  rescheduleTomorrowSameTime,
  setTaskDone,
  splitTask,
} from '../src/features/planner/actions';
import { fmtKDate, fmtTime } from '../src/lib/date';
import { haptic, toast } from '../src/components/ui';

const REASONS = [
  { id: 'time', label: '⏰ 시간 부족' },
  { id: 'tired', label: '😮‍💨 피곤함' },
  { id: 'reluctant', label: '🙅 하기 싫었음' },
  { id: 'hard', label: '🧱 너무 어려움' },
  { id: 'changed', label: '📅 일정 변경' },
  { id: 'forgot', label: '🫥 깜빡함' },
];

export default function Failure() {
  const insets = useSafeAreaInsets();
  const tasks = useList('tasks');
  const subjects = useData((s) => s.subjects);
  const [reason, setReason] = useState<string | null>(null);
  const list = useMemo(() => overdueTasks(tasks), [tasks]);
  const initial = useRef(list.length);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic('warn');
    Animated.sequence(
      [12, -12, 9, -9, 5, -5, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true })),
    ).start();
  }, [shake]);

  const after = (msg: string, targets: { subjectId: string }[]) => {
    toast(msg);
    if (reason === 'reluctant') {
      // 하기 싫었던 과목은 기피 과목으로 표시 → 다음부터 5분 예열 추천
      const s = getState();
      for (const x of targets) {
        const sub = s.subjects[x.subjectId];
        if (sub && !sub.reluctant) update('subjects', sub.id, { reluctant: true });
      }
    }
  };

  const close = async (snoozeMin = 0) => {
    if (snoozeMin) await AsyncStorage.setItem(FAILURE_SNOOZE_KEY, String(Date.now() + snoozeMin * 60_000));
    router.canGoBack() ? router.back() : router.replace('/');
  };

  const allClear = list.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: allClear ? '#14532D' : '#7F1D1D' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380, backgroundColor: allClear ? '#16A34A' : '#DC2626', opacity: 0.55 }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 30, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Animated.View style={{ alignItems: 'center', transform: [{ translateX: shake }] }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={allClear ? 'checkmark' : 'close'} size={60} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 46, fontWeight: '900', marginTop: 14, letterSpacing: -1 }}>
            {allClear ? '정리 완료!' : '실패!'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            {allClear
              ? `놓친 일 ${initial.current}개를 모두 정리했어요.\n실패는 기록일 뿐, 다시 시작하면 돼요.`
              : `계획한 시간이 지났는데 끝내지 못한 일이 ${list.length}개 있어요.\n그냥 넘기지 말고 하나씩 정리해요.`}
          </Text>
        </Animated.View>

        {!allClear && (
          <>
            <Text style={{ color: '#fff', fontWeight: '800', marginTop: 28, marginBottom: 10 }}>왜 못했나요? (기록해두면 통계에 반영돼요)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setReason(reason === r.id ? null : r.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: reason === r.id ? '#fff' : 'rgba(255,255,255,0.15)',
                  }}
                >
                  <Text style={{ color: reason === r.id ? '#7F1D1D' : '#fff', fontWeight: '700', fontSize: 13 }}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: 22, gap: 10 }}>
              {list.map((x) => {
                const sub = subjects[x.subjectId];
                return (
                  <View key={x.id} style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sub?.color || '#fff' }} />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={2}>
                        {x.title}
                      </Text>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 }}>
                      {sub?.name} · {fmtKDate(x.start!)} {fmtTime(x.start!)}–{fmtTime(x.end!)}
                      {x.missCount ? ` · ${x.missCount}번째 미룸` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      <Act
                        icon="checkmark"
                        label="사실 했어요"
                        onPress={() => {
                          setTaskDone(x, true);
                        }}
                      />
                      <Act
                        icon="arrow-redo"
                        label="빈 시간에 다시"
                        onPress={() => {
                          const s = rescheduleToNext(x, reason || undefined);
                          after(s ? `${fmtKDate(s, false)} ${fmtTime(s)}로 옮겼어요` : '빈 시간이 없어 목록으로 돌려놨어요', [x]);
                        }}
                      />
                      <Act
                        icon="sunny"
                        label="내일 같은 시간"
                        onPress={() => {
                          rescheduleTomorrowSameTime(x, reason || undefined);
                          after('내일 같은 시간으로 옮겼어요', [x]);
                        }}
                      />
                      <Act
                        icon="cut"
                        label="반으로 쪼개기"
                        onPress={() => {
                          splitTask(x);
                          after('두 개로 나눠 할 일 목록에 넣었어요', [x]);
                        }}
                      />
                      <Act
                        icon="flame"
                        label="5분만 해보기"
                        onPress={() => {
                          rescheduleToNext(x, reason || undefined);
                          router.replace(`/support/starter?task=${x.id}`);
                        }}
                      />
                      <Act
                        icon="flag"
                        label="포기"
                        danger
                        onPress={() => {
                          giveUpTask(x, reason || undefined);
                          after('실패로 기록했어요', [x]);
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {list.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Big
                  label="모두 빈 시간에 다시"
                  onPress={() => {
                    list.forEach((x) => rescheduleToNext(x, reason || undefined));
                    after('모두 다시 배치했어요', list);
                  }}
                />
                <Big
                  label="모두 내일 같은 시간"
                  onPress={() => {
                    list.forEach((x) => rescheduleTomorrowSameTime(x, reason || undefined));
                    after('모두 내일로 옮겼어요', list);
                  }}
                />
              </View>
            )}
          </>
        )}

        <View style={{ marginTop: 26, gap: 10 }}>
          {allClear ? (
            <Big label="다시 시작하기 💪" solid onPress={() => close()} />
          ) : (
            <Pressable onPress={() => close(60)} style={{ alignItems: 'center', padding: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>1시간 뒤에 다시 알려주기</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Act({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: danger ? 'rgba(0,0,0,0.25)' : pressed ? '#fff' : 'rgba(255,255,255,0.9)',
      })}
    >
      <Ionicons name={icon} size={14} color={danger ? '#fff' : '#7F1D1D'} />
      <Text style={{ color: danger ? '#fff' : '#7F1D1D', fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function Big({ label, onPress, solid }: { label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic('medium');
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 15,
        borderRadius: 16,
        backgroundColor: solid ? '#fff' : 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: solid ? '#14532D' : '#fff', fontWeight: '900', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
