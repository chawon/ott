export type Status = "DONE" | "IN_PROGRESS" | "WISHLIST";
export type TitleType = "movie" | "series";
export type Provider = "TMDB" | "LOCAL";

export type Place = "HOME" | "THEATER" | "TRANSIT" | "CAFE" | "OFFICE" | "ETC";
export type Occasion = "ALONE" | "DATE" | "FAMILY" | "FRIENDS" | "BREAK" | "ETC";

export interface Title {
    id: string;
    type: TitleType;
    name: string;
    year?: number | null;
    genres?: string[] | null;
    directors?: string[] | null;
    cast?: string[] | null;
    overview?: string | null;
    posterUrl?: string | null;
    provider?: Provider;
    providerId?: string;
    updatedAt?: string;
    deletedAt?: string | null;
}

export interface DiscussionListItem {
    id: string;
    titleId: string;
    titleName: string;
    titleType: TitleType;
    titleYear?: number | null;
    posterUrl?: string | null;
    commentCount: number;
    createdAt: string;
}

export interface Discussion {
    id: string;
    titleId: string;
    commentSeq: number;
    createdAt: string;
}

export interface Comment {
    id: string;
    discussionId: string;
    userId?: string | null;
    authorName: string;
    body: string;
    createdAt: string;
}

export interface CreateCommentRequest {
    body: string;
    userId?: string | null;
    mentions?: MentionRef[];
}

export interface MentionRef {
    provider: Provider;
    providerId: string;
    titleType: TitleType;
    name: string;
}

export interface TitleSearchItem {
    provider: Provider;
    providerId: string;
    titleId?: string;
    type: TitleType;
    name: string;
    year?: number | null;
    posterUrl?: string | null;
    overview?: string | null;
}

export interface WatchLog {
    id: string;
    title: Title;
    status: Status;
    rating?: number | null;
    note?: string | null;
    spoiler: boolean;
    ott?: string | null;
    syncStatus?: "pending" | "synced" | "failed";
    updatedAt?: string;
    deletedAt?: string | null;

    watchedAt: string;   // ISO
    place?: Place | null;
    occasion?: Occasion | null;

    createdAt: string;   // ISO
}

export interface CreateWatchLogRequest {
    titleId?: string;

    provider?: Provider;
    providerId?: string;
    titleType?: TitleType;
    titleName?: string;
    year?: number;
    genres?: string[];

    status: Status;
    rating?: number;
    note?: string;
    spoiler?: boolean;
    ott?: string;

    watchedAt?: string;
    place?: Place;
    occasion?: Occasion;
}
export interface WatchLogHistory {
    id: string;
    logId: string;
    recordedAt: string;
    status: Status;
    rating?: number | null;
    note?: string | null;
    spoiler: boolean;
    ott?: string | null;
    watchedAt: string;
    place?: Place | null;
    occasion?: Occasion | null;
}
