// 알람: 안드로이드 기본 시계 앱처럼 벨 / 진동 / 벨+진동, 알람음·내 음악 선택, 다시 알림, 점점 크게
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { alpha } from '../../src/lib/color';
import { useList } from '../../src/lib/store';
import {
  Alarm,
  AlarmMode,
  alarmAvailable,
  defaultAlarmName,
  deleteAlarm,
  listAlarms,
  newAlarm,
  openExactSettings,
  openFullScreenSettings,
  permissionState,
  pickAudioFile,
  pickRingtone,
  previewAlarm,
  saveAlarm,
  stopPreview,
  timeLabel,
  untilText,
} from '../../src/lib/alarm';
import { Btn, Card, Chip, Empty, Field, Label, Row, Screen, Segmented, Sheet, Stepper, T, ToggleRow, confirmAsk, promptText, toast } from '../../src/components/ui';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function daysText(days: number[]) {
  if (!days.length) return '한 번만';
  const s = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (s.length === 7) return '매일';
  if (s.join() === '1,2,3,4,5') return '평일';
  if (s.join() === '6,0') return '주말';
  return s.map((d) => WEEK[d]).join(' ');
}

const MODE_ICON: Record<AlarmMode, keyof typeof Ionicons.glyphMap> = {
  sound: 'notifications',
  vibrate: 'phone-portrait-outline',
  both: 'pulse',
};
const MODE_TEXT: Record<AlarmMode, string> = { sound: '벨', vibrate: '진동', both: '벨+진동' };

