/** NeverSkip source constant */
export const NEVERSKIP_SOURCE = 'neverskip' as const;

/** Raw assignment object from getassignmentsapi (fields may be string | number). */
export interface NeverSkipRawAssignment {
  refid?: string | number;
  assign_id?: string | number;
  subject_id?: string | number;
  subject_name?: string;
  subject?: string;
  /** ISO assigned / Class Diary date, e.g. "2026-09-17". */
  ass_dt?: string;
  /** Display form of the same assigned date, e.g. "17-Sep-2026". */
  assign_dt?: string;
  /** Optional due date; often empty for Class Diary homework. */
  due_dt?: string;
  /** Optional due datetime; unset sentinels look like "0000-00-00 00:00:00". */
  ass_duedt?: string;
  submission_dt?: string;
  assign_title?: string;
  assign_details?: string;
  assign_typ?: string;
  download_url?: string;
  ass_files?: string | NeverSkipFile[] | null;
  submitted_file?: string | null;
  sub_files?: string | null;
  class_name?: string;
  section?: string;
  sections?: string | string[];
  class_sec?: string;
  [key: string]: unknown;
}

export interface NeverSkipFile {
  url?: string;
  file_url?: string;
  name?: string;
  [key: string]: unknown;
}

/** Homework API response — shape varies; we accept arrays or nested wrappers. */
export type NeverSkipHomeworkResponse =
  | NeverSkipRawAssignment[]
  | {
      data?: NeverSkipRawAssignment[] | { assignments?: NeverSkipRawAssignment[] };
      assignments?: NeverSkipRawAssignment[];
      result?: NeverSkipRawAssignment[];
      D?: {
        item_list?: NeverSkipRawAssignment[];
        page_count?: number | string;
        total_count?: number | string;
        sfile_limit?: number | string;
        [key: string]: unknown;
      };
      page_count?: number | string;
      total_count?: number | string;
      sfile_limit?: number | string;
      [key: string]: unknown;
    };

/** Raw daily notice item from fetchdailynoticeinfo */
export interface NeverSkipRawNotice {
  id?: string | number;
  notice_id?: string | number;
  date?: string;
  time?: string;
  cont?: string;
  content?: string;
  image?: string;
  title?: string;
  msg_src?: string;
  msg_type?: string;
  post_from_img?: string;
  test_tar?: NeverSkipNoticeTarget | string | null;
  [key: string]: unknown;
}

export interface NeverSkipNoticeTarget {
  class?: string | string[];
  classes?: string | string[];
  section?: string | string[];
  sections?: string | string[];
  class_sec?: string | string[];
  [key: string]: unknown;
}

export interface NeverSkipNoticesResponse {
  D?: {
    item_list?: NeverSkipRawNotice[];
    [key: string]: unknown;
  };
  item_list?: NeverSkipRawNotice[];
  data?: NeverSkipRawNotice[];
  [key: string]: unknown;
}

/** Raw Content Library item from fetchcontentlib */
export interface NeverSkipRawContentItem {
  refid?: string | number;
  con_id?: string | number;
  sub_id?: string | number;
  subject_name?: string;
  con_tit?: string;
  con_desc?: string;
  full_desc?: string;
  is_sch?: string;
  sch_dt?: string;
  sch_tm?: string;
  sch_fdt?: string;
  tmstmp?: string | number;
  media?: unknown;
  cls_sec?: string;
  title?: string;
  [key: string]: unknown;
}

export type NeverSkipContentLibraryResponse = {
  S?: boolean;
  D?: {
    item_list?: NeverSkipRawContentItem[] | string;
    page_count?: number | string;
    stu_id?: string | number;
    [key: string]: unknown;
  };
  item_list?: NeverSkipRawContentItem[];
  [key: string]: unknown;
};

/** Normalized homework ready for persistence / UI mapping */
export interface NormalizedHomework {
  source: typeof NEVERSKIP_SOURCE;
  sourceId: string;
  refId: string | null;
  subjectId: string | null;
  subjectName: string;
  title: string;
  description: string;
  sections: string[];
  /** Assigned / Class Diary date (ass_dt / assign_dt), YYYY-MM-DD. */
  homeworkDate: string;
  /** School due date from NeverSkip due_dt / ass_duedt only. Extracted dates live in HomeworkDeadlineExtraction. */
  dueDate: string | null;
  attachmentUrl: string | null;
}

/** Normalized notice ready for persistence / UI mapping */
export interface NormalizedNotice {
  source: typeof NEVERSKIP_SOURCE;
  sourceId: string;
  title: string;
  summary: string;
  content: string;
  publishedDate: string;
  publishedTime: string;
  classes: string[];
  imageUrl: string | null;
}

