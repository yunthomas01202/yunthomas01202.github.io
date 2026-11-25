// 키보드 단축키 도움말 (? 키)
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../theme';
import { HOTKEY_GROUPS, closeHotkeyHelp, useHelp } from '../lib/hotkeys';
import { Sheet, T } from './ui';

export function HotkeyHelp() {
  const t = useTheme();
  const open = useHelp((s) => s.open);

  useEffect(() => {
    if (!open || Platform.OS !== 'web') return undefined;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHotkeyHelp();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  return (
    <Sheet visible={open} onClose={closeHotkeyHelp} title="키보드 단축키">
      <T size={12} sub style={{ marginBottom: 10 }}>
        글자를 입력하는 칸에서는 동작하지 않아요. 설정 › 알림 · 필기 · 화면에서 끌 수 있어요.
      </T>
      {HOTKEY_GROUPS.map((g) => (
        <View key={g.title} style={{ marginBottom: 14 }}>
          <T weight="800" size={14} style={{ marginBottom: 6 }}>
            {g.title}
          </T>
          {g.keys.map(([k, d]) => (
            <View key={k + d} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 10 }}>
              <View style={{ minWidth: 110, alignItems: 'flex-start' }}>
                <View style={{ backgroundColor: t.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: t.border }}>
                  <T size={12} weight="800">
                    {k}
                  </T>
                </View>
              </View>
              <T size={13} style={{ flex: 1 }}>
                {d}
              </T>
            </View>
          ))}
        </View>
      ))}
    </Sheet>
  );
}
