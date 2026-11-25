// ─────────────────────────────────────────────────────────────
// 앱 전체에서 쓰는 데이터 타입
// 날짜만 필요한 값은 'YYYY-MM-DD'(현지 시각) 문자열, 시각은 epoch ms 숫자
// ─────────────────────────────────────────────────────────────

export type ID = string;
export type Energy = 1 | 2 | 3 | 4 | 5;

export interface Base {
  id: ID;
  createdAt: number;
  updatedAt?: number;
}

/* ───────── 계획/스케줄 ───────── */

export type SeasonKind = 'exam' | 'vacation' | 'semester' | 'mock' | 'custom';

export interface ExamDate {
  id: string;
  label: string; // 예: "수학", "1일차"
  date: string; // YYYY-MM-DD
  subjectId?: string;
}

/** 시즌: 1학년 1학기 중간고사 / 겨울방학 같은 계획의 큰 단위 */
export interface Season extends Base {
  name: string;
  kind: SeasonKind;
  startDate: string;
  endDate: string;
  exams: ExamDate[];
  goal?: string;
  archived?: boolean;
}

export interface Subject extends Base {
  seasonId: ID;
  name: string;
  color: string;
  /** 헥사곤 스탯에서 이 과목이 쌓이는 축 이름 */
  statKey?: string;
  /** 하기 싫은(기피) 과목 → 5분 예열 블록을 추천 */
  reluctant?: boolean;
  order: number;
}

export type TaskKind = 'concept' | 'problem' | 'memorize' | 'review' | 'reading' | 'etc';
export type TaskStatus = 'todo' | 'done' | 'failed';

export interface Task extends Base {
  seasonId: ID;
  subjectId: ID;
  title: string;
  energy: Energy;
  estMin: number;
  places: string[]; // 장소 태그 id
  kind: TaskKind;
  note?: string;
  start?: number | null;
  end?: number | null;
  status: TaskStatus;
  doneAt?: number | null;
  missCount?: number;
  failReasons?: string[];
  /** 5분 예열 블록 */
  starter?: boolean;
  parentTaskId?: string | null;
}

/* ───────── 수행/세특 ───────── */

