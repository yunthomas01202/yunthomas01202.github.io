// 일반 일정 화면 조각: 편집기 · 목록(관리) · 학교 시간표 만들기
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { alpha } from '../../lib/color';
import { remove, update, useData, useList } from '../../lib/store';
import type { Schedule } from '../../lib/types';
import { addMonths, fmtKDate, fmtMinOfDay, ymd } from '../../lib/date';
import {
  Btn,
  Card,
  Chip,
  ColorPicker,
  DateField,
  Empty,
  Field,
  Label,
  Row,
  Segmented,
  Sheet,
  Stepper,
  T,
  ToggleRow,
  confirmAsk,
  promptText,
  showActions,
  toast,
} from '../../components/ui';
import {
  SCHED_COLOR,
  SchoolCfg,
  WEEKDAY,
  addSchedule,
  buildSchool,
  createSchool,
  describeRepeat,
  durLabel,
  groupsOf,
  removeGroup,
  skipGroupOn,
  skipOnce,
} from './schedules';

/** 월~일 순서 (한국 학교 기준) */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 'HH:MM' 또는 'HHMM' → 분 */
function parseHM(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})\s*[:시.]?\s*(\d{2})?\s*분?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] || 0);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

/** 시각 고르기: 5분 단위 ± 와 직접 입력 */
export function TimeRow({ label, value, onChange, min = 0, max = 24 * 60 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const t = useTheme();
  return (
    <Row style={{ marginBottom: 8 }}>
      <T weight="700" style={{ width: 64 }}>
        {label}
      </T>
      <Stepper value={value} onChange={onChange} step={5} min={min} max={max} format={fmtMinOfDay} />
      <Pressable
        hitSlop={8}
        onPress={async () => {
          const v = await promptText(`${label} 시각`, fmtMinOfDay(value), { placeholder: '예: 08:40', okText: '확인' });
          if (v == null) return;
          const m = parseHM(v);
          if (m == null || m < min || m > max) return toast('08:40 처럼 입력해주세요');
          onChange(m);
        }}
        style={{ marginLeft: 10 }}
      >
        <T size={12} color={t.primary} weight="700">
          직접 입력
        </T>
      </Pressable>
    </Row>
  );
}

function DayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <Row wrap style={{ marginBottom: 14 }}>
      {DAY_ORDER.map((d) => (
        <Chip
          key={d}
          small
          label={WEEKDAY[d]}
          selected={value.includes(d)}
          onPress={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}
        />
      ))}
    </Row>
  );
}

/* ───────────────────────── 일정 하나 편집 ───────────────────────── */

export interface ScheduleDraft {
  date: string;
  startMin: number;
  endMin: number;
  /** 매주 반복(평일)으로 시작 — 기본 일정 추가용 */
  weekly?: boolean;
}

