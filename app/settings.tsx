// 설정: 계정, 장소 태그, 스탯 축, 캘린더, 알림, 테마, 데이터
import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Share, View } from 'react-native';
import { useTheme } from '../src/theme';
import { signOut, useAuth } from '../src/lib/auth';
import { COLLECTIONS, LOCAL_UID, getState, newId, updateSettings, useData, useList } from '../src/lib/store';
import { ScheduleEditor, ScheduleManager, SchoolBuilder } from '../src/features/planner/ScheduleSheets';
import { describeRepeat, durLabel, groupsOf } from '../src/features/planner/schedules';
import type { Schedule } from '../src/lib/types';
import { Btn, Card, Chip, Field, IconBtn, Label, Row, Screen, SectionTitle, Segmented, Stepper, T, ToggleRow, confirmAsk, promptText, toast } from '../src/components/ui';
import { fmtMin, ymd } from '../src/lib/date';
import { openHotkeyHelp } from '../src/lib/hotkeys';
import { router } from 'expo-router';
import { connectDrive } from '../src/lib/files';
import type { Settings } from '../src/lib/types';

const FIXED_DRAFT = { date: ymd(), startMin: 16 * 60, endMin: 17 * 60, weekly: true };
const PLACE_EMOJIS = ['🛏️', '🏫', '🏠', '☕', '📚', '🚌', '🏢', '🌳'];