export interface PerfCategory extends Base {
  name: string;
  color: string;
  order: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface SetukRecord {
  motive: string; // 동기·계기
  process: string; // 탐구/활동 과정
  result: string; // 결과물
  learned: string; // 배운 점·느낀 점
  followup: string; // 후속 탐구
}

export interface PerfItem extends Base {
  categoryId: ID;
  title: string;
  color?: string | null;
  energy: Energy;
  estMin: number;
  dueDate?: string | null;
  note?: string;
  places: string[];
  checklist: ChecklistItem[];
  record: SetukRecord;
  status: 'todo' | 'doing' | 'done';
  order: number;
}

/** 수행 항목을 캘린더에 배치한 작업 블록 (항목 하나를 여러 번 배치 가능) */
export interface PerfBlock extends Base {
  itemId: ID;
  start: number;
  end: number;
  done: boolean;
}

/** 특정 날짜의 특이 이벤트 (예: 수학 수행평가 당일, 발표, 대회) */
export interface PerfEvent extends Base {
  title: string;
  date: string;
  startMin?: number | null; // 하루 중 분 (없으면 종일)
  endMin?: number | null;
  color: string;
  itemId?: string | null;
  note?: string;
}

/* ───────── 학습 ───────── */

export interface Folder extends Base {
  name: string;
  parentId: ID | null;
  color?: string;
}

export type FileKind = 'pdf' | 'blank' | 'recall' | 'cornell';
export type PaperTemplate = 'blank' | 'lined' | 'grid' | 'dot';

export interface StudyFile extends Base {
  folderId: ID | null;
  name: string;
  kind: FileKind;
  /** 내 구글 드라이브의 파일 id */
  driveId?: string | null;
  pendingUpload?: boolean;
  size?: number;
  pageCount?: number;
  lastPage?: number;
  template?: PaperTemplate;
  /** 백지 복습: 대조할 원본 PDF */
  sourceFileId?: string | null;
  sourceStartPage?: number;
  /** 코넬 노트/백지 복습의 구조 데이터 (엔진이 저장) */
  content?: any;
  /** 백지 복습 다음 복습일 */
  nextReview?: string | null;
  lastOpenedAt?: number;
}

export interface Deck extends Base {
  name: string;
  color: string;
}

export interface SrsState {
  due: number;
  interval: number; // 일
  ease: number;
  reps: number;
  lapses: number;
}

export interface Card extends Base {
  deckId: ID;
  front: string;
  back: string;
  frontImg?: string | null; // data URL (jpeg)
  backImg?: string | null;
  sourceFileId?: string | null;
  page?: number | null;
  srs: SrsState;
}

export interface StudyApp extends Base {
  name: string;
  emoji: string;
  /** 'html' = 붙여넣기/파일로 추가한 HTML, 'url' = 게시된 링크 */
  source: 'html' | 'url';
  url?: string | null;
  driveId?: string | null;
  size?: number;
  lastOpenedAt?: number;
}

export interface RecallLog extends Base {
  fileId: ID;
  score: number; // 0~100
}

/* ───────── 공부 도구 ───────── */

export interface StudySession extends Base {
  subject: string;
  color: string;
  start: number;
  end: number;
  sec: number;
  restSec?: number;
  source: 'stopwatch' | 'starter' | 'timer';
  taskId?: string | null;
  /** 공부 중 탭·창을 벗어난 횟수 (웹 집중 기록) */
  awayCount?: number;
  /** 벗어나 있던 시간(초) */
  awaySec?: number;
}

export interface QuickLink extends Base {
  title: string;
  url: string;
  emoji: string;
  order: number;
}

/* ───────── 일반 일정 (교시·종례·학원 등 공부가 아닌 고정 일정) ───────── */

export interface Schedule extends Base {
  title: string;
  color: string;
  /** 하루 중 분 (예: 8시 40분 = 520) */
  startMin: number;
  endMin: number;
  /** once = 그 날 한 번, weekly = 매주 고른 요일마다 */
  repeat: 'once' | 'weekly';
  /** once 일 때 날짜 */
  date?: string | null;
  /** weekly 일 때 요일 (0=일 … 6=토) */
  days?: number[];
  /** weekly 적용 기간 (없으면 제한 없음) */
  from?: string | null;
  to?: string | null;
  /** 이 날짜들은 건너뜀 (휴일·시험 기간 등) */
  skip?: string[];
  /** 같이 만들어진 묶음 (예: 학교 시간표) — 한꺼번에 지우기용 */
  group?: string | null;
  /** 자동 배치·빈 시간 찾기에서 이 시간을 피함 (기본 true) */
  busy?: boolean;
  note?: string;
}

/* ───────── 설정 ───────── */

/** 오답 노트: 틀린 문제 사진 + 간격 반복 (1·3·7·14일) */
export interface WrongNote extends Base {
  subject: string;
  title: string;
  /** 작게 줄인 JPEG data URL (동기화되도록 문서 안에 저장) */
  image?: string | null;
  note?: string;
  answer?: string;
  /** 0~4: 몇 번째 복습까지 했는지 (4면 졸업) */
  stage: number;
  /** 다음 복습 날짜 YYYY-MM-DD (졸업하면 null) */
  nextReview: string | null;
  lastReviewed?: number | null;
  wrongCount: number;
}

/** 수행평가·숙제 마감 */
export type HomeworkKind = 'perf' | 'homework' | 'exam' | 'etc';
export interface Homework extends Base {
  title: string;
  subject: string;
  kind: HomeworkKind;
  due: string; // YYYY-MM-DD
  dueMin?: number | null; // 마감 시각(분). 없으면 하루 종일
  note?: string;
  done: boolean;
  doneAt?: number | null;
}

export interface Place {
  id: string;
  name: string;
  emoji: string;
}

export interface Settings {
  places: Place[];
  statAxes: string[]; // 정확히 6개
  dayStartHour: number;
  dayEndHour: number;
  weekStartsOn: 0 | 1;
  defaultBlockMin: number;
  dailyGoalMin: number;
  /** 에너지가 가장 높은 시간대 (자동 배치에 사용) */
  peakStartHour: number;
  peakEndHour: number;
  theme: 'system' | 'light' | 'dark';
  notifyBeforeMin: number; // 0 = 끔
  pauseOnLeave: boolean;
  penOnly: boolean;
  timerSubjects: { name: string; color: string }[];
  lockApps: { strict: boolean; withTimer: boolean; androidPackages: string[] };
  /** 웹: 공부 중 탭·창 이탈을 기록 */
  trackAway?: boolean;
  /** 웹: 집중 화면을 열면 전체 화면으로 */
  focusFullscreen?: boolean;
  /** 웹: 키보드 단축키 사용 */
  hotkeys?: boolean;
  /** 구글 드라이브의 '학습지원' 폴더 id */
  driveFolderId?: string | null;
  /** 스트릭: 하루 최소 공부(분) */
  streakMin?: number;
  /** 꾸미기: 강조색 (없으면 기본 보라) */
  accent?: string | null;
  /** 꾸미기: 글꼴 */
  font?: 'system' | 'round' | 'serif' | 'mono';
  /** 꾸미기: 글자 크기 배율 */
  fontScale?: number;
  /** 꾸미기: 위젯 스타일 */
  widgetStyle?: 'dark' | 'light' | 'accent' | 'glass';
  /** 달력 스티커: 날짜 → 이모지 */
  stickers?: Record<string, string>;
  /** 나이스(NEIS) 학교 */
  school?: { office: string; code: string; name: string; grade?: number; klass?: number } | null;
  /** 나이스 오픈API 인증키 (선택) */
  neisKey?: string | null;
  /** 마감 알림 */
  homeworkNotify?: { dayBefore: boolean; dayBeforeHour: number; dayOf: boolean; dayOfHour: number };
  /** 오답 복습 알림 시각 */
  wrongNotifyHour?: number;
  /** 수면 계산기 */
  sleep?: { wake: number; fallAsleepMin: number; bedRemind: boolean; cycles: number };
}

export const DEFAULT_SETTINGS: Settings = {
  places: [
    { id: 'dorm', name: '기숙사', emoji: '🛏️' },
    { id: 'school', name: '학교자습실', emoji: '🏫' },
    { id: 'home', name: '집', emoji: '🏠' },
    { id: 'cafe', name: '카페·독서실', emoji: '☕' },
  ],
  statAxes: ['국어', '수학', '영어', '탐구', '암기', '문제풀이'],
  dayStartHour: 6,
  dayEndHour: 24,
  weekStartsOn: 1,
  defaultBlockMin: 50,
  dailyGoalMin: 360,
  peakStartHour: 9,
  peakEndHour: 12,
  theme: 'system',
  notifyBeforeMin: 5,
  pauseOnLeave: false,
  penOnly: true,
  timerSubjects: [],
  lockApps: { strict: false, withTimer: false, androidPackages: [] },
  trackAway: true,
  focusFullscreen: true,
  hotkeys: true,
  streakMin: 10,
  accent: null,
  font: 'system',
  fontScale: 1,
  widgetStyle: 'dark',
  stickers: {},
  school: null,
  neisKey: null,
  homeworkNotify: { dayBefore: true, dayBeforeHour: 20, dayOf: true, dayOfHour: 7 },
  wrongNotifyHour: 19,
  sleep: { wake: 6 * 60 + 30, fallAsleepMin: 15, bedRemind: false, cycles: 5 },
};

export const HOMEWORK_KIND_LABEL: Record<HomeworkKind, string> = {
  perf: '수행평가',
  homework: '숙제',
  exam: '시험',
  etc: '기타',
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  concept: '개념학습',
  problem: '문제풀이',
  memorize: '암기',
  review: '복습',
  reading: '독서·읽기',
  etc: '기타',
};

export const ENERGY_LABEL: Record<Energy, string> = {
  1: '아주 가벼움',
  2: '가벼움',
  3: '보통',
  4: '힘듦',
  5: '매우 힘듦',
};

export const SEASON_KIND_LABEL: Record<SeasonKind, string> = {
  exam: '내신 시험',
  vacation: '방학',
  semester: '학기 중',
  mock: '모의고사',
  custom: '직접 설정',
};