export default function AlarmScreen() {
  const t = useTheme();
  const [list, setList] = useState<Alarm[]>([]);
  const [edit, setEdit] = useState<Alarm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [perm, setPerm] = useState({ exact: true, fullScreen: true });
  const [, force] = useState(0);

  const reload = useCallback(() => {
    setList(listAlarms().sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
    setPerm(permissionState());
  }, []);
  useFocusEffect(reload);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!alarmAvailable()) {
    return (
      <Screen title="알람">
        <Empty icon="alarm-outline" title="안드로이드 앱에서만 쓸 수 있어요" desc="웹 브라우저에서는 정확한 시각에 소리·진동을 울릴 수 없어요." />
      </Screen>
    );
  }

  const nextOn = list.filter((a) => a.enabled && a.next).sort((a, b) => a.next! - b.next!)[0];

  return (
    <Screen
      title="알람"
      accent="#F5A524"
      right={
        <Btn
          small
          icon="add"
          title="추가"
          onPress={() => {
            setIsNew(true);
            setEdit(newAlarm());
          }}
        />
      }
    >
      {(!perm.exact || !perm.fullScreen) && (
        <Card style={{ marginBottom: 12, backgroundColor: alpha(t.danger, 0.1) }}>
          <T weight="800">알람이 제때 울리려면 권한이 필요해요</T>
          {!perm.exact && (
            <Btn small variant="secondary" title="알람 및 리마인더 허용" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={openExactSettings} />
          )}
          {!perm.fullScreen && (
            <Btn small variant="secondary" title="전체 화면 알림 허용 (잠금 화면 위)" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={openFullScreenSettings} />
          )}
        </Card>
      )}

      <Card style={{ marginBottom: 14, alignItems: 'center', paddingVertical: 22 }}>
        <Ionicons name="alarm" size={30} color="#F5A524" />
        <T weight="800" size={17} style={{ marginTop: 8 }}>
          {nextOn ? untilText(nextOn.next!) : '켜진 알람이 없어요'}
        </T>
        {nextOn ? (
          <T size={13} sub style={{ marginTop: 4 }}>
            {(() => {
              const d = new Date(nextOn.next!);
              const tl = timeLabel(d.getHours(), d.getMinutes());
              return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${tl.ap} ${tl.hm}${nextOn.label ? ' · ' + nextOn.label : ''}`;
            })()}
          </T>
        ) : null}
      </Card>

      {list.length === 0 ? (
        <Empty icon="alarm-outline" title="알람을 추가해 보세요" desc="기상, 1교시 전, 종례 뒤 학원 출발처럼 매일 같은 시간에 울리는 알람을 만들 수 있어요." />
      ) : (
        list.map((a) => {
          const tl = timeLabel(a.hour, a.minute);
          const dim = a.enabled ? undefined : t.textFaint;
          return (
            <Card
              key={a.id}
              style={{ marginBottom: 10 }}
              onPress={() => {
                setIsNew(false);
                setEdit({ ...a });
              }}
              onLongPress={async () => {
                if (await confirmAsk('이 알람을 삭제할까요?', undefined, { destructive: true, okText: '삭제' })) {
                  deleteAlarm(a.id);
                  reload();
                }
              }}
            >
              <Row>
                <View style={{ flex: 1 }}>
                  <Row gap={6} style={{ alignItems: 'flex-end' }}>
                    <T size={15} weight="700" color={dim} style={{ marginBottom: 6 }}>
                      {tl.ap}
                    </T>
                    <T size={38} weight="300" color={dim} style={{ fontVariant: ['tabular-nums'] }}>
                      {tl.hm}
                    </T>
                  </Row>
                  <Row gap={6} style={{ marginTop: 2 }}>
                    <Ionicons name={MODE_ICON[a.mode]} size={13} color={dim || t.textSub} />
                    <T size={13} sub color={dim} numberOfLines={1} style={{ flex: 1 }}>
                      {[a.label, daysText(a.days), MODE_TEXT[a.mode]].filter(Boolean).join(' · ')}
                    </T>
                  </Row>
                </View>
                <Switch
                  value={a.enabled}
                  trackColor={{ true: '#F5A524', false: t.surface2 }}
                  thumbColor="#fff"
                  onValueChange={async (v) => {
                    const at = await saveAlarm({ ...a, enabled: v });
                    reload();
                    if (v && at) toast(untilText(at));
                  }}
                />
              </Row>
            </Card>
          );
        })
      )}
      <T size={11} faint center style={{ marginTop: 10 }}>
        길게 누르면 삭제 · 알람은 이 기기에만 저장돼요
      </T>

      <AlarmEditor
        alarm={edit}
        isNew={isNew}
        onClose={() => {
          stopPreview();
          setEdit(null);
        }}
        onSaved={(at) => {
          stopPreview();
          setEdit(null);
          reload();
          if (at) toast(untilText(at));
        }}
        onDelete={() => {
          if (edit) deleteAlarm(edit.id);
          setEdit(null);
          reload();
        }}
      />
    </Screen>
  );
}

function AlarmEditor({
  alarm,
  isNew,
  onClose,
  onSaved,
  onDelete,
}: {
  alarm: Alarm | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: (at: number) => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [a, setA] = useState<Alarm>(newAlarm());
  const [offset, setOffset] = useState(10);
  const schedules = useList('schedules');
  useEffect(() => {
    if (alarm) setA(alarm);
  }, [alarm]);
  const set = (p: Partial<Alarm>) => setA((x) => ({ ...x, ...p }));
  const tl = timeLabel(a.hour, a.minute);

  // 기본 일정(교시·조회·종례 등) 중 매주 반복되는 것 → 알람 시간 맞추기
  const presets = useMemo(() => {
    const m = new Map<string, { title: string; startMin: number; endMin: number; days: number[] }>();
    for (const s of schedules) {
      if (s.repeat !== 'weekly' || !s.days?.length) continue;
      const k = `${s.title}|${s.startMin}`;
      const prev = m.get(k);
      if (prev) prev.days = [...new Set([...prev.days, ...s.days])];
      else m.set(k, { title: s.title, startMin: s.startMin, endMin: s.endMin, days: [...s.days] });
    }
    return [...m.values()].sort((x, y) => x.startMin - y.startMin).slice(0, 24);
  }, [schedules]);

  const usePreset = (p: { title: string; startMin: number; days: number[] }) => {
    const at = (((p.startMin - offset) % 1440) + 1440) % 1440;
    set({ hour: Math.floor(at / 60), minute: at % 60, days: p.days, label: offset ? `${p.title} ${offset}분 전` : p.title });
    toast(`${p.title} ${offset ? offset + '분 전' : ''}으로 맞췄어요`);
  };

  return (
    <Sheet
      visible={!!alarm}
      onClose={onClose}
      title={isNew ? '알람 추가' : '알람 편집'}
      full
      footer={
        <Row>
          {!isNew && <Btn title="삭제" variant="danger" onPress={onDelete} />}
          <Btn
            title="저장"
            flex
            onPress={async () => {
              try {
                const at = await saveAlarm({ ...a, enabled: true });
                onSaved(at);
              } catch (e: any) {
                toast(e?.message || '저장하지 못했어요');
              }
            }}
          />
        </Row>
      }
    >
      <Pressable
        onPress={async () => {
          const v = await promptText('알람 시각 (24시간)', `${a.hour}:${String(a.minute).padStart(2, '0')}`, { placeholder: '예: 06:30', okText: '확인' });
          if (v == null) return;
          const m = v.trim().match(/^(\d{1,2})\s*[:시.]?\s*(\d{1,2})?/);
          const h = m ? Number(m[1]) : NaN;
          const mi = m && m[2] ? Number(m[2]) : 0;
          if (!(h >= 0 && h < 24 && mi >= 0 && mi < 60)) return toast('06:30 처럼 입력해주세요');
          set({ hour: h, minute: mi });
        }}
        style={{ alignItems: 'center', marginBottom: 6 }}
      >
        <Row gap={8} style={{ alignItems: 'flex-end' }}>
          <T size={18} weight="700" style={{ marginBottom: 10 }}>
            {tl.ap}
          </T>
          <T size={58} weight="300" style={{ fontVariant: ['tabular-nums'] }}>
            {tl.hm}
          </T>
        </Row>
        <T size={12} color={t.primary} weight="700">
          탭해서 직접 입력
        </T>
      </Pressable>
      <Row style={{ justifyContent: 'center', marginBottom: 14 }} gap={12}>
        <Stepper value={a.hour} onChange={(v) => set({ hour: v })} min={0} max={23} format={(v) => `${v}시`} />
        <Stepper value={a.minute} onChange={(v) => set({ minute: v })} min={0} max={59} format={(v) => `${v}분`} />
      </Row>

      <Label>반복</Label>
      <Row wrap style={{ marginBottom: 6 }}>
        {ORDER.map((d) => (
          <Chip
            key={d}
            small
            label={WEEK[d]}
            selected={a.days.includes(d)}
            onPress={() => set({ days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d] })}
          />
        ))}
      </Row>
      <Row wrap style={{ marginBottom: 14 }}>
        <Chip small label="평일" onPress={() => set({ days: [1, 2, 3, 4, 5] })} />
        <Chip small label="주말" onPress={() => set({ days: [6, 0] })} />
        <Chip small label="매일" onPress={() => set({ days: [0, 1, 2, 3, 4, 5, 6] })} />
        <Chip small label="한 번만" onPress={() => set({ days: [] })} />
      </Row>

      {presets.length > 0 && (
        <>
          <Label>기본 일정에 맞추기</Label>
          <Row style={{ marginBottom: 8 }}>
            <T size={13} sub style={{ flex: 1 }}>
              일정 시작
            </T>
            <Stepper value={offset} onChange={setOffset} step={5} min={0} max={120} format={(v) => (v ? `${v}분 전` : '정각')} />
          </Row>
          <Row wrap style={{ marginBottom: 14 }}>
            {presets.map((p) => (
              <Chip key={p.title + p.startMin} small icon="school-outline" label={`${p.title} ${Math.floor(p.startMin / 60)}:${String(p.startMin % 60).padStart(2, '0')}`} onPress={() => usePreset(p)} />
            ))}
          </Row>
        </>
      )}

      <Field label="알람 이름" value={a.label} onChangeText={(v) => set({ label: v })} placeholder="예: 기상, 학원 출발" />

      <Label>울리는 방식</Label>
      <Segmented
        value={a.mode}
        onChange={(v) => set({ mode: v })}
        options={[
          { value: 'sound', label: '벨' },
          { value: 'vibrate', label: '진동' },
          { value: 'both', label: '벨+진동' },
        ]}
        style={{ marginBottom: 14 }}
      />

      {a.mode !== 'vibrate' && (
        <Card style={{ marginBottom: 12 }}>
          <Row>
            <Ionicons name="musical-notes" size={20} color="#F5A524" />
            <View style={{ flex: 1 }}>
              <T size={12} sub>
                알람음
              </T>
              <T weight="800" numberOfLines={1}>
                {a.soundName || `기본 (${defaultAlarmName()})`}
              </T>
            </View>
          </Row>
          <Row wrap style={{ marginTop: 10 }}>
            <Btn
              small
              variant="secondary"
              icon="notifications-outline"
              title="벨소리 고르기"
              onPress={async () => {
                const r = await pickRingtone(a.soundUri).catch(() => null);
                if (r) set({ soundUri: r.uri, soundName: r.name });
              }}
            />
            <Btn
              small
              variant="secondary"
              icon="folder-open-outline"
              title="내 음악 파일"
              onPress={async () => {
                const r = await pickAudioFile().catch(() => null);
                if (r) set({ soundUri: r.uri, soundName: r.name });
              }}
            />
            {a.soundUri ? <Btn small variant="ghost" title="기본으로" onPress={() => set({ soundUri: null, soundName: null })} /> : null}
          </Row>
          <Row style={{ marginTop: 12 }}>
            <T weight="600" style={{ flex: 1 }}>
              음량
            </T>
            <Stepper value={a.volume} onChange={(v) => set({ volume: v })} step={10} min={10} max={100} format={(v) => `${v}%`} />
          </Row>
          <ToggleRow label="점점 크게" desc="30초 동안 작은 소리에서 설정한 음량까지" value={a.crescendo} onChange={(v) => set({ crescendo: v })} />
        </Card>
      )}

      {a.mode !== 'sound' && (
        <>
          <Label>진동 패턴</Label>
          <Segmented
            value={a.vibe}
            onChange={(v) => set({ vibe: v })}
            options={[
              { value: 'basic', label: '기본' },
              { value: 'heartbeat', label: '심장박동' },
              { value: 'strong', label: '강하게' },
            ]}
            style={{ marginBottom: 14 }}
          />
        </>
      )}

      <Row style={{ marginBottom: 12 }}>
        <T weight="600" style={{ flex: 1 }}>
          다시 알림
        </T>
        <Stepper value={a.snoozeMin} onChange={(v) => set({ snoozeMin: v })} min={1} max={30} format={(v) => `${v}분 뒤`} />
      </Row>

      <Row>
        <Btn small variant="secondary" icon="play" title="미리 듣기" flex onPress={() => previewAlarm(a)} />
        <Btn small variant="ghost" icon="stop" title="멈춤" onPress={stopPreview} />
      </Row>
    </Sheet>
  );
}
