namespace Ottline.Core.I18n;

public sealed record OttlineStrings(
    string Locale,
    // Navigation & Header
    string BrandName,
    string BrandTagline,
    string NavHome,
    string NavTimeline,
    string NavTogether,
    string NavMySpace,
    string QuickRecordButton,
    string QuickRecordShortcutHint,
    string SyncNowButton,
    string SyncedLabel,
    string SyncPendingLabel,
    string OfflineLabel,
    // Home Screen
    string HomeEditorialGreeting,
    string HomeEditorialSubtitle,
    string HomeMonthCompletedTitle,
    string HomeWarmthSectionTitle,
    string HomeWarmthSectionSubtitle,
    string HomeUnfinishedTitle,
    string HomeUnfinishedSubtitle,
    string HomeMomentsTitle,
    string HomeMomentsSubtitle,
    string HomeStarterTitle,
    string HomeStarterBody,
    string HomeStarterCta,
    string HomeHandoffBannerTitle,
    string HomeHandoffBannerBody,
    string HomeHandoffWebButton,
    string HomeHandoffCodeButton,
    // Timeline Screen
    string TimelineTitle,
    string TimelineSearchPlaceholder,
    string FilterAll,
    string FilterVideo,
    string FilterBook,
    string MomentFilterToggle,
    string ClearFiltersButton,
    string FutureRecommendationsTitle,
    string FutureRecommendationsSubtitle,
    string ExportCsvButton,
    string LoadMoreButton,
    // Title Detail Screen
    string DetailWarmthCardTitle,
    string DetailPolishButton,
    string DetailShareCardButton,
    string DetailHistoryTitle,
    string DetailHistorySubtitle,
    string DetailNoDeletePolicyNotice,
    string SpoilerHiddenNotice,
    string SpoilerRevealButton,
    // Quick Record Modal
    string QuickRecordModalTitle,
    string QuickRecordSearchPlaceholder,
    string QuickRecordManualVideoButton,
    string QuickRecordManualBookButton,
    string StatusDoneLabel,
    string StatusInProgressLabel,
    string StatusWishlistLabel,
    string FeelingSatisfiedLabel,
    string FeelingNeutralLabel,
    string FeelingDisappointedLabel,
    string DateLabel,
    string PlatformLabel,
    string PlaceLabel,
    string OccasionLabel,
    string NoteLabel,
    string NotePlaceholder,
    string SpoilerCheckLabel,
    string ShareTogetherCheckLabel,
    string SaveRecordButton,
    string SavedCelebrationTitle,
    string SavedCelebrationSubtitle,
    // Together Screen
    string TogetherTitle,
    string TogetherSubtitle,
    string WriteTogetherButton,
    string ReactionDoneLabel,
    string ReactionCuriousLabel,
    string ReactionSaveLabel,
    string CommentPlaceholder,
    string MentionHint,
    // My Space Screen
    string MySpaceTitle,
    string ProfileSectionTitle,
    string SyncSectionTitle,
    string RecoveryCodeLabel,
    string CopyCodeButton,
    string ExportRecoveryCardButton,
    string PairDeviceTitle,
    string PairCodePlaceholder,
    string PreviewPairButton,
    string ConfirmMergeButton,
    string LinkedDevicesTitle,
    string PersonalReportTitle,
    string ExportRecapCardButton,
    string BookshelfTitle,
    string WatchReminderTitle,
    string WatchReminderDescription,
    string WatchReminderTestButton,
    string FeedbackTitle,
    string GuidesTitle,
    string NetflixImportTitle,
    string LocalResetButton,
    string ServerDeleteAccountButton,
    string DebugServerTitle
)
{
    public static OttlineStrings ForLocale(string? locale) =>
        string.Equals(locale?.Trim(), "en", StringComparison.OrdinalIgnoreCase) ? English : Korean;

    public bool IsEn => string.Equals(Locale, "en", StringComparison.OrdinalIgnoreCase);

    // Header & Global Navigation (Web AppHeader.tsx + QuickLogAction.tsx)
    public string HeaderQuickLogCta => IsEn ? "Leave a record" : "기록 남기기";
    public string HeaderQuickLogToolTip => IsEn ? "Leave a record (Ctrl+K)" : "기록 남기기 (Ctrl+K)";
    public string HeaderOpenMySpaceToolTip => IsEn ? "My profile" : "내 프로필";

    // Home View (HomeTimelineView.tsx + app/[locale]/page.tsx + FirstLogActivationPanel.tsx)
    public string HomeEyebrow => IsEn ? "MY TIMELINE" : "나의 타임라인";
    public string HomeHeadingTitle => IsEn ? "Stories on your timeline" : "내 시간 위에 쌓인 이야기";
    public string HomeEmptyHeadingTitle => IsEn ? "Your timeline. Your first moment." : "나의 타임라인에 첫 순간을 남겨요.";
    public string HomeWelcomeSubtitle => IsEn
        ? "A film, a series, a book. Start with one you want to keep."
        : "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.";
    public string HomeFirstRecordButton => IsEn ? "+ Leave your first record" : "+ 첫 기록 남기기";
    public string HomeBringExistingLink => IsEn ? "Bring my existing records →" : "이미 남긴 기록 이어보기 →";
    public string HomeMigrationEyebrow => IsEn ? "OTTLINE 2.0 · CONTINUE YOUR TIMELINE" : "OTTLINE 2.0 · 기존 기록 이어받기";
    public string HomeMigrationTitle => IsEn ? "Used ottline on the Store app or web before?" : "기존 스토어 앱이나 웹에서 남긴 기록이 있나요?";
    public string HomeMigrationBody => IsEn
        ? "Connect your timeline in one click from Microsoft Edge (previous Store app) or your default browser, or enter an 8-character connection code."
        : "기존 Microsoft Store 앱(Edge)이나 기본 브라우저에 남아 있는 타임라인을 버튼 한 번으로 이어받거나, 8자리 연결 코드로 합칠 수 있어요.";
    public string HomeMigrationEdgeButton => IsEn ? "Bring from Store app (Edge)" : "기존 스토어 앱(Edge) 기록 이어받기";
    public string HomeMigrationBrowserButton => IsEn ? "Bring from default browser" : "기본 브라우저에서 이어받기";
    public string HomeMigrationCodeLink => IsEn ? "Enter 8-character code →" : "8자리 연결 코드 입력 →";
    public string ActivationEyebrow => IsEn ? "First record" : "처음 남길 기록";
    public string ActivationTitle => IsEn ? "Pick one to start" : "하나만 골라볼까요?";
    public string ActivationDescription => IsEn
        ? "Start with whatever comes to mind before searching from scratch."
        : "찾기 전에 먼저 떠오르는 것부터 가볍게 남겨보세요.";
    public string ActivationVideoTitle => IsEn
        ? "Have you watched any of these lately?"
        : "요즘 많이 남기는 작품 중 본 게 있나요?";
    public string ActivationVideoDescription => IsEn
        ? "Pick a poster and it opens the regular logging flow."
        : "포스터를 고르면 바로 기록하기 화면으로 이어져요.";
    public string ActivationPopularSection => IsEn ? "Popular now" : "요즘 인기 작품";
    public string ActivationFindOtherVideo => IsEn ? "Find another title →" : "다른 작품 찾기 →";
    public string HomeRecordTodayButton => IsEn ? "Keep today’s story" : "오늘의 기록 남기기";
    public string HomeMonthsColumnTitle => IsEn ? "YOUR MONTHS" : "쌓아온 시간";
    public string HomeFeaturedLabel => IsEn ? "A moment kept" : "그날의 온기";
    public string HomeFeaturedOpenAction => IsEn ? "Open this memory →" : "이 기록 펼치기 →";
    public string HomeFeaturedShareToolTip => IsEn ? "Create a share card" : "공유 카드 만들기";
    public string HomeMonthEntriesHeading => IsEn ? "Moments this month" : "이 달에 남긴 시간";
    public string HomeTimelineLink => IsEn ? "Timeline →" : "타임라인 →";
    public string HomeMomentRevisitEyebrow => IsEn ? "BACK TO A MOMENT" : "다시 만나는 그날";
    public string HomeMomentRevisitTitle => IsEn ? "Which moments will you revisit?" : "어떤 순간을 펼쳐볼까요?";
    public string HomeMomentRevisitSubtitle => IsEn
        ? "Revisit moments from the records kept on this device."
        : "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요.";
    public string HomeUnfinishedHeading => IsEn ? "Stories still unfolding" : "아직 못다 한 이야기";
    public string HomeContinueLoggingLink => IsEn ? "Keep going →" : "이어 적기 →";
    public string HomeSideReportLink => IsEn ? "Look back on your time →" : "쌓아온 시간 돌아보기 →";
    public string HomeSideBookshelfLink => IsEn ? "Open my bookshelf →" : "내 서가 펼치기 →";
    public string HomeQuietNote => IsEn
        ? "No need to keep up. Come back when there’s something to keep."
        : "서두르지 않아도 괜찮아요. 남기고 싶은 순간에 다시 만나요.";
    public string HomePublicEyebrow => IsEn ? "TOGETHER" : "함께";
    public string HomePublicTitle => IsEn ? "Stories to share" : "함께 만나는 이야기";
    public string HomePublicViewAllLink => IsEn ? "View All →" : "전체 보기 →";
    public string HomePublicItemAction => IsEn ? "Open →" : "이야기 →";
    public string WatchBannerRecordNow => IsEn ? "Leave a record" : "기록 남기기";
    public string CommonClose => IsEn ? "Close" : "닫기";
    public string CommonCloseWithX => IsEn ? "✕ Close" : "✕ 닫기";

    // Footer (AppFooter.tsx + messages)
    public string FooterTagline => IsEn
        ? "What you watch and read, kept on your timeline."
        : "보고 읽은 순간을 나의 타임라인에.";
    public string FooterGuidesLink => IsEn ? "Recording guides" : "기록 가이드";
    public string FooterAboutLink => IsEn ? "About Service" : "서비스 소개";
    public string FooterFaqLink => IsEn ? "FAQ" : "자주 묻는 질문";
    public string FooterPrivacyLink => IsEn ? "Privacy Policy" : "개인정보처리방침";
    public string FooterFeedbackLink => IsEn ? "Contact" : "문의하기";
    public string FooterReportLink => IsEn ? "My Usage Report" : "내 이용 리포트";
    public string FooterBookshelfLink => IsEn ? "Open my bookshelf" : "서가 보기";
    public string InfoBackButton => IsEn ? "← Back" : "← 돌아가기";
    public string InfoCurrentPlatformBadge => IsEn ? "Current app" : "현재 앱";

    // Timeline View (app/[locale]/timeline/page.tsx + FiltersBar.tsx + LogCard.tsx)
    public string TimelineEyebrow => IsEn ? "THE STORIES YOU KEPT" : "남겨둔 이야기";
    public string TimelinePageSubtitle => IsEn
        ? "Everything you’ve watched, in chronological order"
        : "내가 본 것들이 시간 순서로 모여요";
    public string TimelineExportCsvAction => IsEn ? "⬇ Export CSV" : "⬇ CSV 다운로드";
    public string TimelineShortcutReport => IsEn ? "📊 My Usage Report →" : "📊 내 이용 리포트 →";
    public string TimelineShortcutBookshelf => IsEn ? "📖 Open my bookshelf →" : "📖 서가 보기 →";
    public string TimelineRecsTitle => IsEn
        ? "Future timeline"
        : "미래의 타임라인";
    public string TimelineRecsRefresh => IsEn ? "See another set" : "다른 이야기 펼쳐보기";
    public string TimelineRecsFindingButton => IsEn ? "Finding stories…" : "이야기를 고르고 있어요…";
    public string TimelineRecsRetryButton => IsEn ? "Try again" : "다시 시도";
    public string TimelineRecsLoading => IsEn
        ? "Finding a few stories through the records you kept…"
        : "남겨둔 이야기에서 다음에 만날 작품을 고르고 있어요…";
    public string TimelineRecsRefreshingKeepExisting => IsEn
        ? "Finding a new set of stories… Your current picks stay here until it’s ready."
        : "새로운 이야기를 고르고 있어요… 새 추천이 준비될 때까지 기존 추천을 그대로 볼 수 있어요.";
    public string TimelineRecsNeedMoreLogs => IsEn
        ? "With five records, you can explore a few stories to meet next."
        : "기록이 5개 모이면 다음에 만날 이야기도 펼쳐볼 수 있어요.";
    public string TimelineRecsNotConnected => IsEn
        ? "Sync your first record or connect your account to open your future timeline."
        : "첫 기록을 동기화하거나 계정을 연결하면 미래의 타임라인을 펼쳐볼 수 있어요.";
    public string TimelineRecsEmptyFiltered => IsEn
        ? "No stories to open for this filter yet."
        : "지금 고른 조건에 맞는 추천 작품이 아직 없어요.";
    public string TimelineRecsLoadError => IsEn
        ? "Could not bring in the next stories. Please try again in a little while."
        : "다음 이야기를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.";
    public string TimelineRecsGenerateError => IsEn
        ? "Could not finish finding new stories. Try again to check or continue the request."
        : "새 이야기를 다 불러오지 못했어요. 다시 시도하면 진행 상태부터 이어서 확인할게요.";
    public string TimelineRecsGenerateErrorKeepExisting => IsEn
        ? "Could not finish finding new stories. Your current picks are safe—try again to continue."
        : "새 이야기를 다 불러오지 못했어요. 기존 추천은 그대로 두고, 다시 시도하면 이어서 확인할게요.";
    public string TimelineRecsStillGenerating => IsEn
        ? "Still putting your next stories together. Try again in a moment to check the result."
        : "아직 다음 이야기를 고르고 있어요. 잠시 뒤 다시 확인해 주세요.";
    public string TimelineRecsQuotaExhausted => IsEn
        ? "You’ve explored three times today. You can explore again at midnight (Korea time)."
        : "오늘은 세 번의 이야기를 모두 펼쳐봤어요. 한국 시간 자정에 다시 펼쳐볼 수 있어요.";
    public string FormatRecommendationQuotaRemaining(int remaining) => IsEn
        ? $"You can explore {remaining} more {(remaining == 1 ? "time" : "times")} today."
        : $"오늘 {remaining}번 더 펼쳐볼 수 있어요.";
    public string TimelineRecsLogAction => IsEn ? "Want to watch" : "보고 싶어요";
    public string TimelineRecsExcludeAction => IsEn ? "Already watched or read" : "이미 본·읽은 작품";
    public string TimelineFilterSearchHint => IsEn
        ? "Title, note, platform"
        : "제목, 메모, 플랫폼";
    public string TimelineFilterStatusLabel => IsEn ? "Status" : "상태";
    public string TimelineFilterStatusAll => IsEn ? "All" : "전체";
    public string TimelineFilterStatusDone => IsEn ? "Watched / Read" : "봤어요 / 읽었어요";
    public string TimelineFilterStatusInProgress => IsEn ? "Watching / Reading" : "보는 중 / 읽는 중";
    public string TimelineFilterStatusWishlist => IsEn ? "Want to watch / Want to read" : "보고 싶어요 / 읽고 싶어요";
    public string TimelineFilterPlatformLabel => IsEn ? "Platform" : "플랫폼";
    public string TimelineFilterPlaceLabel => IsEn ? "Where" : "어디서";
    public string TimelineFilterOccasionLabel => IsEn ? "Who you were with or the occasion" : "누구와·어떤 상황";
    public string TimelineFilterOriginLabel => IsEn ? "Source" : "구분";
    public string TimelineFilterOriginAll => IsEn ? "All" : "전체";
    public string TimelineFilterOriginSatisfied => IsEn ? "Excellent / Life-changing" : "최고예요 / 인생책";
    public string TimelineFilterOriginNeutral => IsEn ? "Worth watching / Not bad" : "볼만해요 / 무난해요";
    public string TimelineFilterOriginDisappointed => IsEn ? "Disappointing" : "아쉬워요";
    public string TimelineFilterOriginLog => IsEn ? "My Record" : "내 기록";
    public string TimelineFilterOriginReaction => IsEn ? "From Together" : "함께 남긴 기록";
    public string TimelineMonthSortCaption => IsEn ? "By last recorded or updated" : "최근 기록·수정한 날 기준";
    public string TimelineRowOpenAction => IsEn ? "Open record →" : "기록 펼치기 →";
    public string TimelineRowPolishAction => IsEn ? "Edit this record" : "기록 수정하기";
    public string TimelineRowShareCardAction => IsEn ? "Create a share card" : "공유 카드 만들기";
    public string TimelineRowShareTogetherAction => IsEn ? "Share to Together" : "함께 나누기";
    public string TimelineEmptyTitle => IsEn
        ? "No records yet. Start with one title you just watched or read."
        : "남겨둔 기록이 아직 없어요. 방금 본 작품 하나부터 차근차근 쌓아보세요.";
    public string TimelineEmptyAction => IsEn ? "Leave a new record →" : "새로운 기록 남기기 →";

    // Together View (app/[locale]/public/page.tsx + PublicDiscussionsClient.tsx)
    public string TogetherEyebrow => IsEn ? "STORIES, SHARED" : "함께 나누는 이야기";
    public string TogetherHeadingTitle => IsEn ? "Same story, different feelings" : "같은 이야기, 다른 마음";
    public string TogetherHeadingSubtitle => IsEn
        ? "Share the scenes and thoughts that stayed with you."
        : "같은 작품에서 만난 장면과 생각을 함께 나눠요.";
    public string TogetherNewPostButton => IsEn ? "+ Leave a thought" : "+ 의견 남기기";
    public string TogetherSortLatest => IsEn ? "Latest" : "최신";
    public string TogetherSortReactions => IsEn ? "Reactions" : "공감";
    public string TogetherSortComments => IsEn ? "Most comments" : "댓글 많은 순";
    public string TogetherReactDone => IsEn ? "✓ Watched it too" : "✓ 나도 봤어요";
    public string TogetherReactDoneBook => IsEn ? "✓ Read it too" : "✓ 나도 읽었어요";
    public string TogetherReactCurious => IsEn ? "👀 Curious" : "👀 궁금해요";
    public string TogetherReactSave => IsEn ? "🔖 Save for later" : "🔖 저장해둘래요";
    public string TogetherOpenComments => IsEn ? "Together →" : "함께 기록 →";
    public string TogetherSearchPlaceholder => IsEn ? "Filter by title or note" : "작품 제목이나 내용으로 찾기";
    public string TogetherClearSearchButton => IsEn ? "Clear search" : "검색 지우기";
    public string TogetherRefreshButton => IsEn ? "Refresh" : "새로고침";
    public string TogetherListLoading => IsEn ? "Loading shared stories…" : "함께 나눈 이야기를 불러오고 있어요…";
    public string TogetherEmptyListTitle => IsEn ? "No shared stories yet." : "아직 함께 나눈 이야기가 없어요.";
    public string TogetherEmptySearchTitle => IsEn ? "No stories match that search yet." : "찾는 조건에 맞는 이야기가 아직 없어요.";
    public string TogetherSelectPromptTitle => IsEn ? "Select a conversation from the left list." : "왼쪽에서 이야기를 선택해 읽어보세요.";
    public string TogetherSelectPromptBody => IsEn
        ? "Pick a title to read reactions and comments, or add it straight to your timeline."
        : "작품을 고르면 공감과 댓글, 내 타임라인 기록까지 한 번에 이어서 볼 수 있어요.";
    public string TogetherBackToList => IsEn ? "← Back to list" : "← 목록으로";
    public string TogetherLogThisTitle => IsEn ? "Log this title" : "이 작품 기록하기";
    public string TogetherOpenMyRecord => IsEn ? "Open my record" : "내 기록 펼치기";
    public string TogetherCommentsHeading => IsEn ? "Shared thoughts" : "함께 나눈 이야기";
    public string TogetherCommentsLoading => IsEn ? "Loading thoughts…" : "이야기를 불러오고 있어요…";
    public string TogetherCommentsLoadError => IsEn
        ? "Could not load comments. Please try again in a little while."
        : "이야기를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.";
    public string TogetherCommentsRetry => IsEn ? "Try again" : "다시 불러오기";
    public string TogetherCommentsEmpty => IsEn
        ? "No thoughts here yet. Leave the first line."
        : "아직 남겨진 이야기가 없어요. 첫 한 줄을 남겨보세요.";
    public string TogetherSyncLogCheckbox => IsEn ? "Also keep on my timeline" : "내 타임라인에도 함께 남기기";

    // My Space View (app/[locale]/account/page.tsx + ProfileEditor.tsx)
    public string MySpaceEyebrow => IsEn ? "MY SPACE" : "나의 공간";
    public string MySpaceHeadingTitle => IsEn ? "Your records, wherever you are" : "어디서든, 나의 기록";
    public string MySpaceHeadingSubtitle => IsEn
        ? "A simple way to carry your records with you."
        : "계정을 외우는 대신, 내 기록을 이어가는 방법.";
    public string MySpaceTabProfileSync => IsEn ? "My space · Device connection" : "내 공간 · 기기 연결";
    public string MySpaceTabReport => IsEn ? "📊 My Usage Report" : "📊 내 이용 리포트";
    public string MySpaceTabBookshelf => IsEn ? "📖 My bookshelf" : "📖 내 서가";
    public string MySpaceTabWatchReminder => IsEn ? "🖥 Watch reminder settings" : "🖥 시청 기록 알림 설정";
    public string MySpaceTabFeedback => IsEn ? "💬 My inbox" : "💬 내 문의함";
    public string MySpaceTabGuides => IsEn ? "📘 Recording guides" : "📘 기록 가이드";
    public string MySpaceProfileLabel => IsEn ? "My profile" : "나의 프로필";
    public string MySpaceProfilePrivacyHint => IsEn
        ? "Your nickname and avatar appear only on your own screens."
        : "닉네임과 아바타는 내 화면에서만 보여요.";
    public string MySpaceChoosePersonaButton => IsEn ? "Choose my look" : "내 모습 고르기";
    public string MySpaceAvatarPickerTitle => IsEn
        ? "An avatar that feels like you"
        : "나와 닮은 아바타";
    public string MySpaceSavePersonaButton => IsEn ? "Save profile" : "이 모습으로 저장";
    public string MySpaceContinueTitle => IsEn ? "Keep your records with you" : "내 기록 이어보기";
    public string MySpaceContinueBody => IsEn
        ? "Enter this code in My space on another device to open the same records."
        : "다른 기기의 내 공간에서 이 코드를 입력하면 같은 기록을 열 수 있어요.";
    public string MySpaceMyCodeLabel => IsEn ? "My record connection code" : "나의 기록 연결 코드";
    public string MySpaceSaveRecoveryPngButton => IsEn ? "Save recovery card" : "보관 카드 저장";
    public string MySpaceOtherDeviceTitle => IsEn ? "Have records on another device?" : "다른 기기에 기록이 있나요?";
    public string MySpaceOtherDeviceBody => IsEn
        ? "Find the code in My space on that device to bring your records here."
        : "그 기기의 내 공간에서 코드를 확인해 여기서 이어보세요.";
    public string MySpaceReceiveLogsButton => IsEn ? "Connect" : "연결하기";
    public string MySpaceMergeReadyTitle => IsEn ? "Confirm connection" : "기록 연결 확인";
    public string MySpaceMergeReadyBody => IsEn
        ? "If a title exists on both devices, the most recently edited version is kept."
        : "같은 작품의 기록이 양쪽에 있으면 더 최근에 수정된 내용이 남아요.";
    public string MySpaceConfirmMergeAction => IsEn ? "Connect" : "연결하기";
    public string MySpaceBrowserHandoffButton => IsEn
        ? "Bring my existing records"
        : "이미 남긴 기록 이어보기";
    public string MySpaceConnectedDevicesTitle => IsEn ? "Connected devices" : "연결된 기기";
    public string MySpaceConnectedDevicesSubtitle => IsEn
        ? "Review and manage devices connected to this account."
        : "현재 계정에 연결된 기기를 확인하고 정리해요.";
    public string MySpaceCurrentDeviceLabel => IsEn
        ? "This device · Windows"
        : "현재 기기 · Windows";
    public string MySpaceExploreMoreTitle => IsEn ? "A little help with your records" : "기록을 더 잘 이어가도록";
    public string MySpaceExploreMoreSubtitle => IsEn
        ? "Check your questions and replies in your inbox."
        : "문의함에서 질문과 답변을 확인해요.";
    public string MySpaceCsvSectionTitle => IsEn ? "Export my records" : "내 기록 내보내기";
    public string MySpaceCsvSectionBody => IsEn
        ? "Save the timeline stored on this device as a CSV file."
        : "이 기기에 저장된 타임라인을 CSV로 저장할 수 있어요.";
    public string MySpaceDownloadCsvButton => IsEn ? "Download CSV" : "CSV 다운로드";
    public string MySpaceImportNetflixButton => IsEn ? "Import Netflix viewing history (CSV)" : "넷플릭스 시청 기록 (CSV) 가져오기";
    public string MySpaceDataManageTitle => IsEn ? "Manage records and connection data" : "기록과 연결 데이터 관리";
    public string MySpaceDataManageBody => IsEn
        ? "Manage exports, local reset, and server data deletion."
        : "내보내기, 로컬 초기화, 서버 데이터 삭제를 관리해요.";
    public string MySpaceResetLocalAction => IsEn ? "Reset local data" : "로컬 데이터 초기화";
    public string MySpaceDeleteAllAction => IsEn ? "Delete all server data" : "서버 데이터 전체 삭제";
    public string DeleteAccountInProgressLabel => IsEn ? "Deleting server data…" : "서버 데이터 삭제 중…";
    public string LocalResetConfirmTitle => IsEn ? "Reset local data" : "로컬 데이터 초기화";
    public string LocalResetConfirmBody => IsEn
        ? "Clear records and cache stored on this device? Your synced server data stays safe."
        : "이 기기에 보관된 기록과 캐시만 초기화할까요? 서버에 동기화된 기록은 삭제되지 않아요.";
    public string LocalResetSuccessNotice => IsEn
        ? "Cleared local records on this device."
        : "이 기기의 로컬 기록을 초기화했어요.";
    public string DeleteAccountConfirmTitle => IsEn ? "Delete all server data" : "서버 데이터 전체 삭제";
    public string DeleteAccountConfirmBody => IsEn
        ? "This will permanently delete synced records, comments, inbox messages, analytics data, and all linked devices for this account. Local data on this device will also be cleared and cannot be undone. Continue?"
        : "서버에 저장된 기록, 댓글, 문의, 분석 데이터와 연결된 모든 기기가 삭제됩니다. 이 기기의 로컬 데이터도 함께 초기화되며 되돌릴 수 없어요. 계속할까요?";
    public string DeleteAccountSuccessNotice => IsEn
        ? "Deleted your server account and cleared local data on this device."
        : "서버 계정과 이 기기의 로컬 데이터를 모두 삭제했어요.";
    public string DeleteAccountFailedNotice => IsEn
        ? "Could not delete your server account. Your local records and connection are still safe. Please try again in a little while."
        : "서버 계정 삭제를 완료하지 못했어요. 이 기기의 기록과 연결 상태는 그대로 유지했어요. 잠시 뒤 다시 시도해 주세요.";
    public string DeleteAccountNetworkFailedNotice => IsEn
        ? "Could not reach the server to delete your account. Your local records and connection are still safe. Check your connection and try again."
        : "네트워크 연결을 확인하지 못해 서버 계정을 삭제하지 못했어요. 이 기기의 기록과 연결 상태는 그대로 유지했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
    public string DeleteAccountNotConnectedNotice => IsEn
        ? "No server account is connected on this device. Use Reset local data to clear records kept here."
        : "서버에 연결된 계정이 없어요. 이 기기의 기록만 비우려면 로컬 데이터 초기화를 사용해 주세요.";

    // My Space Sub-views (Report, Bookshelf, Watch Reminder, Feedback, Guides)
    public string ReportHeadingTitle => IsEn ? "My Usage Report" : "내 이용 리포트";
    public string ReportTotalLabel => IsEn ? "Total Records" : "총 기록";
    public string ReportVideoLabel => IsEn ? "Video (Movies/Series)" : "영상(영화/시리즈)";
    public string ReportBookLabel => IsEn ? "Books" : "책";
    public string ReportSatisfiedLabel => IsEn ? "Excellent · Life-changing" : "최고예요 · 인생책";
    public string BookshelfHeadingTitle => IsEn
        ? "My bookshelf"
        : "내 서가";
    public string BookshelfHeadingSubtitle => IsEn
        ? "Organized by the 10 main classes of Korean Decimal Classification. No manual sorting needed."
        : "한국십진분류법의 10개 큰 주제를 따라 정리했어요. 직접 분류할 필요는 없어요.";
    public string WatchPrefHeadingTitle => IsEn
        ? "Watch reminder settings"
        : "시청 기록 알림 설정";
    public string WatchPrefHeadingSubtitle => IsEn
        ? "Get a notification that opens the logging screen after you close an OTT app."
        : "OTT 앱을 닫은 뒤 기록 화면으로 이어지는 알림을 받을 수 있어요.";
    public string WatchPrefToggleWatch => IsEn
        ? "Turn on watch reminders after closing an OTT app (Netflix, TVING, Wavve, Coupang Play, Disney+, etc.)"
        : "시청 기록 알림 켜기 (Netflix, TVING, Wavve, Coupang Play, Disney+ 등)";
    public string WatchPrefToggleRevisit => IsEn
        ? "Revisit moments from the records kept on this device"
        : "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요";
    public string WatchPrefToggleHotkey => IsEn
        ? "Leave a record anytime with global shortcut (Ctrl+Shift+O)"
        : "전역 단축키 (Ctrl+Shift+O)로 언제든 기록 남기기";
    public string WatchPrefToggleTray => IsEn
        ? "Keep running in system tray when closing window (X)"
        : "창 닫기(X) 클릭 시 시스템 트레이에 보관";
    public string WatchPrefTestButton => IsEn ? "Test watch reminder" : "시청 기록 알림 테스트";
    public string WidgetSectionTitle => IsEn
        ? "Windows 11 Official Widget (Win + W)"
        : "Windows 11 공식 위젯 (Win + W)";
    public string WidgetSectionSubtitle => IsEn
        ? "Press Win + W to open the Widgets Board, click '+' at the top right, and pin ottline. Supports Small, Medium, and Large sizes."
        : "키보드에서 Win + W를 눌러 위젯 보드를 열고 우측 상단 '+' 버튼에서 ottline을 고정해보세요. 소형·중형·대형 3가지 크기를 지원합니다.";
    public string WidgetPreviewLabel => IsEn ? "Live widget preview" : "실시간 위젯 미리보기";
    public string WidgetBtnQuickRecord => IsEn ? "+ Quick Record" : "+ 빠른 기록";
    public string WidgetBtnVideo => IsEn ? "Video" : "영상";
    public string WidgetBtnBook => IsEn ? "Book" : "책";
    public string WidgetBtnTimeline => IsEn ? "Timeline" : "타임라인";
    public string WatchPrefServerLabel => IsEn ? "Server URL" : "서버 주소";
    public string WatchPrefApplyButton => IsEn ? "Save" : "저장";
    public string FeedbackHeadingTitle => IsEn ? "My inbox" : "내 문의함";
    public string FeedbackHeadingSubtitle => IsEn
        ? "Send a question, report a problem, or share an idea. Replies from the ottline team appear here."
        : "질문이나 불편한 점, 아이디어를 남겨주세요. ottline의 답변도 여기에서 확인할 수 있어요.";
    public string FeedbackNewThreadTitle => IsEn ? "Send a message" : "문의 남기기";
    public string FeedbackCategoryLabel => IsEn ? "Category" : "문의 유형";
    public string FeedbackSubjectLabel => IsEn ? "Subject" : "제목";
    public string FeedbackSubjectPlaceholder => IsEn ? "Example: I can’t find my connection code" : "예: 기록 연결 코드가 보이지 않아요";
    public string FeedbackBodyLabel => IsEn ? "Message" : "내용";
    public string FeedbackBodyPlaceholder => IsEn
        ? "Tell us what you are trying to do and what went wrong."
        : "무엇이 궁금한지, 어떤 상황에서 문제가 발생했는지 자세히 남겨주세요.";
    public string FeedbackCreateNotice => IsEn ? "Replies will appear in this inbox." : "답변은 이 문의함에서 확인할 수 있어요.";
    public string FeedbackSubmitAction => IsEn ? "Send message" : "문의 보내기";
    public string FeedbackMyThreadsTitle => IsEn ? "My messages" : "내 문의 목록";
    public string FeedbackEmptyThreads => IsEn ? "You haven’t sent any messages yet." : "아직 보낸 문의가 없어요.";
    public string FeedbackEmptyDetail => IsEn ? "Select a message from the list to view the conversation." : "목록에서 문의를 선택하면 대화 내용을 볼 수 있어요.";
    public string QuickSuggestionsHeader => IsEn ? "Titles shared together" : "요즘 함께 하는 작품들";
    public string GuidesHeadingTitle => IsEn ? "How does it work?" : "어떻게 사용하나요?";
    public string GuidesBodyText => IsEn
        ? "1. Search a title: Tap the record button on Home to open search and find a movie, series, or book.\n2. Choose a status and keep the record: Pick whether you finished it, are in the middle of it, or want to save it for later. Tap ‘Keep this record’ below to add it to your timeline.\n3. Add more when you want to remember more: Your record is kept on this device first. Add the date, place, platform, a note, or one of three feelings—or leave it as is."
        : "1. 작품 검색: 홈에서 기록 버튼을 눌러 검색창을 열고, 영화·시리즈·책 제목을 찾아보세요.\n2. 상태를 골라 기록 남기기: 다 봤는지·읽었는지, 이어가는 중인지, 나중에 보고·읽고 싶은지 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요.\n3. 더 기억하고 싶을 때 덧붙이기: 기록은 먼저 이 기기에 보관돼요. 날짜·장소·플랫폼·메모를 더하거나 세 가지 느낌 중 하나를 골라도, 이대로 두어도 괜찮아요.";

    // Modals: Title Detail, Quick Record, Together Discussion, Share Sheet
    public string DetailBackToTimeline => IsEn ? "← Timeline" : "← 타임라인";
    public string DetailWhenLabel => IsEn ? "When" : "언제";
    public string DetailPolishAction => IsEn ? "Edit this record" : "기록 수정하기";
    public string DetailShareCardAction => IsEn ? "Create a share card" : "공유 카드 만들기";
    public string DetailToggleSpoilerAction => IsEn ? "Show / Hide spoiler" : "스포일러 보기/숨기기";
    public string DetailHistoryHeading => IsEn
        ? "Record history"
        : "남겨온 기록";

    public string QuickModalEyebrow => "ON THE TIMELINE";
    public string QuickModalHeading => IsEn ? "What story will you keep today?" : "오늘은 어떤 이야기를 남길까요?";
    public string QuickFilterVideoLabel => IsEn ? "Video" : "영상";
    public string QuickFilterBookLabel => IsEn ? "Book" : "책";
    public string QuickSelectAction => IsEn ? "Select →" : "선택 →";
    public string QuickManualAddVideo => IsEn ? "+ New Video" : "+ 새로운 비디오";
    public string QuickManualAddBook => IsEn ? "+ New Book" : "+ 새로운 책";
    public string QuickChangeTitleButton => IsEn ? "Choose another title" : "다른 작품 찾기";
    public string QuickWarmthLabel => IsEn ? "How did it feel? (optional)" : "어떤 느낌으로 남았나요? (선택)";
    public string QuickStatusDoneBtn => IsEn ? "Watched / Read" : "봤어요 / 읽었어요";
    public string QuickStatusInProgressBtn => IsEn ? "Watching / Reading" : "보는 중 / 읽는 중";
    public string QuickStatusWishlistBtn => IsEn ? "Want to watch / Want to read" : "보고 싶어요 / 읽고 싶어요";
    public string QuickFeelingSatisfiedBtn => IsEn ? "Excellent" : "최고예요";
    public string QuickFeelingNeutralBtn => IsEn ? "Worth watching" : "볼만해요";
    public string QuickFeelingDisappointedBtn => IsEn ? "Disappointing" : "아쉬워요";
    public string QuickWhenInputLabel => IsEn ? "Date" : "날짜";
    public string QuickPlatformNoneOption => IsEn ? "None" : "선택 안 함";
    public string QuickPlatformCustomOption => IsEn ? "Custom input" : "직접 입력";
    public string QuickPlatformCustomPlaceholder => IsEn ? "Enter platform" : "플랫폼 직접 입력";
    public string QuickPlaceInputLabel => IsEn ? "Place" : "장소";
    public string QuickOccasionInputLabel => IsEn ? "Who you were with or the occasion" : "누구와·어떤 상황";
    public string QuickNoteInputLabel => IsEn ? "Note" : "메모";
    public string QuickSaveToTimelineBtn => IsEn ? "Keep this record" : "기록 남기기";
    public string QuickSavedBannerText => IsEn
        ? "Kept on your timeline."
        : "타임라인에 남겨두었어요.";
    public string QuickKeepPolishingBtn => IsEn ? "Add to this moment" : "그날의 순간·메모 더하기";
    public string QuickStatusDoneForType(bool isBook) =>
        isBook ? (IsEn ? "Read" : "읽었어요") : (IsEn ? "Watched" : "봤어요");
    public string QuickStatusInProgressForType(bool isBook) =>
        isBook ? (IsEn ? "Reading" : "읽는 중") : (IsEn ? "Watching" : "보는 중");
    public string QuickStatusWishlistForType(bool isBook) =>
        isBook ? (IsEn ? "Want to read" : "읽고 싶어요") : (IsEn ? "Want to watch" : "보고 싶어요");

    public string DiscussionSendCommentBtn => IsEn ? "Post comment" : "댓글 등록";
    public string DiscussionNewModalTitle => IsEn ? "Leave a thought" : "의견 남기기";
    public string DiscussionTitleLabel => IsEn ? "Find a title" : "작품 찾기";
    public string DiscussionBodyLabel => IsEn ? "Leave a line about this title." : "이 작품에 대한 한 줄을 남겨주세요.";
    public string DiscussionSubmitBtn => IsEn ? "Post comment" : "댓글 등록";

    public string ShareSheetTitle => IsEn ? "Create a share card" : "공유 카드 만들기";
    public string ShareSheetSubtitle => IsEn
        ? "Share your saved record as a card."
        : "저장한 기록을 공유 카드로 나눠보세요.";
    public string ShareShowRatingLabel => IsEn ? "Include feeling" : "느낌 포함";
    public string ShareShowNoteLabel => IsEn ? "Include note" : "한 줄 메모 포함";
    public string ShareShowSignatureLabel => IsEn ? "Include avatar and nickname" : "아바타와 닉네임 포함";
    public string ShareRatioLabel => IsEn ? "Image ratio" : "이미지 비율";
    public string ShareRatioStoryBtn => IsEn ? "Story 9:16" : "스토리 9:16";
    public string ShareRatioFeedBtn => IsEn ? "Feed 4:5" : "피드 4:5";
    public string ShareWindowsNativeBtn => IsEn ? "Share" : "공유하기";
    public string ShareCopyClipboardBtn => IsEn ? "Copy image" : "이미지 복사";
    public string ShareSavePngBtn => IsEn ? "Save image" : "이미지 저장";
    public string ShareWindowsHint => IsEn
        ? "Share your saved record as a card."
        : "저장한 기록을 공유 카드로 나눠보세요.";

    public static readonly OttlineStrings Korean = new(
        Locale: "ko",
        BrandName: "ottline",
        BrandTagline: "보고 읽은 순간을 나의 타임라인에.",
        NavHome: "홈",
        NavTimeline: "타임라인",
        NavTogether: "함께",
        NavMySpace: "내 공간",
        QuickRecordButton: "기록 남기기",
        QuickRecordShortcutHint: "Ctrl+K",
        SyncNowButton: "다시 시도",
        SyncedLabel: "동기화 완료",
        SyncPendingLabel: "다른 기기에 아직 반영되지 않은 기록이 있어요.",
        OfflineLabel: "이 기기에 보관 중",
        HomeEditorialGreeting: "내 시간 위에 쌓인 이야기",
        HomeEditorialSubtitle: "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
        HomeMonthCompletedTitle: "이 달에 남긴 시간",
        HomeWarmthSectionTitle: "그날의 온기",
        HomeWarmthSectionSubtitle: "이 달에 남겨둔 순간이에요.",
        HomeUnfinishedTitle: "아직 못다 한 이야기",
        HomeUnfinishedSubtitle: "이어가는 이야기와 아껴둔 작품은 타임라인에서 함께 볼 수 있어요.",
        HomeMomentsTitle: "다시 만나는 그날",
        HomeMomentsSubtitle: "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요.",
        HomeStarterTitle: "나의 타임라인에 첫 순간을 남겨요.",
        HomeStarterBody: "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
        HomeStarterCta: "첫 기록 남기기",
        HomeHandoffBannerTitle: "이미 남긴 기록 이어보기",
        HomeHandoffBannerBody: "다른 기기의 내 공간에서 이 코드를 입력하면 같은 기록을 열 수 있어요.",
        HomeHandoffWebButton: "이미 남긴 기록 이어보기",
        HomeHandoffCodeButton: "기록 연결 코드 입력",
        TimelineTitle: "내 타임라인",
        TimelineSearchPlaceholder: "제목, 메모, 플랫폼",
        FilterAll: "전체",
        FilterVideo: "영상",
        FilterBook: "책",
        MomentFilterToggle: "그날의 순간으로 찾기",
        ClearFiltersButton: "조건 지우기",
        FutureRecommendationsTitle: "미래의 타임라인",
        FutureRecommendationsSubtitle: "남겨둔 이야기에서 다음에 만날 작품을 고르고 있어요.",
        ExportCsvButton: "CSV 다운로드",
        LoadMoreButton: "이전 기록 더 보기",
        DetailWarmthCardTitle: "그날의 온기",
        DetailPolishButton: "기록 수정하기",
        DetailShareCardButton: "공유 카드 만들기",
        DetailHistoryTitle: "남겨온 기록",
        DetailHistorySubtitle: "기록을 고칠 때마다 그때의 모습이 차곡차곡 남아요.",
        DetailNoDeletePolicyNotice: "내 기록은 직접 공개하기 전까지 나에게만 보여요.",
        SpoilerHiddenNotice: "스포일러가 포함된 기록입니다.",
        SpoilerRevealButton: "내용 보기",
        QuickRecordModalTitle: "오늘은 어떤 이야기를 남길까요?",
        QuickRecordSearchPlaceholder: "작품 검색 (예: 듄, 더 베어)",
        QuickRecordManualVideoButton: "새로운 비디오",
        QuickRecordManualBookButton: "새로운 책",
        StatusDoneLabel: "봤어요",
        StatusInProgressLabel: "보는 중",
        StatusWishlistLabel: "보고 싶어요",
        FeelingSatisfiedLabel: "최고예요",
        FeelingNeutralLabel: "볼만해요",
        FeelingDisappointedLabel: "아쉬워요",
        DateLabel: "날짜",
        PlatformLabel: "플랫폼",
        PlaceLabel: "어디서",
        OccasionLabel: "누구와·어떤 상황",
        NoteLabel: "메모",
        NotePlaceholder: "나중에 떠올리고 싶은 장면이나 마음을 적어두세요.",
        SpoilerCheckLabel: "스포일러 포함",
        ShareTogetherCheckLabel: "함께 나누기",
        SaveRecordButton: "기록 남기기",
        SavedCelebrationTitle: "타임라인에 남겨두었어요.",
        SavedCelebrationSubtitle: "더 남기고 싶을 때 그날의 순간과 메모를 더해요.",
        TogetherTitle: "함께 하는 발자취",
        TogetherSubtitle: "다른 사람들은 요즘 무엇을 보고 읽을까요?",
        WriteTogetherButton: "의견 남기기",
        ReactionDoneLabel: "나도 봤어요",
        ReactionCuriousLabel: "궁금해요",
        ReactionSaveLabel: "저장해둘래요",
        CommentPlaceholder: "이 작품에 대한 한 줄을 남겨주세요.",
        MentionHint: "@로 추가할 작품을 검색",
        MySpaceTitle: "내 공간",
        ProfileSectionTitle: "나의 프로필",
        SyncSectionTitle: "내 기록 이어보기",
        RecoveryCodeLabel: "나의 기록 연결 코드",
        CopyCodeButton: "코드 복사",
        ExportRecoveryCardButton: "보관 카드 저장",
        PairDeviceTitle: "다른 기기에 기록이 있나요?",
        PairCodePlaceholder: "기록 연결 코드 입력",
        PreviewPairButton: "연결하기",
        ConfirmMergeButton: "연결하기",
        LinkedDevicesTitle: "연결된 기기",
        PersonalReportTitle: "내 이용 리포트",
        ExportRecapCardButton: "주간 카드 공유",
        BookshelfTitle: "내 서가",
        WatchReminderTitle: "시청 기록 알림 설정",
        WatchReminderDescription: "OTT 앱을 닫은 뒤 기록 화면으로 이어지는 알림을 받을 수 있어요.",
        WatchReminderTestButton: "시청 기록 알림 켜기",
        FeedbackTitle: "내 문의함",
        GuidesTitle: "기록 가이드",
        NetflixImportTitle: "넷플릭스 시청 기록 (CSV) 가져오기",
        LocalResetButton: "로컬 데이터 초기화",
        ServerDeleteAccountButton: "서버 데이터 전체 삭제",
        DebugServerTitle: "서버 설정"
    );

    public static readonly OttlineStrings English = new(
        Locale: "en",
        BrandName: "ottline",
        BrandTagline: "What you watch and read, kept on your timeline.",
        NavHome: "Home",
        NavTimeline: "Timeline",
        NavTogether: "Together",
        NavMySpace: "My space",
        QuickRecordButton: "Leave a record",
        QuickRecordShortcutHint: "Ctrl+K",
        SyncNowButton: "Retry",
        SyncedLabel: "Synced",
        SyncPendingLabel: "Some changes haven’t synced yet.",
        OfflineLabel: "Kept on this device",
        HomeEditorialGreeting: "Stories on your timeline",
        HomeEditorialSubtitle: "A film, a series, a book. Start with one you want to keep.",
        HomeMonthCompletedTitle: "Moments this month",
        HomeWarmthSectionTitle: "A moment kept",
        HomeWarmthSectionSubtitle: "A moment you kept this month.",
        HomeUnfinishedTitle: "Stories still unfolding",
        HomeUnfinishedSubtitle: "Your ongoing stories and saved titles are together on your timeline.",
        HomeMomentsTitle: "BACK TO A MOMENT",
        HomeMomentsSubtitle: "Revisit moments from the records kept on this device.",
        HomeStarterTitle: "Your timeline. Your first moment.",
        HomeStarterBody: "A film, a series, a book. Start with one you want to keep.",
        HomeStarterCta: "Leave your first record",
        HomeHandoffBannerTitle: "Bring my existing records",
        HomeHandoffBannerBody: "Enter this code in My space on another device to open the same records.",
        HomeHandoffWebButton: "Bring my existing records",
        HomeHandoffCodeButton: "Enter connection code",
        TimelineTitle: "My Timeline",
        TimelineSearchPlaceholder: "Title, note, platform",
        FilterAll: "All",
        FilterVideo: "Video",
        FilterBook: "Book",
        MomentFilterToggle: "Find a moment",
        ClearFiltersButton: "Clear filters",
        FutureRecommendationsTitle: "Future timeline",
        FutureRecommendationsSubtitle: "Looking through your saved records for the next story to meet.",
        ExportCsvButton: "Export CSV",
        LoadMoreButton: "Load earlier records",
        DetailWarmthCardTitle: "The moment",
        DetailPolishButton: "Edit this record",
        DetailShareCardButton: "Create a share card",
        DetailHistoryTitle: "Record history",
        DetailHistorySubtitle: "Each time you edit a record, that version is kept here.",
        DetailNoDeletePolicyNotice: "Your record stays private until you choose to share it.",
        SpoilerHiddenNotice: "This record contains spoilers.",
        SpoilerRevealButton: "Show note",
        QuickRecordModalTitle: "What story will you keep today?",
        QuickRecordSearchPlaceholder: "Search titles (e.g., Dune, The Bear)",
        QuickRecordManualVideoButton: "New Video",
        QuickRecordManualBookButton: "New Book",
        StatusDoneLabel: "Watched",
        StatusInProgressLabel: "Watching",
        StatusWishlistLabel: "Want to watch",
        FeelingSatisfiedLabel: "Excellent",
        FeelingNeutralLabel: "Worth watching",
        FeelingDisappointedLabel: "Disappointing",
        DateLabel: "Date",
        PlatformLabel: "Platform",
        PlaceLabel: "Where",
        OccasionLabel: "Who you were with or the occasion",
        NoteLabel: "Note",
        NotePlaceholder: "Jot down a scene or feeling you want to remember later.",
        SpoilerCheckLabel: "Spoiler",
        ShareTogetherCheckLabel: "Share to Together",
        SaveRecordButton: "Keep this record",
        SavedCelebrationTitle: "Kept on your timeline.",
        SavedCelebrationSubtitle: "Add the moment and a note whenever you want.",
        TogetherTitle: "Shared Footprints",
        TogetherSubtitle: "What are others watching and reading lately?",
        WriteTogetherButton: "Leave a thought",
        ReactionDoneLabel: "Watched it too",
        ReactionCuriousLabel: "Curious",
        ReactionSaveLabel: "Save for later",
        CommentPlaceholder: "Leave a line about this title.",
        MentionHint: "Search a title to mention with @",
        MySpaceTitle: "My space",
        ProfileSectionTitle: "My profile",
        SyncSectionTitle: "Keep your records with you",
        RecoveryCodeLabel: "My record connection code",
        CopyCodeButton: "Copy code",
        ExportRecoveryCardButton: "Save recovery card",
        PairDeviceTitle: "Have records on another device?",
        PairCodePlaceholder: "Enter connection code",
        PreviewPairButton: "Connect",
        ConfirmMergeButton: "Connect",
        LinkedDevicesTitle: "Connected devices",
        PersonalReportTitle: "My Usage Report",
        ExportRecapCardButton: "Share weekly card",
        BookshelfTitle: "My bookshelf",
        WatchReminderTitle: "Watch reminder settings",
        WatchReminderDescription: "Get a notification that opens the logging screen after you close an OTT app.",
        WatchReminderTestButton: "Turn on watch reminders",
        FeedbackTitle: "My inbox",
        GuidesTitle: "Recording guides",
        NetflixImportTitle: "Import Netflix viewing history (CSV)",
        LocalResetButton: "Reset local data",
        ServerDeleteAccountButton: "Delete all server data",
        DebugServerTitle: "Server settings"
    );
}
