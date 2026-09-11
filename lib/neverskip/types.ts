/** NeverSkip source constant */
export const NEVERSKIP_SOURCE = 'neverskip' as const;

/** Raw assignment object from getassignmentsapi (fields may be string | number). */
export interface NeverSkipRawAssignment {
  refid?: string | number;
  assign_id?: string | number;
  subject_id?: string | number;
  subject_name?: string;
  subject?: string;
  ass_dt?: string;
  assign_dt?: string;
  due_dt?: string;
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
  homeworkDate: string;
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

export type UpsertResult = 'inserted' | 'updated' | 'unchanged';

/** Raw items collected from NeverSkip (browser intercept or API client). */
export interface CollectedNeverSkipData {
  homework: NeverSkipRawAssignment[];
  notices: NeverSkipRawNotice[];
  homeworkPagesFetched?: number;
  homeworkFetchIncomplete?: boolean;
  homeworkFetchErrors?: string[];
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
  noticeFetchErrors?: string[];
}

export interface SyncSummary {
  homeworkFetched: number;
  homeworkInserted: number;
  homeworkUpdated: number;
  homeworkSkipped: number;
  homeworkSkippedType: number;
  homeworkPagesFetched?: number;
  homeworkFetchIncomplete?: boolean;
  noticesFetched: number;
  noticesInserted: number;
  noticesUpdated: number;
  noticesSkipped: number;
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
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
