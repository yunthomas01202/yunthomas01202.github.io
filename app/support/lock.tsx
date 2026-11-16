// 앱 잠금: 공부하는 동안 고른 앱(사파리·크롬 포함)을 막기
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { updateSettings, useData } from '../../src/lib/store';
import { Badge, Btn, Card, Chip, Empty, Field, Row, Screen, SectionTitle, T, ToggleRow, promptText, toast } from '../../src/components/ui';
import {
  DeviceActivitySelectionView,
  LockPermissions,
  androidApps,
  getPermissions,
  loadIosSelection,
  lockAvailable,
  lockUntil,
  openOverlaySettings,
  openUsageSettings,
  pinThisApp,
  requestScreenTime,
  saveIosSelection,
  startLock,
  stopLock,
} from '../../src/lib/applock';
import { fmtTime } from '../../src/lib/date';
import { useTick } from '../../src/features/support/timerStore';

const DISTRACTING = [
  'com.android.chrome',
  'com.sec.android.app.sbrowser',
  'com.google.android.youtube',
  'com.instagram.android',
  'com.kakao.talk',
  'com.zhiliaoapp.musically',
  'com.ss.android.ugc.trill',
  'com.netflix.mediaclient',
  'com.nhn.android.webtoon',
  'com.naver.linewebtoon',
  'com.discord',
  'com.twitter.android',
  'com.facebook.katana',
];
const STRICT_PHRASE = '나는 지금 공부를 포기합니다';

