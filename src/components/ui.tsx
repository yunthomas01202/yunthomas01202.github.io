// 공통 UI 컴포넌트 모음
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { useTheme } from '../theme';
import { SUBJECT_COLORS, alpha, energyShade, readableOn } from '../lib/color';
import { ENERGY_LABEL, Energy } from '../lib/types';
import { addMonths, fmtKDate, fmtYM, parseYmd, startOfMonth, startOfWeek, ymd, addDays } from '../lib/date';

export type IconName = keyof typeof Ionicons.glyphMap;

export const haptic = (kind: 'light' | 'medium' | 'success' | 'warn' = 'light') => {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

/* ───────── 텍스트 ───────── */

export function T({
  children,
  size = 15,
  weight = '400',
  color,
  sub,
  faint,
  style,
  numberOfLines,
  center,
}: {
  children?: ReactNode;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  sub?: boolean;
  faint?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontSize: size, fontWeight: weight, color: color || (faint ? t.textFaint : sub ? t.textSub : t.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ───────── 화면 틀 ───────── */

export function Screen({
  title,
  subtitle,
  back = true,
  right,
  scroll = true,
  children,
  padded = true,
  accent,
  onBack,
  contentStyle,
  overlay,
}: {
  overlay?: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
  padded?: boolean;
  accent?: string;
  onBack?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { padding: 16 }, { paddingBottom: insets.bottom + 40 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { padding: 16 }, contentStyle]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {title !== undefined && (
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: t.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
            {back && (
              <IconBtn
                name="chevron-back"
                size={24}
                onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'))}
              />
            )}
            <View style={{ flex: 1, marginLeft: back ? 4 : 6 }}>
              <T size={21} weight="800" numberOfLines={1}>
                {accent ? <Text style={{ color: accent }}>● </Text> : null}
                {title}
              </T>
              {subtitle ? (
                <T size={13} sub numberOfLines={1}>
                  {subtitle}
                </T>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{right}</View>
          </View>
        </View>
      )}
      {body}
      {overlay}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  onLongPress,
  color,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: color || t.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: t.dark ? 1 : 0,
    borderColor: t.border,
    ...(t.shadow as ViewStyle),
  };
  if (!onPress && !onLongPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Row({
  children,
  gap = 8,
  style,
  wrap,
  center = true,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
  center?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', gap, alignItems: center ? 'center' : 'flex-start' },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function SectionTitle({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 }, style]}>
      <T size={17} weight="800" style={{ flex: 1 }}>
        {title}
      </T>
      {right}
    </View>
  );
}

/* ───────── 버튼 ───────── */

export function Btn({
  title,
  onPress,
  variant = 'primary',
  icon,
  small,
  disabled,
  color,
  loading,
  style,
  flex,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  color?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const t = useTheme();
  const main = color || (variant === 'danger' ? t.danger : t.primary);
  const bg =
    variant === 'primary' || variant === 'danger'
      ? main
      : variant === 'secondary'
        ? alpha(main, t.dark ? 0.22 : 0.12)
        : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? readableOn(main) : main;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 12 : 18,
          borderRadius: small ? 10 : 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: main,
        },
        flex && { flex: 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 15 : 18} color={fg} />
      ) : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  size = 22,
  color,
  bg,
  style,
  disabled,
  onLongPress,
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        {
          width: size + 18,
          height: size + 18,
          borderRadius: (size + 18) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg || 'transparent',
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color || t.text} />
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'add', color }: { onPress: () => void; icon?: IconName; color?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const c = color || t.primary;
  return (
    <Pressable
      onPress={() => {
        haptic('medium');
        onPress();
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: insets.bottom + 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: c,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.94 : 1 }],
        ...(t.shadow as object),
        shadowOpacity: 0.25,
        elevation: 6,
      })}
    >
      <Ionicons name={icon} size={30} color={readableOn(c)} />
    </Pressable>
  );
}

/* ───────── 칩/뱃지 ───────── */

export function Chip({
  label,
  selected,
  onPress,
  color,
  small,
  icon,
  onLongPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  small?: boolean;
  icon?: IconName;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const c = color || t.primary;
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={{
        paddingHorizontal: small ? 10 : 13,
        paddingVertical: small ? 5 : 8,
        borderRadius: 999,
        backgroundColor: selected ? c : t.surface2,
        borderWidth: 1,
        borderColor: selected ? c : t.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon && <Ionicons name={icon} size={small ? 12 : 14} color={selected ? readableOn(c) : t.textSub} />}
      <Text style={{ color: selected ? readableOn(c) : t.textSub, fontWeight: '600', fontSize: small ? 12 : 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: solid ? color : alpha(color, 0.15),
      }}
    >
      <Text style={{ color: solid ? readableOn(color) : color, fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function EnergyBolts({ energy, color, size = 11 }: { energy: number; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name="flash" size={size} color={i <= energy ? color || '#F5A623' : t.border} />
      ))}
    </View>
  );
}

/* ───────── 입력 ───────── */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoFocus,
  style,
  inputStyle,
  onSubmitEditing,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'url' | 'email-address';
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  onSubmitEditing?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? (
        <T size={13} weight="700" sub style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        autoCapitalize="none"
        onSubmitEditing={onSubmitEditing}
        style={[
          {
            backgroundColor: t.surface2,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : Platform.OS === 'ios' ? 13 : 9,
            fontSize: 15,
            color: t.text,
            minHeight: multiline ? 90 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

export function Label({ children }: { children: string }) {
  return (
    <T size={13} weight="700" sub style={{ marginBottom: 8, marginTop: 4 }}>
      {children}
    </T>
  );
}

export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 12, padding: 3 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              haptic();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 7,
              paddingHorizontal: 8,
              borderRadius: 9,
              alignItems: 'center',
              backgroundColor: on ? t.surface : 'transparent',
              ...(on ? (t.shadow as object) : {}),
            }}
          >
            <Text style={{ fontWeight: on ? '800' : '600', color: on ? t.text : t.textSub, fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <T weight="600">{label}</T>
        {desc ? (
          <T size={12} sub style={{ marginTop: 2 }}>
            {desc}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary }} />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: 12 }}>
      <IconBtn name="remove" size={18} onPress={() => onChange(Math.max(min, value - step))} />
      <T weight="800" style={{ minWidth: 70, textAlign: 'center' }}>
        {format ? format(value) : value}
      </T>
      <IconBtn name="add" size={18} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {SUBJECT_COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => {
            haptic();
            onChange(c);
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: value === c ? 3 : 0,
            borderColor: t.text,
          }}
        >
          {value === c && <Ionicons name="checkmark" size={18} color="#fff" />}
        </Pressable>
      ))}
    </View>
  );
}

/** 에너지 코스트 5단계 선택 (과목 색의 짙기로 표현) */
export function EnergyPicker({ value, onChange, color }: { value: Energy; onChange: (e: Energy) => void; color: string }) {
  const t = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {([1, 2, 3, 4, 5] as Energy[]).map((e) => {
          const bg = energyShade(color, e);
          const on = e === value;
          return (
            <Pressable
              key={e}
              onPress={() => {
                haptic();
                onChange(e);
              }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: on ? 3 : 0,
                borderColor: t.text,
              }}
            >
              <Text style={{ color: readableOn(bg), fontWeight: '900' }}>⚡{e}</Text>
            </Pressable>
          );
        })}
      </View>
      <T size={12} sub style={{ marginTop: 6 }}>
        피로도: {ENERGY_LABEL[value]}
      </T>
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surface2, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: '100%',
          backgroundColor: color || t.primary,
          borderRadius: height,
        }}
      />
    </View>
  );
}

