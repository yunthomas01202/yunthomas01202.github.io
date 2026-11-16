// 설정: 계정, 장소 태그, 스탯 축, 캘린더, 알림, 테마, 데이터
import React, { useState } from 'react';
import { Image, Platform, Share, View } from 'react-native';
import { useTheme } from '../src/theme';
import { signOut, useAuth } from '../src/lib/auth';
import { COLLECTIONS, getState, newId, updateSettings, useData } from '../src/lib/store';
import { Btn, Card, Chip, Field, IconBtn, Label, Row, Screen, SectionTitle, Segmented, Stepper, T, ToggleRow, confirmAsk, promptText, toast } from '../src/components/ui';
import { fmtMin } from '../src/lib/date';
import { connectDrive } from '../src/lib/files';
import type { Settings } from '../src/lib/types';

const PLACE_EMOJIS = ['🛏️', '🏫', '🏠', '☕', '📚', '🚌', '🏢', '🌳'];

export default function SettingsScreen() {
  const t = useTheme();
  const user = useAuth((s) => s.user);
  const st = useData((s) => s.settings);
  const [axes, setAxes] = useState<string[]>(st.statAxes);
  const set = (p: Partial<Settings>) => updateSettings(p);

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
            title="로그아웃"
            onPress={async () => {
              if (await confirmAsk('로그아웃할까요?', '데이터는 계정에 안전하게 남아 있어요.')) signOut();
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

      <SectionTitle title="알림 · 필기 · 화면" />
      <Card>
        <Row style={{ marginBottom: 6 }}>
          <T weight="600" style={{ flex: 1 }}>
            블록 시작 전 알림
          </T>
          <Stepper value={st.notifyBeforeMin} onChange={(v) => set({ notifyBeforeMin: v })} step={5} min={0} max={60} format={(v) => (v ? `${v}분 전` : '끔')} />
        </Row>
        <ToggleRow label="펜으로만 필기" desc="손가락은 스크롤·확대에만 써요 (애플펜슬·S펜 사용 시 추천)" value={st.penOnly} onChange={(v) => set({ penOnly: v })} />
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
          모든 데이터는 구글 계정에 연결된 클라우드(Firebase)에 저장되고, 인터넷이 없을 때도 기기에 저장해 뒀다가 연결되면 동기화돼요.
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
        학습지원 v1.0
      </T>
    </Screen>
  );
}
