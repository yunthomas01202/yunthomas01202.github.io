// 공부 리포트: 일·주·월 공부 시간 그래프 (열품타 스타일)
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../src/theme';
import { useData, useList } from '../../src/lib/store';
import { Card, Dot, IconBtn, ProgressBar, Row, Screen, SectionTitle, Segmented, T } from '../../src/components/ui';
import { BarChart, DayTimeline } from '../../src/components/charts';
import { addDays, addMonths, fmtClock, fmtKDate, fmtShortDur, fmtYM, startOfMonth, startOfWeek, ymd } from '../../src/lib/date';
import { alpha } from '../../src/lib/color';
import type { StudySession } from '../../src/lib/types';

type Range = 'day' | 'week' | 'month';

export default function Report() {
  const t = useTheme();
  const sessions = useList('sessions');
  const settings = useData((s) => s.settings);
  const [range, setRange] = useState<Range>('week');
  const [anchor, setAnchor] = useState(new Date());

  const byDay = useMemo(() => {
    const m: Record<string, StudySession[]> = {};
    for (const s of sessions) (m[ymd(s.start)] ||= []).push(s);
    return m;
  }, [sessions]);
  const daySec = (k: string) => (byDay[k] || []).reduce((a, s) => a + s.sec, 0);

  const shift = (d: number) => setAnchor(range === 'day' ? addDays(anchor, d) : range === 'week' ? addDays(anchor, d * 7) : addMonths(anchor, d));

  let days: Date[] = [];
  let title = '';
  if (range === 'day') {
    days = [anchor];
    title = fmtKDate(anchor);
  } else if (range === 'week') {
    const s = startOfWeek(anchor, settings.weekStartsOn);
    days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    title = `${fmtKDate(days[0], false)} – ${fmtKDate(days[6], false)}`;
  } else {
    const s = startOfMonth(anchor);
    const n = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    days = Array.from({ length: n }, (_, i) => addDays(s, i));
    title = fmtYM(s);
  }
  const keys = days.map((d) => ymd(d));
  const inRange = keys.flatMap((k) => byDay[k] || []);
  const total = inRange.reduce((a, s) => a + s.sec, 0);
  const studied = keys.filter((k) => daySec(k) > 0).length;
  const subjMap: Record<string, { color: string; sec: number }> = {};
  for (const x of inRange) {
    subjMap[x.subject] ||= { color: x.color, sec: 0 };
    subjMap[x.subject].sec += x.sec;
  }
  const subjects = Object.entries(subjMap).sort((a, b) => b[1].sec - a[1].sec);
  const maxFocus = inRange.reduce((a, s) => Math.max(a, s.sec), 0);
  let prevKeys: string[];
  if (range === 'month') {
    const ps = addMonths(startOfMonth(anchor), -1);
    const pn = new Date(ps.getFullYear(), ps.getMonth() + 1, 0).getDate();
    prevKeys = Array.from({ length: pn }, (_, i) => ymd(addDays(ps, i)));
  } else prevKeys = keys.map((k) => ymd(addDays(new Date(k + 'T00:00:00'), -keys.length)));
  const prevTotal = prevKeys.reduce((a, k) => a + daySec(k), 0);
  const diff = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return (
    <Screen title="공부 리포트" accent={t.section.support}>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'day', label: '일간' },
          { value: 'week', label: '주간' },
          { value: 'month', label: '월간' },
        ]}
      />
      <Row style={{ marginVertical: 10 }}>
        <IconBtn name="chevron-back" onPress={() => shift(-1)} />
        <Pressable onPress={() => setAnchor(new Date())} style={{ flex: 1 }}>
          <T weight="800" center>
            {title}
          </T>
        </Pressable>
        <IconBtn name="chevron-forward" onPress={() => shift(1)} />
      </Row>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <T size={12} sub>
              총 공부 시간
            </T>
            <Text style={{ fontSize: 30, fontWeight: '900', color: t.text, fontVariant: ['tabular-nums'] }}>{fmtClock(total)}</Text>
          </View>
          {diff !== null && range !== 'day' && (
            <T weight="800" color={diff >= 0 ? t.success : t.danger}>
              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}%
            </T>
          )}
        </Row>
        <Row style={{ marginTop: 10 }} gap={18}>
          {range !== 'day' && <Stat label="하루 평균" value={fmtShortDur(total / Math.max(1, keys.filter((k) => k <= ymd()).length))} />}
          {range !== 'day' && <Stat label="공부한 날" value={`${studied}일`} />}
          <Stat label="최장 집중" value={fmtShortDur(maxFocus)} />
          {range === 'day' && <Stat label="목표 달성" value={`${Math.round((total / 60 / Math.max(1, settings.dailyGoalMin)) * 100)}%`} />}
        </Row>
      </Card>

      {range === 'day' && (
        <>
          <SectionTitle title="타임라인" />
          <Card>
            <DayTimeline day={keys[0]} segments={(byDay[keys[0]] || []).map((s) => ({ start: s.start, end: s.end, color: s.color }))} />
          </Card>
        </>
      )}

      {range === 'week' && (
        <>
          <SectionTitle title="요일별" />
          <Card>
            <BarChart
              labels={days.map((d) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()])}
              series={subjects.map(([name, v]) => ({ color: v.color, values: keys.map((k) => (byDay[k] || []).filter((s) => s.subject === name).reduce((a, s) => a + s.sec, 0) / 3600) }))}
              format={(v) => `${v.toFixed(1)}h`}
              highlight={keys.indexOf(ymd())}
              goal={settings.dailyGoalMin / 60}
            />
          </Card>
        </>
      )}

      {range === 'month' && (
        <>
          <SectionTitle title="날짜별" />
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: (days[0].getDay() - settings.weekStartsOn + 7) % 7 }).map((_, i) => (
                <View key={'b' + i} style={{ width: `${100 / 7}%` }} />
              ))}
              {days.map((d) => {
                const k = ymd(d);
                const sec = daySec(k);
                const r = sec / 60 / Math.max(1, settings.dailyGoalMin);
                const lv = sec === 0 ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4;
                return (
                  <View key={k} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    <View style={{ borderRadius: 8, paddingVertical: 6, alignItems: 'center', backgroundColor: lv ? alpha(t.heat[lv], 0.9) : t.surface2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: lv >= 3 ? '#fff' : t.text }}>{d.getDate()}</Text>
                      <Text style={{ fontSize: 9, color: lv >= 3 ? '#fff' : t.textSub }}>{sec ? fmtShortDur(sec) : ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      <SectionTitle title="과목별" />
      <Card>
        {subjects.length === 0 ? (
          <T sub>기록이 없어요</T>
        ) : (
          subjects.map(([name, v]) => (
            <View key={name} style={{ marginBottom: 10 }}>
              <Row>
                <Dot color={v.color} />
                <T weight="700" style={{ flex: 1 }}>
                  {name}
                </T>
                <T size={12} sub>
                  {fmtShortDur(v.sec)} · {Math.round((v.sec / Math.max(1, total)) * 100)}%
                </T>
              </Row>
              <View style={{ marginTop: 5 }}>
                <ProgressBar value={v.sec / Math.max(1, subjects[0][1].sec)} color={v.color} />
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <T size={11} sub>
        {label}
      </T>
      <T weight="800">{value}</T>
    </View>
  );
}
