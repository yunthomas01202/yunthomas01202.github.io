// 시즌 목록 (기간 선택)
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { update, useList } from '../../src/lib/store';
import { Badge, Card, Chip, Empty, Fab, ProgressBar, Row, Screen, T, showActions } from '../../src/components/ui';
import { SeasonEditor } from '../../src/features/planner/components';
import { nextExam } from '../../src/features/planner/logic';
import { SEASON_KIND_LABEL, Season } from '../../src/lib/types';
import { daysUntil, ddayLabel, fmtKDate, ymd } from '../../src/lib/date';

export default function Seasons() {
  const t = useTheme();
  const seasons = useList('seasons');
  const tasks = useList('tasks');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; season: Season | null }>({ open: false, season: null });
  const today = ymd();

  const list = useMemo(
    () =>
      seasons
        .filter((s) => !!s.archived === showArchived)
        .sort((a, b) => {
          const live = (s: Season) => (s.startDate <= today && s.endDate >= today ? 0 : s.startDate > today ? 1 : 2);
          return live(a) - live(b) || a.startDate.localeCompare(b.startDate);
        }),
    [seasons, showArchived, today],
  );

  return (
    <Screen
      title="시즌"
      subtitle="계획을 실행할 큰 단위를 고르세요"
      accent={t.section.plan}
      overlay={<Fab onPress={() => setEditor({ open: true, season: null })} color={t.section.plan} />}
    >
      <Row style={{ marginBottom: 12 }}>
        <Chip label="진행·예정" selected={!showArchived} onPress={() => setShowArchived(false)} />
        <Chip label="보관함" selected={showArchived} onPress={() => setShowArchived(true)} />
      </Row>
      {list.length === 0 && <Empty icon="layers-outline" title={showArchived ? '보관한 시즌이 없어요' : '시즌이 없어요'} desc="오른쪽 아래 + 버튼으로 추가하세요" />}
      {list.map((s) => {
        const st = tasks.filter((x) => x.seasonId === s.id && !x.starter);
        const done = st.filter((x) => x.status === 'done').length;
        const live = s.startDate <= today && s.endDate >= today;
        const exam = nextExam(s);
        return (
          <Card
            key={s.id}
            style={{ marginBottom: 10, borderWidth: live ? 2 : 0, borderColor: t.section.plan }}
            onPress={() => router.push(`/planner/season/${s.id}`)}
            onLongPress={() =>
              showActions(s.name, [
                { label: '수정', icon: 'create-outline', onPress: () => setEditor({ open: true, season: s }) },
                {
                  label: s.archived ? '보관 해제' : '보관하기',
                  icon: 'archive-outline',
                  onPress: () => update('seasons', s.id, { archived: !s.archived }),
                },
              ])
            }
          >
            <Row>
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  <Badge label={SEASON_KIND_LABEL[s.kind]} color={t.section.plan} />
                  {live && <Badge label="진행 중" color={t.success} solid />}
                </Row>
                <T size={18} weight="800" style={{ marginTop: 6 }}>
                  {s.name}
                </T>
                <T size={12} sub>
                  {fmtKDate(s.startDate)} ~ {fmtKDate(s.endDate)}
                </T>
              </View>
              {exam && (
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={20} weight="900" color={t.section.plan}>
                    {ddayLabel(daysUntil(exam.date))}
                  </T>
                  <T size={11} sub>
                    {exam.label}
                  </T>
                </View>
              )}
            </Row>
            <View style={{ marginTop: 12 }}>
              <ProgressBar value={st.length ? done / st.length : 0} color={t.section.plan} />
              <T size={11} sub style={{ marginTop: 4 }}>
                {done}/{st.length} 완료
              </T>
            </View>
          </Card>
        );
      })}
      <View style={{ height: 80 }} />
      <SeasonEditor visible={editor.open} season={editor.season} onClose={() => setEditor({ open: false, season: null })} />
    </Screen>
  );
}