export function ScheduleEditor({
  visible,
  schedule,
  draft,
  onClose,
}: {
  visible: boolean;
  schedule: Schedule | null;
  draft?: ScheduleDraft | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<'once' | 'weekly'>('once');
  const [date, setDate] = useState(ymd());
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [sMin, setSMin] = useState(9 * 60);
  const [eMin, setEMin] = useState(9 * 60 + 30);
  const [color, setColor] = useState(SCHED_COLOR);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    const s = schedule;
    setTitle(s?.title || '');
    setRepeat(s?.repeat || (draft?.weekly ? 'weekly' : 'once'));
    const d = s?.date || draft?.date || ymd();
    setDate(d);
    setDays(s?.days?.length ? s.days : !s && draft?.weekly ? [1, 2, 3, 4, 5] : [new Date(d + 'T00:00:00').getDay()]);
    setFrom(s?.from ?? null);
    setTo(s?.to ?? null);
    setSMin(s?.startMin ?? draft?.startMin ?? 9 * 60);
    setEMin(s?.endMin ?? draft?.endMin ?? 9 * 60 + 30);
    setColor(s?.color || SCHED_COLOR);
    setBusy(s?.busy !== false);
    setNote(s?.note || '');
  }, [visible, schedule, draft]);

  const save = () => {
    if (!title.trim()) return;
    if (repeat === 'weekly' && !days.length) return toast('요일을 하나 이상 골라주세요');
    const data = {
      title: title.trim(),
      color,
      startMin: sMin,
      endMin: Math.max(eMin, sMin + 5),
      repeat,
      date: repeat === 'once' ? date : null,
      days: repeat === 'weekly' ? [...days].sort() : [],
      from: repeat === 'weekly' ? from : null,
      to: repeat === 'weekly' ? to : null,
      busy,
      note: note.trim(),
    };
    if (schedule) update('schedules', schedule.id, data);
    else addSchedule({ ...data, skip: [], group: null });
    toast(schedule ? '일정을 고쳤어요' : `'${data.title}' 일정을 넣었어요`);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={schedule ? '일정 고치기' : '일반 일정 추가'}
      footer={
        <Row>
          {schedule && (
            <Btn
              title="삭제"
              variant="danger"
              onPress={async () => {
                const ok = await confirmAsk(
                  `'${schedule.title}' 일정을 지울까요?`,
                  schedule.repeat === 'weekly' ? '반복되는 모든 날짜에서 사라져요' : undefined,
                  { okText: '삭제', destructive: true },
                );
                if (!ok) return;
                remove('schedules', schedule.id);
                onClose();
              }}
            />
          )}
          <Btn title="저장" flex onPress={save} disabled={!title.trim()} />
        </Row>
      }
    >
      <Field label="일정 이름" value={title} onChangeText={setTitle} placeholder="예: 학원, 동아리, 종례, 병원" autoFocus={!schedule} />
      <Row wrap style={{ marginBottom: 14, marginTop: -4 }}>
        {['학원', '과외', '동아리', '보충수업', '야자', '식사', '운동', '이동'].map((x) => (
          <Chip key={x} small label={x} selected={title === x} onPress={() => setTitle(x)} />
        ))}
      </Row>
      <Label>반복</Label>
      <Segmented
        options={[
          { value: 'once', label: '이 날 한 번' },
          { value: 'weekly', label: '매주 반복' },
        ]}
        value={repeat}
        onChange={setRepeat}
        style={{ marginBottom: 14 }}
      />
      {repeat === 'once' ? (
        <DateField label="날짜" value={date} onChange={(v) => v && setDate(v)} />
      ) : (
        <>
          <Label>요일</Label>
          <DayChips value={days} onChange={setDays} />
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <DateField label="시작일 (선택)" value={from} onChange={setFrom} allowClear placeholder="제한 없음" />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="종료일 (선택)" value={to} onChange={setTo} allowClear placeholder="제한 없음" />
            </View>
          </Row>
        </>
      )}
      <Label>시간</Label>
      <TimeRow label="시작" value={sMin} onChange={(v) => { setSMin(v); if (eMin <= v) setEMin(Math.min(24 * 60, v + 30)); }} max={23 * 60 + 55} />
      <TimeRow label="끝" value={eMin} onChange={setEMin} min={5} />
      <ToggleRow label="공부 시간에서 빼기" desc="자동 배치·빈 칸 찾기가 이 시간을 피해요" value={busy} onChange={setBusy} />
      <Label>색</Label>
      <ColorPicker value={color} onChange={setColor} />
      <View style={{ height: 12 }} />
      <Field label="메모 (선택)" value={note} onChangeText={setNote} placeholder="장소, 준비물 등" />
    </Sheet>
  );
}

/* ───────────────────────── 캘린더에서 일정을 눌렀을 때 ───────────────────────── */