export function Empty({
  icon = 'leaf-outline',
  title,
  desc,
  action,
}: {
  icon?: IconName;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 8 }}>
      <Ionicons name={icon} size={40} color={t.textFaint} />
      <T weight="700" center>
        {title}
      </T>
      {desc ? (
        <T size={13} sub center>
          {desc}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  style,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: pressed ? t.surface2 : t.surface,
          borderRadius: 14,
          marginBottom: 8,
        },
        style,
      ]}
    >
      {left}
      <View style={{ flex: 1 }}>
        <T weight="600" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={12} sub numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/* ───────── 바텀 시트 ───────── */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  full,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,10,20,0.45)' }} onPress={onClose} />
        <View
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: full ? '94%' : '86%',
            minHeight: full ? '70%' : undefined,
            paddingBottom: insets.bottom + 8,
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.border }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 }}>
              <T size={19} weight="800" style={{ flex: 1 }}>
                {title}
              </T>
              <IconBtn name="close" onPress={onClose} />
            </View>
          ) : null}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 18, paddingTop: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ───────── 달력 선택기 ───────── */

export function MiniCalendar({
  value,
  onChange,
  marks,
  weekStartsOn = 1,
}: {
  value: string | null;
  onChange: (d: string) => void;
  marks?: Record<string, string>;
  weekStartsOn?: 0 | 1;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(value ? parseYmd(value) : new Date()));
  const days = useMemo(() => {
    const start = startOfWeek(month, weekStartsOn);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month, weekStartsOn]);
  const heads = weekStartsOn === 1 ? ['월', '화', '수', '목', '금', '토', '일'] : ['일', '월', '화', '수', '목', '금', '토'];
  const today = ymd();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <IconBtn name="chevron-back" size={20} onPress={() => setMonth(addMonths(month, -1))} />
        <T weight="800" style={{ flex: 1, textAlign: 'center' }}>
          {fmtYM(month)}
        </T>
        <IconBtn name="chevron-forward" size={20} onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {heads.map((h) => (
          <T key={h} size={12} sub style={{ flex: 1, textAlign: 'center' }}>
            {h}
          </T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {days.map((d) => {
          const k = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const sel = k === value;
          return (
            <Pressable
              key={k}
              onPress={() => {
                haptic();
                onChange(k);
              }}
              style={{ width: `${100 / 7}%`, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: sel ? t.primary : 'transparent',
                  borderWidth: k === today && !sel ? 1.5 : 0,
                  borderColor: t.primary,
                }}
              >
                <Text style={{ color: sel ? '#fff' : inMonth ? t.text : t.textFaint, fontWeight: sel ? '800' : '500' }}>
                  {d.getDate()}
                </Text>
              </View>
              {marks?.[k] ? (
                <View style={{ position: 'absolute', bottom: 2 }}>
                  <Dot color={marks[k]} size={5} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  allowClear,
  placeholder = '날짜 선택',
}: {
  label?: string;
  value: string | null | undefined;
  onChange: (d: string | null) => void;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: t.surface2,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={t.textSub} />
        <T style={{ flex: 1 }} color={value ? t.text : t.textFaint}>
          {value ? fmtKDate(value) : placeholder}
        </T>
        {allowClear && value ? <IconBtn name="close-circle" size={18} color={t.textFaint} onPress={() => onChange(null)} /> : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || '날짜'}>
        <MiniCalendar
          value={value || null}
          onChange={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

/* ───────── 전역 오버레이: 토스트 / 액션시트 / 입력창 ───────── */

interface ActionItem {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface OverlayState {
  toast: { text: string; key: number; action?: { label: string; onPress: () => void } } | null;
  actions: { title?: string; items: ActionItem[] } | null;
  prompt: {
    title: string;
    value: string;
    placeholder?: string;
    okText?: string;
    resolve: (v: string | null) => void;
  } | null;
  confirm: {
    title: string;
    message?: string;
    okText: string;
    destructive?: boolean;
    resolve: (ok: boolean) => void;
  } | null;
}

const useOverlay = create<OverlayState>(() => ({ toast: null, actions: null, prompt: null, confirm: null }));

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(text: string, action?: { label: string; onPress: () => void }) {
  if (toastTimer) clearTimeout(toastTimer);
  useOverlay.setState({ toast: { text, key: Date.now(), action } });
  toastTimer = setTimeout(() => useOverlay.setState({ toast: null }), action ? 4200 : 2600);
}

export function showActions(title: string | undefined, items: ActionItem[]) {
  useOverlay.setState({ actions: { title, items } });
}

export function promptText(title: string, value = '', opts?: { placeholder?: string; okText?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    useOverlay.setState({ prompt: { title, value, placeholder: opts?.placeholder, okText: opts?.okText, resolve } });
  });
}

export function confirmAsk(
  title: string,
  message?: string,
  opts?: { okText?: string; destructive?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    useOverlay.setState({
      confirm: { title, message, okText: opts?.okText || '확인', destructive: opts?.destructive, resolve },
    });
  });
}

export function OverlayHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { toast: tst, actions, prompt, confirm } = useOverlay();
  const [text, setText] = useState('');
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prompt) setText(prompt.value);
  }, [prompt]);

  useEffect(() => {
    Animated.timing(fade, { toValue: tst ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [tst, fade]);

  const closePrompt = (v: string | null) => {
    prompt?.resolve(v);
    useOverlay.setState({ prompt: null });
  };
  const closeConfirm = (ok: boolean) => {
    confirm?.resolve(ok);
    useOverlay.setState({ confirm: null });
  };

  return (
    <>
      {tst && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 90,
            alignItems: 'center',
            opacity: fade,
          }}
        >
          <View
            style={{
              backgroundColor: t.dark ? '#ECEEF5' : '#1B1F2E',
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              maxWidth: 520,
            }}
          >
            <Text style={{ color: t.dark ? '#111' : '#fff', fontWeight: '600', flexShrink: 1 }}>{tst.text}</Text>
            {tst.action && (
              <Pressable
                onPress={() => {
                  tst.action?.onPress();
                  useOverlay.setState({ toast: null });
                }}
              >
                <Text style={{ color: '#8B85FF', fontWeight: '800' }}>{tst.action.label}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      <Sheet visible={!!actions} onClose={() => useOverlay.setState({ actions: null })} title={actions?.title}>
        {actions?.items.map((a, i) => (
          <Pressable
            key={i}
            onPress={() => {
              useOverlay.setState({ actions: null });
              setTimeout(a.onPress, 250);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 6,
              borderRadius: 12,
              backgroundColor: pressed ? t.surface2 : 'transparent',
            })}
          >
            {a.icon && <Ionicons name={a.icon} size={20} color={a.destructive ? t.danger : t.text} />}
            <T weight="600" color={a.destructive ? t.danger : undefined}>
              {a.label}
            </T>
          </Pressable>
        ))}
      </Sheet>

      <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={() => closePrompt(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
          <View style={[styles.dialog, { backgroundColor: t.surface }]}>
            <T size={17} weight="800" style={{ marginBottom: 12 }}>
              {prompt?.title}
            </T>
            <Field value={text} onChangeText={setText} placeholder={prompt?.placeholder} autoFocus onSubmitEditing={() => closePrompt(text)} />
            <Row>
              <Btn title="취소" variant="secondary" flex onPress={() => closePrompt(null)} />
              <Btn title={prompt?.okText || '확인'} flex onPress={() => closePrompt(text)} />
            </Row>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => closeConfirm(false)}>
        <View style={styles.center}>
          <View style={[styles.dialog, { backgroundColor: t.surface }]}>
            <T size={17} weight="800">
              {confirm?.title}
            </T>
            {confirm?.message ? (
              <T sub style={{ marginTop: 8 }}>
                {confirm.message}
              </T>
            ) : null}
            <Row style={{ marginTop: 18 }}>
              <Btn title="취소" variant="secondary" flex onPress={() => closeConfirm(false)} />
              <Btn
                title={confirm?.okText || '확인'}
                variant={confirm?.destructive ? 'danger' : 'primary'}
                flex
                onPress={() => closeConfirm(true)}
              />
            </Row>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: 'rgba(8,10,20,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 20 },
});