export default function SettingsScreen() {
  const t = useTheme();
  const user = useAuth((s) => s.user);
  const st = useData((s) => s.settings);
  const [axes, setAxes] = useState<string[]>(st.statAxes);
  const set = (p: Partial<Settings>) => updateSettings(p);
  const isLocalUser = user?.uid === LOCAL_UID;
  const schedules = useList('schedules');
  const [mgr, setMgr] = useState(false);
  const [school, setSchool] = useState(false);
  const [edit, setEdit] = useState<{ open: boolean; schedule: Schedule | null }>({ open: false, schedule: null });
  const fixedGroups = useMemo(() => groupsOf(schedules), [schedules]);
  const fixedSingles = useMemo(
    () => schedules.filter((x) => !x.group && x.repeat === 'weekly').sort((a, b) => a.startMin - b.startMin),
    [schedules],
  );

  return (
    <Screen title="설정">
      <Card>
        <Row>
          {user?.photo ? <Image source={{ uri: user.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} /> : null}
          <View style={{ flex: 1 }}>
            <T weight="800" size={16}>
              {user?.name}
            </T>
            <T size={13} sub>
              {user?.email}
            </T>
          </View>
          <Btn
            small
            variant="secondary"
            title={isLocalUser ? '나가기' : '로그아웃'}
            onPress={async () => {
              if (isLocalUser) {
                if (await confirmAsk('처음 화면으로 갈까요?', '이 기기 데이터는 지워지지 않고, 다시 "로그인 없이 시작"을 누르면 그대로 보여요.')) signOut();
              } else if (await confirmAsk('로그아웃할까요?', '데이터는 계정에 안전하게 남아 있어요.')) signOut();
            }}
          />
        </Row>
      </Card>

      <SectionTitle title="장소 태그" />
      <Card>
        <T size={12} sub style={{ marginBottom: 10 }}>
          할 일에 장소를 붙여두면, 그 장소 탭을 눌렀을 때 거기서 할 수 있는 일만 보여요.
        </T>
        {st.places.map((p) => (
          <Row key={p.id} style={{ paddingVertical: 4 }}>
            <Chip
              label={p.emoji}
              onPress={() => {
                const i = PLACE_EMOJIS.indexOf(p.emoji);
                const e = PLACE_EMOJIS[(i + 1) % PLACE_EMOJIS.length];
                set({ places: st.places.map((x) => (x.id === p.id ? { ...x, emoji: e } : x)) });
              }}
            />
            <T weight="700" style={{ flex: 1 }}>
              #{p.name}
            </T>
            <IconBtn
              name="pencil"
              size={16}
              onPress={async () => {
                const n = await promptText('장소 이름', p.name);
                if (n?.trim()) set({ places: st.places.map((x) => (x.id === p.id ? { ...x, name: n.trim() } : x)) });
              }}
            />
            <IconBtn name="trash-outline" size={16} color={t.danger} onPress={() => set({ places: st.places.filter((x) => x.id !== p.id) })} />
          </Row>
        ))}
        <Btn
          small
          variant="secondary"
          icon="add"
          title="장소 추가"
          style={{ alignSelf: 'flex-start', marginTop: 6 }}
          onPress={async () => {
            const n = await promptText('새 장소', '', { placeholder: '예: 독서실' });
            if (n?.trim()) set({ places: [...st.places, { id: newId(), name: n.trim(), emoji: '📚' }] });
          }}
        />
      </Card>

      <SectionTitle title="헥사곤 스탯 축 (6개)" />
      <Card>
        <T size={12} sub style={{ marginBottom: 10 }}>
          과목 이름이나 유형(암기·문제풀이·개념·복습·독서)을 축으로 쓸 수 있어요.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {axes.map((a, i) => (
            <View key={i} style={{ width: '31%' }}>
              <Field value={a} onChangeText={(v) => setAxes(axes.map((x, j) => (j === i ? v : x)))} style={{ marginBottom: 0 }} />
            </View>
          ))}
        </View>
        <Btn
          small
          title="축 저장"
          style={{ alignSelf: 'flex-start', marginTop: 10 }}
          onPress={() => {
            set({ statAxes: axes.map((a, i) => a.trim() || `축${i + 1}`) });
            toast('저장했어요');
          }}
        />
      </Card>

      <SectionTitle title="캘린더" />
      <Card>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }}>
            하루 시작
          </T>
          <Stepper value={st.dayStartHour} onChange={(v) => set({ dayStartHour: v })} min={0} max={st.dayEndHour - 1} format={(v) => `${v}시`} />
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }}>
            하루 끝
          </T>
          <Stepper value={st.dayEndHour} onChange={(v) => set({ dayEndHour: v })} min={st.dayStartHour + 1} max={24} format={(v) => `${v}시`} />
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }}>
            집중 잘 되는 시간 (자동 배치)
          </T>
          <Stepper value={st.peakStartHour} onChange={(v) => set({ peakStartHour: v, peakEndHour: Math.max(v + 1, st.peakEndHour) })} min={0} max={23} format={(v) => `${v}시~`} />
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }} />
          <Stepper value={st.peakEndHour} onChange={(v) => set({ peakEndHour: v })} min={st.peakStartHour + 1} max={24} format={(v) => `~${v}시`} />
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }}>
            기본 블록 길이
          </T>
          <Stepper value={st.defaultBlockMin} onChange={(v) => set({ defaultBlockMin: v })} step={5} min={10} max={240} format={fmtMin} />
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <T weight="600" style={{ flex: 1 }}>
            하루 공부 목표
          </T>
          <Stepper value={st.dailyGoalMin} onChange={(v) => set({ dailyGoalMin: v })} step={30} min={30} max={960} format={fmtMin} />
        </Row>
        <Label>한 주의 시작</Label>
        <Segmented
          value={st.weekStartsOn}
          onChange={(v) => set({ weekStartsOn: v })}
          options={[
            { value: 1, label: '월요일' },
            { value: 0, label: '일요일' },
          ]}
        />
      </Card>

      <SectionTitle title="기본 일정 (교시 · 조회 · 종례)" />
      <Card>
        <T size={12} sub style={{ marginBottom: 12, lineHeight: 18 }}>
          공부할 일이 아니라 매주 똑같이 반복되는 고정 일정이에요. 캘린더에 회색 띠로 깔리고, 자동 배치는 이 시간을 피해요. 알람에서 "기본 일정에
          맞추기"로 1교시 전·종례 뒤 알람도 바로 만들 수 있어요.
        </T>
        {fixedGroups.map((g) => {
          const items = schedules.filter((x) => x.group === g.group).sort((a, b) => a.startMin - b.startMin);
          const first = items[0];
          const last = items[items.length - 1];
          return (
            <Row key={g.group} style={{ paddingVertical: 8 }}>
              <Ionicons name="school" size={18} color={first?.color || t.textSub} />
              <View style={{ flex: 1 }}>
                <T weight="800">{g.title}</T>
                <T size={12} sub>
                  {g.count}개 · {first ? describeRepeat(first) : ''} · {first && last ? `${durLabel({ startMin: first.startMin, endMin: last.endMin })}` : ''}
                </T>
              </View>
              <IconBtn name="list" size={18} onPress={() => setMgr(true)} />
            </Row>
          );
        })}
        {fixedSingles.slice(0, 8).map((x) => (
          <Row key={x.id} style={{ paddingVertical: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.color || t.textSub }} />
            <T weight="700" style={{ flex: 1 }} numberOfLines={1}>
              {x.title}
            </T>
            <T size={12} sub>
              {describeRepeat(x)} {durLabel(x)}
            </T>
            <IconBtn name="pencil" size={16} onPress={() => setEdit({ open: true, schedule: x })} />
          </Row>
        ))}
        {!fixedGroups.length && !fixedSingles.length && (
          <T size={13} faint style={{ marginBottom: 6 }}>
            아직 없어요. 학교 시간표를 만들면 조회·1~7교시·점심·종례가 한 번에 들어가요.
          </T>
        )}
        <Row style={{ marginTop: 10 }}>
          <Btn title="학교 시간표 만들기" icon="school-outline" flex small onPress={() => setSchool(true)} />
          <Btn title="고정 일정 추가" icon="add" variant="secondary" flex small onPress={() => setEdit({ open: true, schedule: null })} />
        </Row>
        <Btn title="전체 관리 · 휴일 빼기" icon="calendar-clear-outline" variant="ghost" small style={{ marginTop: 6, alignSelf: 'flex-start' }} onPress={() => setMgr(true)} />
      </Card>

      <SectionTitle title="알람" />
      <Card onPress={() => router.push('/support/alarm')}>
        <Row>
          <Ionicons name="alarm" size={22} color="#F5A524" />
          <View style={{ flex: 1 }}>
            <T weight="800">알람 설정</T>
            <T size={12} sub>
              벨 · 진동 · 벨+진동, 벨소리나 내 음악 고르기
            </T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
        </Row>
      </Card>

      <SectionTitle title="알림 · 필기 · 화면" />
      <Card>
        <Row style={{ marginBottom: 6 }}>
          <T weight="600" style={{ flex: 1 }}>
            블록 시작 전 알림
          </T>
          <Stepper value={st.notifyBeforeMin} onChange={(v) => set({ notifyBeforeMin: v })} step={5} min={0} max={60} format={(v) => (v ? `${v}분 전` : '끔')} />
        </Row>
        <ToggleRow label="펜으로만 필기" desc="손가락은 스크롤·확대에만 써요 (애플펜슬·S펜 사용 시 추천)" value={st.penOnly} onChange={(v) => set({ penOnly: v })} />
        {Platform.OS === 'web' && (
          <>
            <ToggleRow label="키보드 단축키" desc="? 키로 전체 목록을 볼 수 있어요" value={st.hotkeys !== false} onChange={(v) => set({ hotkeys: v })} />
            <ToggleRow
              label="공부 중 이탈 기록"
              desc="타이머가 도는 동안 다른 탭·창으로 간 횟수와 시간을 리포트에 남겨요"
              value={st.trackAway !== false}
              onChange={(v) => set({ trackAway: v })}
            />
            <Btn title="단축키 목록 보기" icon="keypad-outline" variant="ghost" small onPress={openHotkeyHelp} style={{ alignSelf: 'flex-start', marginBottom: 6 }} />
          </>
        )}
        <Label>테마</Label>
        <Segmented
          value={st.theme}
          onChange={(v) => set({ theme: v })}
          options={[
            { value: 'system', label: '시스템' },
            { value: 'light', label: '밝게' },
            { value: 'dark', label: '어둡게' },
          ]}
        />
      </Card>

      <SectionTitle title="데이터" />
      <Card>
        <T size={12} sub style={{ marginBottom: 10 }}>
          {isLocalUser
            ? '로그인 없이 쓰는 중이라 모든 데이터는 이 기기에만 저장돼요. 앱을 지우면 함께 지워지니 가끔 내보내기로 백업해 두세요.'
            : '모든 데이터는 구글 계정에 연결된 클라우드(Firebase)에 저장되고, 인터넷이 없을 때도 기기에 저장해 뒀다가 연결되면 동기화돼요.'}
        </T>
        {Platform.OS === 'web' && (
          <Btn
            title="구글 드라이브 다시 연결"
            icon="logo-google"
            variant="secondary"
            style={{ marginBottom: 8 }}
            onPress={() =>
              connectDrive()
                .then(() => toast('드라이브에 연결했어요'))
                .catch((e: any) => toast(e?.message || '연결하지 못했어요'))
            }
          />
        )}
        <Btn
          title="내 데이터 내보내기 (JSON)"
          icon="share-outline"
          variant="secondary"
          onPress={async () => {
            const s = getState();
            const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), settings: s.settings };
            for (const c of COLLECTIONS) out[c] = Object.values((s as any)[c]);
            try {
              await Share.share({ message: JSON.stringify(out) });
            } catch {}
          }}
        />
      </Card>
      <T size={11} faint center style={{ marginTop: 24 }}>
        학습지원 v1.1
      </T>
      <ScheduleEditor visible={edit.open} schedule={edit.schedule} draft={FIXED_DRAFT} onClose={() => setEdit({ open: false, schedule: null })} />
      <ScheduleManager
        visible={mgr}
        onClose={() => setMgr(false)}
        onAdd={() => {
          setMgr(false);
          setTimeout(() => setEdit({ open: true, schedule: null }), 300);
        }}
        onEdit={(x) => {
          setMgr(false);
          setTimeout(() => setEdit({ open: true, schedule: x }), 300);
        }}
        onSchool={() => {
          setMgr(false);
          setTimeout(() => setSchool(true), 300);
        }}
      />
      <SchoolBuilder visible={school} onClose={() => setSchool(false)} />
    </Screen>
  );
}