export function openScheduleActions(s: Schedule, day: string, onEdit: (s: Schedule) => void) {
  const items: { label: string; icon?: any; destructive?: boolean; onPress: () => void }[] = [{ label: '고치기', icon: 'create-outline', onPress: () => onEdit(s) }];
  if (s.repeat === 'weekly') {
    items.push({
      label: `${fmtKDate(day, false)}만 빼기`,
      icon: 'remove-circle-outline',
      onPress: () => {
        skipOnce(s.id, day);
        toast('이 날만 뺐어요');
      },
    });
  }
  if (s.group) {
    const name = s.group.split(':')[1] || '묶음';
    items.push({
      label: `${fmtKDate(day, false)} '${name}' 전부 빼기 (휴일·시험)`,
      icon: 'calendar-clear-outline',
      onPress: () => toast(`${skipGroupOn(s.group!, day)}개를 이 날에서 뺐어요`),
    });
  }
  items.push({
    label: '삭제',
    icon: 'trash-outline',
    destructive: true,
    onPress: async () => {
      const ok = await confirmAsk(`'${s.title}' 일정을 지울까요?`, s.repeat === 'weekly' ? '반복되는 모든 날짜에서 사라져요' : undefined, {
        okText: '삭제',
        destructive: true,
      });
      if (ok) remove('schedules', s.id);
    },
  });
  showActions(`${s.title} · ${durLabel(s)}`, items);
}

/* ───────────────────────── 일정 목록 (관리) ───────────────────────── */

export function ScheduleManager({
  visible,
  onClose,
  onAdd,
  onEdit,
  onSchool,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (s: Schedule) => void;
  onSchool: () => void;
}) {
  const t = useTheme();
  const list = useList('schedules');
  const groups = useMemo(() => groupsOf(list), [list]);
  const singles = useMemo(
    () =>
      list
        .filter((s) => !s.group && (s.repeat === 'weekly' || (s.date || '') >= ymd()))
        .sort((a, b) => (a.repeat === b.repeat ? (a.date || '').localeCompare(b.date || '') || a.startMin - b.startMin : a.repeat === 'weekly' ? -1 : 1)),
    [list],
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="일반 일정"
      full
      footer={
        <Row>
          <Btn title="학교 시간표" icon="school-outline" variant="secondary" flex onPress={onSchool} />
          <Btn title="일정 추가" icon="add" flex onPress={onAdd} />
        </Row>
      }
    >
      <T size={13} sub style={{ marginBottom: 12, lineHeight: 19 }}>
        수업·조회·종례·학원처럼 공부가 아닌 일정이에요. 캘린더에 회색 띠로 깔리고, 자동 배치는 이 시간을 피해요. 캘린더의 빈 칸을 탭해도
        바로 넣을 수 있어요.
      </T>

      {groups.map((g) => {
        const items = list.filter((s) => s.group === g.group).sort((a, b) => a.startMin - b.startMin);
        const first = items[0];
        return (
          <Card key={g.group} style={{ marginBottom: 10 }}>
            <Row>
              <Ionicons name="school" size={18} color={first?.color || t.textSub} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <T weight="800">{g.title}</T>
                <T size={12} sub>
                  {g.count}개 · {first ? describeRepeat({ ...first, days: [...new Set(items.flatMap((x) => x.days || []))] }) : ''}
                </T>
              </View>
              <Btn
                title="전부 삭제"
                small
                variant="ghost"
                onPress={async () => {
                  const ok = await confirmAsk(`'${g.title}'을(를) 전부 지울까요?`, `${g.count}개의 반복 일정이 사라져요`, { okText: '삭제', destructive: true });
                  if (ok) toast(`${removeGroup(g.group)}개를 지웠어요`);
                }}
              />
            </Row>
            <View style={{ marginTop: 8, gap: 2 }}>
              {items.map((s) => (
                <Pressable key={s.id} onPress={() => onEdit(s)} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                  <T size={12} weight="700" style={{ width: 70 }}>
                    {s.title}
                  </T>
                  <T size={12} sub style={{ width: 90 }}>
                    {durLabel(s)}
                  </T>
                  <T size={12} faint style={{ flex: 1 }} numberOfLines={1}>
                    {(s.days || [])
                      .slice()
                      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
                      .map((d) => WEEKDAY[d])
                      .join('')}
                    {s.skip?.length ? ` · ${s.skip.length}일 뺌` : ''}
                  </T>
                </Pressable>
              ))}
            </View>
          </Card>
        );
      })}

      {singles.map((s) => (
        <Pressable key={s.id} onPress={() => onEdit(s)}>
          <Card style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: s.color, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <T weight="700">{s.title}</T>
              <T size={12} sub>
                {s.repeat === 'once' ? fmtKDate(s.date || ymd()) : describeRepeat(s)} · {durLabel(s)}
                {s.busy === false ? ' · 공부 가능' : ''}
              </T>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
          </Card>
        </Pressable>
      ))}

      {!groups.length && !singles.length && (
        <Empty icon="calendar-clear-outline" title="아직 일반 일정이 없어요" desc="학교 시간표부터 만들어 보세요. 교시·점심·종례가 한 번에 들어가요." />
      )}
    </Sheet>
  );
}