export default function Lock() {
  const t = useTheme();
  const settings = useData((s) => s.settings);
  const [perm, setPerm] = useState<LockPermissions>({ ready: false });
  const [apps, setApps] = useState<{ packageName: string; label: string }[]>([]);
  const [q, setQ] = useState('');
  const [until, setUntil] = useState(0);
  const [iosSel, setIosSel] = useState<string | null>(null);
  const locked = until > Date.now();
  useTick(locked, 1000);
  const pk = settings.lockApps.androidPackages;

  const refresh = useCallback(async () => {
    setPerm(await getPermissions());
    setUntil(await lockUntil());
  }, []);

  useEffect(() => {
    refresh();
    if (Platform.OS === 'android') androidApps().then(setApps).catch(() => {});
    else loadIosSelection().then(setIosSel);
    const sub = AppState.addEventListener('change', (s: string) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const filtered = useMemo(() => {
    const list = q ? apps.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())) : apps;
    return [...list].sort((a, b) => Number(pk.includes(b.packageName)) - Number(pk.includes(a.packageName)) || Number(DISTRACTING.includes(b.packageName)) - Number(DISTRACTING.includes(a.packageName)));
  }, [apps, q, pk]);

  const setPk = (list: string[]) => updateSettings({ lockApps: { ...settings.lockApps, androidPackages: list } });

  const lockNow = async (min: number) => {
    if (Platform.OS === 'android' && pk.length === 0) return toast('막을 앱을 먼저 골라주세요');
    if (Platform.OS === 'ios' && !iosSel) return toast('막을 앱·사이트를 먼저 골라주세요');
    const u = await startLock(min, pk);
    setUntil(u);
    toast(`${fmtTime(u)}까지 잠갔어요`);
  };

  const unlock = async () => {
    if (settings.lockApps.strict && Date.now() < until) {
      const typed = await promptText(`엄격 모드예요. 풀려면 아래 문장을 그대로 입력하세요:\n“${STRICT_PHRASE}”`, '');
      if (typed?.trim() !== STRICT_PHRASE) return toast('문장이 달라서 계속 잠가둘게요 💪');
    }
    await stopLock();
    setUntil(0);
    toast('잠금을 풀었어요');
  };

  if (!lockAvailable()) {
    return (
      <Screen title="앱 잠금">
        <Empty
          icon="lock-closed-outline"
          title="이 빌드에서는 앱 잠금을 쓸 수 없어요"
          desc={
            Platform.OS === 'web'
              ? '앱 잠금은 휴대폰 앱에서만 쓸 수 있어요. 웹에서는 공부 타이머의 ‘집중 화면’을 써보세요.'
              : Platform.OS === 'ios'
              ? 'iOS는 Apple 스크린 타임 권한(Family Controls)이 들어간 개발/배포 빌드가 필요해요. README의 ‘앱 잠금’ 항목을 참고하세요.'
              : 'Android는 이 프로젝트의 app-blocker 네이티브 모듈이 들어간 빌드(EAS 빌드)에서 동작해요.'
          }
        />
      </Screen>
    );
  }

  const left = Math.max(0, Math.ceil((until - Date.now()) / 60000));

  return (
    <Screen title="앱 잠금" subtitle="공부하는 동안 딴짓 앱을 막아요" accent={t.danger}>
      <Card color={locked ? (t.dark ? '#3A1418' : '#FDECEC') : undefined}>
        <Row>
          <Ionicons name={locked ? 'lock-closed' : 'lock-open-outline'} size={28} color={locked ? t.danger : t.textSub} />
          <View style={{ flex: 1 }}>
            <T weight="900" size={18}>
              {locked ? `잠금 중 · ${left}분 남음` : '잠금 꺼짐'}
            </T>
            <T size={12} sub>
              {locked ? `${fmtTime(until)}에 풀려요${Platform.OS === 'ios' ? ' (이 앱을 열면 자동 해제)' : ''}` : '아래에서 시간을 골라 바로 잠글 수 있어요'}
            </T>
          </View>
          {locked && <Btn small title="풀기" variant="secondary" color={t.danger} onPress={unlock} />}
        </Row>
        {!locked && (
          <Row wrap style={{ marginTop: 14 }}>
            {[25, 50, 90, 120, 180].map((m) => (
              <Chip key={m} label={`${m}분 잠그기`} color={t.danger} onPress={() => lockNow(m)} />
            ))}
          </Row>
        )}
      </Card>

      <SectionTitle title="1. 권한" />
      <Card>
        {Platform.OS === 'ios' ? (
          <PermRow ok={!!perm.screenTime} label="스크린 타임 접근" desc="Apple이 제공하는 방식으로 앱·웹사이트를 막아요" onPress={async () => { await requestScreenTime(); refresh(); }} />
        ) : (
          <>
            <PermRow ok={!!perm.usage} label="사용 정보 접근" desc="지금 어떤 앱이 열렸는지 확인해요" onPress={openUsageSettings} />
            <PermRow ok={!!perm.overlay} label="다른 앱 위에 표시" desc="막힌 앱 위에 잠금 화면을 띄워요" onPress={openOverlaySettings} />
          </>
        )}
      </Card>

      <SectionTitle title="2. 막을 앱 고르기" right={Platform.OS === 'android' ? <Badge label={`${pk.length}개`} color={t.danger} /> : undefined} />
      {Platform.OS === 'ios' ? (
        <Card>
          <T sub size={13} style={{ marginBottom: 10 }}>
            Safari를 포함한 앱, 앱 카테고리, 웹사이트를 고를 수 있어요.
          </T>
          {DeviceActivitySelectionView ? (
            <DeviceActivitySelectionView
              style={{ height: 52, borderRadius: 14, overflow: 'hidden' }}
              familyActivitySelection={iosSel || undefined}
              onSelectionChange={(e: any) => {
                const sel = e?.nativeEvent?.familyActivitySelection;
                if (sel) {
                  setIosSel(sel);
                  saveIosSelection(sel);
                }
              }}
            >
              <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.danger, borderRadius: 14 }}>
                <T weight="800" color="#fff">
                  {iosSel ? '선택한 앱·사이트 바꾸기' : '막을 앱·사이트 고르기'}
                </T>
              </View>
            </DeviceActivitySelectionView>
          ) : null}
        </Card>
      ) : (
        <>
          <Field value={q} onChangeText={setQ} placeholder="앱 이름 검색" />
          {filtered.slice(0, 80).map((a) => {
            const on = pk.includes(a.packageName);
            return (
              <Pressable
                key={a.packageName}
                onPress={() => setPk(on ? pk.filter((x) => x !== a.packageName) : [...pk, a.packageName])}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 6, backgroundColor: pressed ? t.surface2 : t.surface })}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.danger : t.textFaint} />
                <T weight="600" style={{ flex: 1 }}>
                  {a.label}
                </T>
                {DISTRACTING.includes(a.packageName) && <Badge label="추천" color={t.warn} />}
              </Pressable>
            );
          })}
        </>
      )}

      <SectionTitle title="3. 옵션" />
      <Card>
        <ToggleRow label="엄격 모드" desc="시간이 끝나기 전에 풀려면 긴 문장을 직접 입력해야 해요" value={settings.lockApps.strict} onChange={(v) => updateSettings({ lockApps: { ...settings.lockApps, strict: v } })} />
        <ToggleRow label="공부 타이머와 연동" desc="공부 타이머를 켜면 자동으로 잠기고, 끄면 풀려요" value={settings.lockApps.withTimer} onChange={(v) => updateSettings({ lockApps: { ...settings.lockApps, withTimer: v } })} />
        {Platform.OS === 'android' && (
          <Btn title="이 앱 화면 고정 (다른 앱으로 못 나가게)" icon="pin" variant="secondary" style={{ marginTop: 8 }} onPress={() => pinThisApp()} />
        )}
        {Platform.OS === 'ios' && (
          <T size={12} sub style={{ marginTop: 6 }}>
            더 강하게 막으려면 iPhone 설정 › 손쉬운 사용 › 사용법 유도(Guided Access)를 함께 쓰면 이 앱 밖으로 못 나가요.
          </T>
        )}
      </Card>
    </Screen>
  );
}

function PermRow({ ok, label, desc, onPress }: { ok: boolean; label: string; desc: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ paddingVertical: 8 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={24} color={ok ? t.success : t.warn} />
      <View style={{ flex: 1 }}>
        <T weight="700">{label}</T>
        <T size={12} sub>
          {desc}
        </T>
      </View>
      {!ok && <Btn small title="허용하기" onPress={onPress} />}
    </Row>
  );
}
