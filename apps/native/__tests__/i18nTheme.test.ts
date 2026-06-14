import { DarkColors, getThemeColors, LightColors } from '../constants/colors';
import {
  accountCopy,
  feedbackCopy,
  publicDiscussionCopy,
  recapNotificationCopy,
  reportCopy,
  resolveNativeLocale,
  staticInfoFor,
  tabLabels,
  titleDetailCopy,
  logCopy,
  timelineCopy,
  togetherCopy,
} from '../lib/i18n';

describe('native i18n and theme foundations', () => {
  it('resolves Korean separately and falls back to English for other locales', () => {
    expect(resolveNativeLocale('ko-KR')).toBe('ko');
    expect(resolveNativeLocale('en-US')).toBe('en');
    expect(resolveNativeLocale('ja-JP')).toBe('en');
  });

  it('provides localized tab and static info copy', () => {
    expect(tabLabels.ko.log).toBe('기록');
    expect(tabLabels.en.log).toBe('Log');
    expect(timelineCopy.en.title).toBe('My Timeline');
    expect(timelineCopy.ko.title).toBe('내 타임라인');
    expect(logCopy.en.title).toBe('What will you log?');
    expect(logCopy.ko.title).toBe('무엇을 남길까요?');
    expect(togetherCopy.en.title).toBe('Recent public logs');
    expect(togetherCopy.ko.title).toBe('요즘 함께 하는 기록들');
    expect(accountCopy.en.title).toBe('Account and devices');
    expect(accountCopy.ko.title).toBe('계정과 기기 연결');
    expect(accountCopy.en.appearanceTitle).toBe('Appearance');
    expect(accountCopy.ko.appearanceTitle).toBe('화면 모드');
    expect(feedbackCopy.en.listTitle).toBe('Feedback');
    expect(feedbackCopy.ko.listTitle).toBe('문의함');
    expect(reportCopy.en.myReportTitle).toBe('My report');
    expect(reportCopy.ko.myReportTitle).toBe('내 이용 리포트');
    expect(recapNotificationCopy.en.weeklyTitle).toBe('Time to revisit last week');
    expect(recapNotificationCopy.ko.weeklyTitle).toBe('지난주 기록을 돌아볼 시간');
    expect(publicDiscussionCopy.en.defaultTitle).toBe('Public log');
    expect(publicDiscussionCopy.ko.defaultTitle).toBe('함께 기록');
    expect(publicDiscussionCopy.en.reportPostAction).toBe('Report post');
    expect(publicDiscussionCopy.ko.reportPostAction).toBe('공개 글 신고');
    expect(titleDetailCopy.en.defaultTitle).toBe('Title detail');
    expect(titleDetailCopy.ko.defaultTitle).toBe('작품 상세');
    expect(staticInfoFor('en', 'offline').title).toBe('Offline Use');
    expect(staticInfoFor('ko', 'offline').title).toBe('오프라인 사용');
  });

  it('selects light and dark color palettes', () => {
    expect(getThemeColors('light')).toBe(LightColors);
    expect(getThemeColors('dark')).toBe(DarkColors);
    expect(getThemeColors(null)).toBe(LightColors);
  });
});
