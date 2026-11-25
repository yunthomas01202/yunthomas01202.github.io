// 우리 학교: 나이스(NEIS)에서 급식 · 학사일정(시험·방학) 불러오기
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { alpha } from '../../src/lib/color';
import { add, updateSettings, useData, useList } from '../../src/lib/store';
import { clearNeisCache, getMeals, getSchoolEvents, isKeyEvent, searchSchools, type Meal, type SchoolEvent, type SchoolHit } from '../../src/lib/neis';
import { addDays, daysUntil, ddayLabel, fmtKDate, startOfWeek, ymd } from '../../src/lib/date';
import { Badge, Btn, Card, Empty, Field, Row, Screen, Segmented, T, confirmAsk, promptText, toast } from '../../src/components/ui';

const ACCENT = '#16A34A';

export default function SchoolScreen() {
  const school = useData((s) => s.settings.school);
  const [changing, setChanging] = useState(false);
  if (!school || changing) return <SchoolSearch onDone={() => setChanging(false)} />;
  return <SchoolHome onChange={() => setChanging(true)} />;
}

function SchoolSearch({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SchoolHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const search = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await searchSchools(q);
      setHits(r);
      if (!r.length) setErr('찾는 학교가 없어요. 이름을 조금 다르게 써 보세요.');
    } catch (e: any) {
      setErr(e?.message || '검색하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="우리 학교 찾기" subtitle="나이스(NEIS) 공개 정보로 급식·학사일정을 불러와요" accent={ACCENT}>
      <Field label="학교 이름" value={q} onChangeText={setQ} placeholder="예: 한국고, 서울과학고 (정확할수록 좋아요)" onSubmitEditing={search} />
      <Btn title="검색" icon="search" color={ACCENT} onPress={search} loading={busy} />
      {err ? (
        <T size={13} color={t.danger} style={{ marginTop: 10 }}>
          {err}
        </T>
      ) : null}
      <View style={{ marginTop: 12 }}>
        {hits.map((h) => (
          <Card
            key={h.code}
            style={{ marginBottom: 8 }}
            onPress={() => {
              updateSettings({ school: { office: h.office, code: h.code, name: h.name } });
              clearNeisCache();
              toast(`${h.name}으로 설정했어요`);
              onDone();
            }}
          >
            <Row>
              <Ionicons name="school" size={22} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <T weight="800">{h.name}</T>
                <T size={12} sub numberOfLines={1}>
                  {h.kind} · {h.address || h.officeName}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function SchoolHome({ onChange }: { onChange: () => void }) {
  const t = useTheme();
  const school = useData((s) => s.settings.school)!;
  const neisKey = useData((s) => s.settings.neisKey);
  const [tab, setTab] = useState<'meal' | 'sched'>('meal');
  const [week, setWeek] = useState(0);
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [events, setEvents] = useState<SchoolEvent[] | null>(null);
  const [err, setErr] = useState('');
  const stored = useList('events');

  const ws = addDays(startOfWeek(new Date(), 1), week * 7);
  const from = ymd(ws);
  const to = ymd(addDays(ws, 6));

  const loadMeals = useCallback(() => {
    setMeals(null);
    setErr('');
    getMeals(from, to)
      .then(setMeals)
      .catch((e) => {
        setErr(e?.message || '급식을 불러오지 못했어요');
        setMeals([]);
      });
  }, [from, to]);
  useEffect(loadMeals, [loadMeals, school.code]);
  useEffect(() => {
    setEvents(null);
    const f = ymd(addDays(new Date(), -7));
    const tt = ymd(addDays(new Date(), 120));
    getSchoolEvents(f, tt)
      .then(setEvents)
      .catch((e) => {
        setErr(e?.message || '학사일정을 불러오지 못했어요');
        setEvents([]);
      });
  }, [school.code]);

  const today = ymd();
  const byDay: Record<string, Meal[]> = {};
  (meals || []).forEach((m) => (byDay[m.date] = [...(byDay[m.date] || []), m]));
  const upcomingKey = (() => {
    const seen = new Set<string>();
    return (events || [])
      .filter((e) => e.date >= today && isKeyEvent(e.name))
      .filter((e) => {
        const k = e.name.replace(/\(.*\)/, '').trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 4);
  })();

  const importEvents = async () => {
    const list = (events || []).filter((e) => e.date >= today);
    const have = new Set(stored.filter((e) => e.itemId === 'neis').map((e) => e.date + e.title));
    const todo = list.filter((e) => !have.has(e.date + e.name));
    if (!todo.length) return toast('이미 모두 넣었어요');
    if (!(await confirmAsk(`학사일정 ${todo.length}개를 일정에 넣을까요?`, '홈 화면 일정과 디데이에 보여요.'))) return;
    for (const e of todo) add('events', { title: e.name, date: e.date, color: e.off ? '#E5484D' : ACCENT, itemId: 'neis', note: '나이스 학사일정' } as any);
    toast(`${todo.length}개를 넣었어요`);
  };

  return (
    <Screen title={school.name} subtitle="급식 · 학사일정" accent={ACCENT} right={<Btn small variant="ghost" title="학교 바꾸기" onPress={onChange} />}>
      {upcomingKey.length > 0 && (
        <Card style={{ marginBottom: 12, backgroundColor: alpha(ACCENT, 0.08) }}>
          {upcomingKey.map((e) => (
            <Row key={e.date + e.name} style={{ paddingVertical: 3 }}>
              <T weight="900" color={ACCENT} style={{ width: 64 }}>
                {ddayLabel(daysUntil(e.date))}
              </T>
              <T weight="700" style={{ flex: 1 }} numberOfLines={1}>
                {e.name}
              </T>
              <T size={12} sub>
                {fmtKDate(e.date, false)}
              </T>
            </Row>
          ))}
        </Card>
      )}
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'meal', label: '🍚 급식' },
          { value: 'sched', label: '📅 학사일정' },
        ]}
        style={{ marginBottom: 12 }}
      />
      {err ? (
        <Card style={{ marginBottom: 10, backgroundColor: alpha(t.danger, 0.08) }}>
          <T size={13}>{err}</T>
          <T size={12} sub style={{ marginTop: 4 }}>
            나이스 인증키가 있으면 아래에서 넣어 주세요. 없어도 대부분 조회돼요.
          </T>
        </Card>
      ) : null}

      {tab === 'meal' ? (
        <>
          <Row style={{ marginBottom: 10 }}>
            <Btn small variant="secondary" icon="chevron-back" title="지난주" onPress={() => setWeek(week - 1)} />
            <T weight="800" center style={{ flex: 1 }}>
              {week === 0 ? '이번 주' : week === 1 ? '다음 주' : `${fmtKDate(from, false)} 주`}
            </T>
            <Btn small variant="secondary" title="다음주" onPress={() => setWeek(week + 1)} />
          </Row>
          {meals === null ? (
            <ActivityIndicator style={{ marginTop: 30 }} />
          ) : !meals.length ? (
            <Empty icon="restaurant-outline" title="이 주에는 급식 정보가 없어요" desc="방학이거나 학교에서 아직 올리지 않았을 수 있어요." />
          ) : (
            Object.keys(byDay)
              .sort()
              .map((d) => (
                <Card key={d} style={{ marginBottom: 10, borderWidth: d === today ? 2 : 0, borderColor: ACCENT }}>
                  <T weight="900" color={d === today ? ACCENT : undefined} style={{ marginBottom: 6 }}>
                    {fmtKDate(d)} {d === today ? '· 오늘' : ''}
                  </T>
                  {byDay[d].map((m) => (
                    <View key={m.type} style={{ marginBottom: 6 }}>
                      <Row gap={6}>
                        <Badge label={m.type} color={ACCENT} />
                        {m.kcal ? (
                          <T size={11} faint>
                            {m.kcal}
                          </T>
                        ) : null}
                      </Row>
                      <T size={14} style={{ marginTop: 4, lineHeight: 21 }}>
                        {m.dishes.join(' · ')}
                      </T>
                    </View>
                  ))}
                </Card>
              ))
          )}
        </>
      ) : events === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <>
          <Btn small icon="calendar" title="앞으로의 학사일정을 내 일정에 넣기" variant="secondary" style={{ alignSelf: 'flex-start', marginBottom: 10 }} onPress={importEvents} />
          {!events.length && <Empty icon="calendar-outline" title="학사일정이 없어요" />}
          {events.map((e) => {
            const past = e.date < today;
            return (
              <Row key={e.date + e.name} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border, opacity: past ? 0.45 : 1 }}>
                <T size={13} sub style={{ width: 92 }}>
                  {fmtKDate(e.date)}
                </T>
                <T weight={isKeyEvent(e.name) ? '800' : '500'} color={e.off ? t.danger : undefined} style={{ flex: 1 }}>
                  {e.name}
                </T>
                {!past && isKeyEvent(e.name) ? (
                  <T size={12} weight="800" color={ACCENT}>
                    {ddayLabel(daysUntil(e.date))}
                  </T>
                ) : null}
              </Row>
            );
          })}
        </>
      )}

      <Pressable
        style={{ marginTop: 20, alignSelf: 'center' }}
        onPress={async () => {
          const v = await promptText('나이스 오픈API 인증키 (선택)', neisKey || '', { placeholder: 'open.neis.go.kr 에서 무료 발급' });
          if (v == null) return;
          updateSettings({ neisKey: v.trim() || null });
          clearNeisCache();
          toast('저장했어요');
        }}
      >
        <T size={12} faint>
          {neisKey ? '🔑 인증키 사용 중 · 바꾸기' : '조회가 안 되면 나이스 인증키 넣기'}
        </T>
      </Pressable>
    </Screen>
  );
}

