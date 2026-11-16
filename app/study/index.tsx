// 학습 부문: 폴더 · PDF · 노트 관리
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../src/theme';
import { add, batch, deleteInk, getState, newId, remove, update, useData, useList } from '../../src/lib/store';
import { connectDrive, deleteLocal, deleteRemote, importToLocal, isDriveAuthError, renameRemote, uploadFile } from '../../src/lib/files';
import type { FileKind, PaperTemplate, StudyFile } from '../../src/lib/types';
import { Badge, Card, Empty, Fab, Field, IconBtn, Row, Screen, SectionTitle, T, confirmAsk, promptText, showActions, toast } from '../../src/components/ui';
import { alpha } from '../../src/lib/color';
import { fmtKDate, ymd } from '../../src/lib/date';

const KIND: Record<FileKind, { label: string; icon: any; color: string }> = {
  pdf: { label: 'PDF', icon: 'document-text', color: '#E5484D' },
  blank: { label: '노트', icon: 'create', color: '#0090FF' },
  recall: { label: '백지 복습', icon: 'refresh-circle', color: '#30A46C' },
  cornell: { label: '코넬 노트', icon: 'grid', color: '#8E4EC6' },
};

export default function Library() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { folder } = useLocalSearchParams<{ folder?: string }>();
  const cur = folder || null;
  const folders = useList('folders');
  const files = useList('files');
  const cards = useList('cards');
  const apps = useList('apps');
  const foldersMap = useData((s) => s.folders);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const subFolders = useMemo(() => folders.filter((f) => f.parentId === cur).sort((a, b) => a.name.localeCompare(b.name)), [folders, cur]);
  const list = useMemo(() => {
    const base = q.trim() ? files.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : files.filter((f) => f.folderId === cur);
    return base.sort((a, b) => (b.lastOpenedAt || b.updatedAt || b.createdAt) - (a.lastOpenedAt || a.updatedAt || a.createdAt));
  }, [files, cur, q]);
  const dueCards = cards.filter((c) => c.srs.due <= Date.now()).length;
  const recallDue = files.filter((f) => f.kind === 'recall' && f.nextReview && f.nextReview <= ymd());
  const path: { id: string; name: string }[] = [];
  let p = cur ? foldersMap[cur] : undefined;
  let guard = 0;
  while (p && guard++ < 20) {
    path.unshift({ id: p.id, name: p.name });
    p = p.parentId ? foldersMap[p.parentId] : undefined;
  }
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const tileW = (Math.min(width, 1200) - 32 - (cols - 1) * 10) / cols;

  const importPdf = async () => {
    const res: any = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: true });
    if (res.canceled) return;
    setBusy(true);
    try {
      for (const a of res.assets) {
        const id = newId();
        const local = await importToLocal(a.uri, id, 'pdf');
        const name = (a.name || 'PDF').replace(/\.pdf$/i, '');
        add('files', { id, folderId: cur, name, kind: 'pdf', size: a.size, pendingUpload: true, driveId: null });
        uploadFile(local, name, 'pdf')
          .then((driveId) => update('files', id, { driveId, pendingUpload: false }))
          .catch((e) =>
            isDriveAuthError(e)
              ? toast('드라이브에 올리려면 연결이 필요해요 (이 기기엔 저장됨)', { label: '연결', onPress: () => connectDrive() })
              : toast('드라이브 업로드는 나중에 다시 시도해요: ' + (e?.message || e)),
          );
      }
      toast(`${res.assets.length}개 PDF를 가져왔어요`);
    } catch (e: any) {
      toast('가져오기 실패: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const createNote = async (kind: FileKind) => {
    const def = kind === 'recall' ? '백지 복습' : kind === 'cornell' ? '코넬 노트' : '새 노트';
    const name = await promptText(`${KIND[kind].label} 이름`, def);
    if (!name?.trim()) return;
    const make = (template: PaperTemplate) => {
      const id = add('files', { folderId: cur, name: name.trim(), kind, template, pageCount: 1 });
      router.push(`/study/file/${id}`);
    };
    if (kind === 'cornell') return make('blank');
    if (kind === 'recall') return make('lined');
    showActions('종이 모양', [
      { label: '줄 노트', icon: 'reorder-four-outline', onPress: () => make('lined') },
      { label: '모눈', icon: 'grid-outline', onPress: () => make('grid') },
      { label: '점', icon: 'ellipsis-horizontal', onPress: () => make('dot') },
      { label: '무지', icon: 'square-outline', onPress: () => make('blank') },
    ]);
  };

  const createFolder = async () => {
    const name = await promptText('새 폴더', '', { placeholder: '예: 생명과학' });
    if (name?.trim()) add('folders', { name: name.trim(), parentId: cur });
  };

  const moveTo = (apply: (folderId: string | null) => void, exclude?: string) => {
    const opts = [{ id: null as string | null, name: '맨 위 (학습)' }, ...folders.filter((f) => f.id !== exclude).map((f) => ({ id: f.id as string | null, name: f.name }))];
    showActions(
      '어디로 옮길까요?',
      opts.map((o) => ({ label: o.name, icon: 'folder-outline' as const, onPress: () => apply(o.id) })),
    );
  };

  const deleteFile = async (f: StudyFile) => {
    if (!(await confirmAsk(`'${f.name}'을(를) 삭제할까요?`, '필기와 함께 지워지며 되돌릴 수 없어요.', { destructive: true, okText: '삭제' }))) return;
    remove('files', f.id);
    deleteInk(f.id);
    if (f.kind === 'pdf') {
      deleteLocal(f.id, 'pdf');
      deleteRemote(f.driveId);
    }
  };

  const fileMenu = (f: StudyFile) =>
    showActions(f.name, [
      {
        label: '이름 바꾸기',
        icon: 'pencil',
        onPress: async () => {
          const n = await promptText('이름 바꾸기', f.name);
          if (n?.trim()) {
            update('files', f.id, { name: n.trim() });
            if (f.kind === 'pdf') renameRemote(f.driveId, n.trim(), 'pdf');
          }
        },
      },
      { label: '다른 폴더로 옮기기', icon: 'folder-open-outline', onPress: () => moveTo((fid) => update('files', f.id, { folderId: fid })) },
      ...(f.kind === 'pdf'
        ? [
            {
              label: '이 PDF로 백지 복습 만들기',
              icon: 'refresh-circle-outline' as const,
              onPress: () => {
                const id = add('files', { folderId: f.folderId, name: `${f.name} 백지 복습`, kind: 'recall', template: 'lined', pageCount: 1, sourceFileId: f.id, sourceStartPage: 1 });
                router.push(`/study/file/${id}`);
              },
            },
          ]
        : []),
      { label: '삭제', icon: 'trash-outline', destructive: true, onPress: () => deleteFile(f) },
    ]);

  const folderMenu = (fid: string, name: string) =>
    showActions(name, [
      {
        label: '이름 바꾸기',
        icon: 'pencil',
        onPress: async () => {
          const n = await promptText('폴더 이름', name);
          if (n?.trim()) update('folders', fid, { name: n.trim() });
        },
      },
      { label: '옮기기', icon: 'folder-open-outline', onPress: () => moveTo((pid) => update('folders', fid, { parentId: pid }), fid) },
      {
        label: '폴더 삭제 (안의 파일은 위로 이동)',
        icon: 'trash-outline',
        destructive: true,
        onPress: async () => {
          if (!(await confirmAsk(`'${name}' 폴더를 삭제할까요?`, '안에 있던 파일과 폴더는 한 단계 위로 옮겨져요.', { destructive: true, okText: '삭제' }))) return;
          const s = getState();
          const parent = s.folders[fid]?.parentId ?? null;
          batch([
            ...Object.values(s.files).filter((f) => f.folderId === fid).map((f) => ({ op: 'update' as const, c: 'files' as const, id: f.id, data: { folderId: parent } })),
            ...Object.values(s.folders).filter((f) => f.parentId === fid).map((f) => ({ op: 'update' as const, c: 'folders' as const, id: f.id, data: { parentId: parent } })),
            { op: 'remove', c: 'folders', id: fid },
          ]);
        },
      },
    ]);

  return (
    <Screen
      title={cur ? path[path.length - 1]?.name || '폴더' : '학습'}
      subtitle={cur ? ['학습', ...path.map((x) => x.name)].join(' › ') : undefined}
      accent={t.section.study}
      right={<IconBtn name="folder-outline" onPress={createFolder} />}
      overlay={
        <Fab
          color={t.section.study}
          icon={busy ? 'hourglass' : 'add'}
          onPress={() =>
            showActions('새로 만들기', [
              { label: 'PDF 가져오기', icon: 'cloud-upload-outline', onPress: importPdf },
              { label: '빈 노트', icon: 'create-outline', onPress: () => createNote('blank') },
              { label: '백지 복습 (Active Recall)', icon: 'refresh-circle-outline', onPress: () => createNote('recall') },
              { label: '코넬 노트', icon: 'grid-outline', onPress: () => createNote('cornell') },
              { label: '새 폴더', icon: 'folder-outline', onPress: createFolder },
            ])
          }
        />
      }
    >
      {!cur && (
        <>
          <Row gap={10}>
            <Card onPress={() => router.push('/study/decks')} style={{ flex: 1 }} color={alpha(t.section.study, t.dark ? 0.25 : 0.1)}>
              <Ionicons name="albums" size={24} color={t.section.study} />
              <T weight="800" style={{ marginTop: 8 }}>
                암기 덱
              </T>
              <T size={12} sub>
                {dueCards ? `오늘 복습 ${dueCards}장` : `카드 ${cards.length}장`}
              </T>
            </Card>
            <Card onPress={() => router.push('/study/apps')} style={{ flex: 1 }} color={alpha('#12A594', t.dark ? 0.25 : 0.1)}>
              <Ionicons name="apps" size={24} color="#12A594" />
              <T weight="800" style={{ marginTop: 8 }}>
                학습 앱
              </T>
              <T size={12} sub>
                {apps.length ? `${apps.length}개` : '클로드 아티팩트 추가'}
              </T>
            </Card>
          </Row>
          {recallDue.length > 0 && (
            <>
              <SectionTitle title="오늘 다시 백지 복습할 것" />
              {recallDue.map((f) => (
                <FileRow key={f.id} f={f} onPress={() => router.push(`/study/file/${f.id}`)} onLong={() => fileMenu(f)} badge="복습일" />
              ))}
            </>
          )}
        </>
      )}

      <Field value={q} onChangeText={setQ} placeholder="파일 이름 검색" style={{ marginTop: 14, marginBottom: 6 }} />

      {!q && subFolders.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          {subFolders.map((f) => {
            const n = files.filter((x) => x.folderId === f.id).length;
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/study?folder=${f.id}`)}
                onLongPress={() => folderMenu(f.id, f.name)}
                style={({ pressed }) => ({
                  width: tileW,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: pressed ? t.surface2 : t.surface,
                })}
              >
                <Ionicons name="folder" size={28} color="#FFB224" />
                <View style={{ flex: 1 }}>
                  <T weight="700" numberOfLines={1}>
                    {f.name}
                  </T>
                  <T size={11} faint>
                    {n}개
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionTitle title={q ? `검색 결과 ${list.length}` : '파일'} />
      {list.length === 0 ? (
        <Empty icon="documents-outline" title={q ? '찾는 파일이 없어요' : '아직 파일이 없어요'} desc="+ 버튼으로 PDF를 가져오거나 노트를 만들어 보세요" />
      ) : (
        list.map((f) => <FileRow key={f.id} f={f} onPress={() => router.push(`/study/file/${f.id}`)} onLong={() => fileMenu(f)} />)
      )}
      <View style={{ height: 90 }} />
    </Screen>
  );
}

function FileRow({ f, onPress, onLong, badge }: { f: StudyFile; onPress: () => void; onLong: () => void; badge?: string }) {
  const t = useTheme();
  const k = KIND[f.kind];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLong}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: pressed ? t.surface2 : t.surface,
        marginBottom: 8,
      })}
    >
      <View style={{ width: 44, height: 54, borderRadius: 8, backgroundColor: alpha(k.color, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={k.icon} size={24} color={k.color} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="700" numberOfLines={1}>
          {f.name}
        </T>
        <T size={12} sub numberOfLines={1}>
          {k.label}
          {f.pageCount ? ` · ${f.pageCount}쪽` : ''} · {fmtKDate(f.lastOpenedAt || f.updatedAt || f.createdAt, false)}
          {f.kind === 'pdf' && !f.driveId ? ' · 드라이브 업로드 대기' : ''}
        </T>
      </View>
      {badge ? <Badge label={badge} color={t.success} /> : null}
      <IconBtn name="ellipsis-horizontal" size={18} color={t.textFaint} onPress={onLong} />
    </Pressable>
  );
}