/** Normalized Content Library / JOL item */
export interface NormalizedJolItem {
  source: typeof NEVERSKIP_SOURCE;
  sourceId: string;
  title: string;
  description: string;
  content: string;
  activityDate: string;
  publishedDate: string;
  publishedTime: string;
  resourceType: string;
  resourceUrl: string | null;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  subjectName: string | null;
  sections: string[];
  jolRelated: boolean;
  scheduleDocument: boolean;
  metadataJson: string;
}

export interface NormalizedScheduleEvent {
  source: typeof NEVERSKIP_SOURCE;
  sourceId: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  weekday: string;
  subjectName: string | null;
  periodLabel: string | null;
  classSection: string | null;
  resourceUrl: string | null;
  metadataJson: string;
}

export type UpsertResult = 'inserted' | 'updated' | 'unchanged';

/** Raw items collected from NeverSkip (browser intercept or API client). */
export interface CollectedNeverSkipData {
  homework: NeverSkipRawAssignment[];
  notices: NeverSkipRawNotice[];
  jolItems?: NeverSkipRawContentItem[];
  homeworkPagesFetched?: number;
  homeworkFetchIncomplete?: boolean;
  homeworkFetchErrors?: string[];
  homeworkSourceTotal?: number | null;
  homeworkRawFetched?: number;
  homeworkUniqueFetched?: number;
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
  /** Page-0 only ingest when further notice pages return SQLSTATE/non-JSON. */
  noticePage0Only?: boolean;
  noticeFetchErrors?: string[];
  noticeSourceTotal?: number | null;
  noticeRawFetched?: number;
  noticeUniqueFetched?: number;
  jolPagesFetched?: number;
  jolFetchIncomplete?: boolean;
  jolFetchErrors?: string[];
  jolSourceTotal?: number | null;
  jolRawFetched?: number;
  jolUniqueFetched?: number;
  /** Normalized calendar events from fetchcalenderapi */
  scheduleEvents?: NormalizedScheduleEvent[];
  scheduleRawCount?: number;
  scheduleFetchIncomplete?: boolean;
  scheduleFetchErrors?: string[];
  /** True when calendar response was complete (including empty D:[]) */
  scheduleFetchComplete?: boolean;
}

export interface SyncSummary {
  homeworkFetched: number;
  homeworkInserted: number;
  homeworkUpdated: number;
  homeworkSkipped: number;
  homeworkSkippedType: number;
  homeworkNormalized?: number;
  homeworkStored?: number;
  homeworkMissing?: number;
  homeworkPagesFetched?: number;
  homeworkFetchIncomplete?: boolean;
  homeworkSourceTotal?: number | null;
  homeworkRawFetched?: number;
  homeworkUniqueFetched?: number;
  noticesFetched: number;
  noticesInserted: number;
  noticesUpdated: number;
  noticesSkipped: number;
  noticesNormalized?: number;
  noticesStored?: number;
  noticesMissing?: number;
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
  noticePage0Only?: boolean;
  noticeSourceTotal?: number | null;
  noticeRawFetched?: number;
  noticeUniqueFetched?: number;
  jolFetched?: number;
  jolInserted?: number;
  jolUpdated?: number;
  jolSkipped?: number;
  jolNormalized?: number;
  jolStored?: number;
  jolPagesFetched?: number;
  jolFetchIncomplete?: boolean;
  jolSourceTotal?: number | null;
  jolRawFetched?: number;
  jolUniqueFetched?: number;
  scheduleFetched?: number;
  scheduleInserted?: number;
  scheduleUpdated?: number;
  scheduleSkipped?: number;
  scheduleStored?: number;
  scheduleFetchIncomplete?: boolean;
  scheduleFetchComplete?: boolean;
  schedulePreservedOnFailure?: boolean;
  newestHomeworkDate?: string;
  newestNoticeDate?: string;
  newestJolDate?: string;
  newestScheduleDate?: string;
  syncStatus?: string;
  /** Per-source status map for SyncRun reportJson / operators. */
  sourceStatuses?: Record<
    string,
    { status: string; fetched?: number; stored?: number; newestDate?: string; error?: string }
  >;
  jolTimetableStatus?: string;
  jolTimetableDayCount?: number;
  errors: string[];
}

export class NeverSkipHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'NeverSkipHttpError';
  }
}

export class NeverSkipTimeoutError extends Error {
  constructor(message = 'NeverSkip request timed out') {
    super(message);
    this.name = 'NeverSkipTimeoutError';
  }
}

export class NeverSkipAuthError extends Error {
  constructor(message = 'NeverSkip authentication token is missing') {
    super(message);
    this.name = 'NeverSkipAuthError';
  }
}
