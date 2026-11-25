import React from 'react';
import { Screen, T } from '../../src/components/ui';
import { AmbientPanel } from '../../src/features/extra/AmbientPanel';

export default function SoundScreen() {
  return (
    <Screen title="공부 배경음" subtitle="여러 소리를 겹쳐서 틀 수 있어요" accent="#0EA5E9">
      <AmbientPanel />
      <T size={12} faint center style={{ marginTop: 12 }}>
        앱을 나가도 계속 재생돼요 · 타이머·공부 기록을 끝내면 자동으로 서서히 꺼져요
      </T>
    </Screen>
  );
}