/* ───────────────────────── 학교 시간표 만들기 ───────────────────────── */

export function SchoolBuilder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const seasons = useData((s) => s.seasons);
  const [name, setName] = useState('학교 시간표');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [homeroom, setHomeroom] = useState(true);
  const [homeroomMin, setHomeroomMin] = useState(8 * 60 + 20);
  const [homeroomLen, setHomeroomLen] = useState(10);
  const [firstMin, setFirstMin] = useState(8 * 60 + 40);
  const [classLen, setClassLen] = useState(50);
  const [breakLen, setBreakLen] = useState(10);
  const [periods, setPeriods] = useState<Record<number, number>>({ 0: 7, 1: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 });
  const [lunchAfter, setLunchAfter] = useState(4);
  const [lunchLen, setLunchLen] = useState(50);
  const [closing, setClosing] = useState(true);
  const [closingLen, setClosingLen] = useState(10);
  const [closingGap, setClosingGap] = useState(0);
  const [from, setFrom] = useState<string | null>(ymd());
  const [to, setTo] = useState<string | null>(null);
  const [color, setColor] = useState(SCHED_COLOR);

  useEffect(() => {
    if (!visible) return;
    // 기본 종료일: 진행 중인 시즌 끝 또는 4개월 뒤
    const today = ymd();
    const active = Object.values(seasons).find((s) => !s.archived && s.startDate <= today && s.endDate >= today);
    setFrom(today);
    setTo(active?.endDate || ymd(addMonths(new Date(), 4)));
  }, [visible, seasons]);

  const cfg: SchoolCfg = {
    name: name.trim() || '학교 시간표',
    days,
    homeroomMin: homeroom ? homeroomMin : null,
    homeroomLen,
    firstMin,
    classLen,
    breakLen,
    periods,
    lunchAfter,
    lunchLen,
    closingLen: closing ? closingLen : 0,
    closingGap,
    from,
    to,
    color,
  };
  const preview = useMemo(() => buildSchool(cfg), [JSON.stringify(cfg)]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderedDays = DAY_ORDER.filter((d) => days.includes(d));
  const endOf = (d: number) => {
    const its = preview.filter((x) => x.days.includes(d));
    return its.length ? Math.max(...its.map((x) => x.endMin)) : null;
  };

  const make = () => {
    if (!days.length) return toast('요일을 골라주세요');
    const n = createSchool(cfg);
    toast(`${n}개의 반복 일정으로 '${cfg.name}'을(를) 만들었어요`);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="학교 시간표 만들기"
      full
      footer={<Btn title={`${preview.length}개 일정 만들기`} onPress={make} disabled={!days.length || !preview.length} />}
    >
      <Field label="이름" value={name} onChangeText={setName} placeholder="예: 2학기 시간표" />
      <Label>요일</Label>
      <DayChips value={days} onChange={setDays} />

      <ToggleRow label="조회" value={homeroom} onChange={setHomeroom} />
      {homeroom && (
        <>
          <TimeRow label="조회 시작" value={homeroomMin} onChange={setHomeroomMin} />
          <Row style={{ marginBottom: 8 }}>
            <T weight="700" style={{ width: 64 }}>
              길이
            </T>
            <Stepper value={homeroomLen} onChange={setHomeroomLen} step={5} min={5} max={60} format={(v) => `${v}분`} />
          </Row>
        </>
      )}

      <Label>수업</Label>
      <TimeRow label="1교시" value={firstMin} onChange={setFirstMin} />
      <Row style={{ marginBottom: 8 }}>
        <T weight="700" style={{ width: 64 }}>
          수업
        </T>
        <Stepper value={classLen} onChange={setClassLen} step={5} min={20} max={120} format={(v) => `${v}분`} />
      </Row>
      <Row style={{ marginBottom: 8 }}>
        <T weight="700" style={{ width: 64 }}>
          쉬는 시간
        </T>
        <Stepper value={breakLen} onChange={setBreakLen} step={5} min={0} max={30} format={(v) => `${v}분`} />
      </Row>

      <Label>요일별 교시 수</Label>
      <View style={{ marginBottom: 10 }}>
        {orderedDays.map((d) => (
          <Row key={d} style={{ marginBottom: 6 }}>
            <T weight="700" style={{ width: 64 }}>
              {WEEKDAY[d]}요일
            </T>
            <Stepper value={periods[d] ?? 7} onChange={(v) => setPeriods({ ...periods, [d]: v })} min={1} max={10} format={(v) => `${v}교시`} />
            <T size={12} faint style={{ marginLeft: 10 }}>
              {endOf(d) != null ? `${fmtMinOfDay(endOf(d)!)} 끝` : ''}
            </T>
          </Row>
        ))}
      </View>

      <Label>점심</Label>
      <Row style={{ marginBottom: 8 }}>
        <T weight="700" style={{ width: 64 }}>
          시작
        </T>
        <Stepper value={lunchAfter} onChange={setLunchAfter} min={1} max={9} format={(v) => `${v}교시 뒤`} />
      </Row>
      <Row style={{ marginBottom: 8 }}>
        <T weight="700" style={{ width: 64 }}>
          길이
        </T>
        <Stepper value={lunchLen} onChange={setLunchLen} step={5} min={0} max={120} format={(v) => `${v}분`} />
      </Row>

      <ToggleRow label="종례" desc="마지막 교시가 끝난 뒤" value={closing} onChange={setClosing} />
      {closing && (
        <>
          <Row style={{ marginBottom: 8 }}>
            <T weight="700" style={{ width: 64 }}>
              길이
            </T>
            <Stepper value={closingLen} onChange={setClosingLen} step={5} min={5} max={60} format={(v) => `${v}분`} />
          </Row>
          <Row style={{ marginBottom: 8 }}>
            <T weight="700" style={{ width: 64 }}>
              사이
            </T>
            <Stepper value={closingGap} onChange={setClosingGap} step={5} min={0} max={30} format={(v) => (v ? `${v}분 뒤` : '바로')} />
          </Row>
        </>
      )}

      <Row gap={10} style={{ marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <DateField label="적용 시작" value={from} onChange={setFrom} allowClear placeholder="제한 없음" />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="적용 끝 (방학 전날)" value={to} onChange={setTo} allowClear placeholder="제한 없음" />
        </View>
      </Row>
      <Label>색</Label>
      <ColorPicker value={color} onChange={setColor} />

      <View style={{ height: 14 }} />
      <Label>미리보기</Label>
      <Card>
        {preview.map((it) => (
          <View key={`${it.title}${it.startMin}${it.days.join()}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                marginRight: 8,
                backgroundColor: it.kind === 'class' ? color : it.kind === 'lunch' ? t.warn : alpha(color, 0.5),
              }}
            />
            <T size={13} weight="700" style={{ width: 70 }}>
              {it.title}
            </T>
            <T size={13} sub style={{ width: 100 }}>
              {fmtMinOfDay(it.startMin)}–{fmtMinOfDay(it.endMin)}
            </T>
            <T size={12} faint style={{ flex: 1 }}>
              {it.days.length === days.length ? '' : DAY_ORDER.filter((d) => it.days.includes(d)).map((d) => WEEKDAY[d]).join('')}
            </T>
          </View>
        ))}
        <T size={11} faint style={{ marginTop: 8 }}>
          만든 뒤 캘린더에서 교시를 눌러 시간을 고칠 수 있어요. 휴일·시험 날엔 교시를 눌러 '그 날 전부 빼기'를 쓰세요.
        </T>
      </Card>
      <View style={{ height: 8 }} />
      <T size={11} faint>
        {from ? `${fmtKDate(from, false)}부터` : '오늘부터'} {to ? `${fmtKDate(to, false)}까지` : '계속'} 매주 반복돼요
      </T>
    </Sheet>
  );
}
