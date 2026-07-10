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
    expect(tabLabels.ko.log).toBe('기록하기');
    expect(tabLabels.ko.account).toBe('설정');
    expect(tabLabels.en.log).toBe('Log');
    expect(tabLabels.en.account).toBe('Settings');
    expect(timelineCopy.en.title).toBe('My Timeline');
    expect(timelineCopy.ko.title).toBe('내 타임라인');
    expect(logCopy.en.title).toBe('Find what you want to remember');
    expect(logCopy.ko.title).toBe('오늘 남길 작품을 찾아볼게요');
    expect(togetherCopy.en.title).toBe('Together Footprints');
    expect(togetherCopy.ko.title).toBe('함께 하는 발자취');
    expect(accountCopy.en.title).toBe('Settings');
    expect(accountCopy.ko.title).toBe('설정');
    expect(accountCopy.en.appearanceTitle).toBe('Appearance');
    expect(accountCopy.ko.appearanceTitle).toBe('화면 모드');
    expect(feedbackCopy.en.listTitle).toBe('My Inbox');
    expect(feedbackCopy.ko.listTitle).toBe('내 문의함');
    expect(reportCopy.en.myReportTitle).toBe('My Usage Report');
    expect(reportCopy.ko.myReportTitle).toBe('내 이용 리포트');
    expect(recapNotificationCopy.en.weeklyTitle).toBe('Time to revisit last week');
    expect(recapNotificationCopy.ko.weeklyTitle).toBe('지난주 기록을 돌아볼 시간');
    expect(publicDiscussionCopy.en.defaultTitle).toBe('Public log');
    expect(publicDiscussionCopy.ko.defaultTitle).toBe('함께 기록');
    expect(publicDiscussionCopy.en.reportPostAction).toBe('Report post');
    expect(publicDiscussionCopy.ko.reportPostAction).toBe('공개 글 신고');
    expect(titleDetailCopy.en.defaultTitle).toBe('Title detail');
    expect(titleDetailCopy.ko.defaultTitle).toBe('작품 상세');
    expect(staticInfoFor('en', 'about').title).toBe('Video and Book Log App & How to Use');
    expect(staticInfoFor('ko', 'about').title).toBe('영상·책 기록 앱 소개 및 사용법');
    expect(staticInfoFor('en', 'faq').title).toBe('Frequently Asked Questions (FAQ)');
    expect(staticInfoFor('ko', 'faq').title).toBe('자주 묻는 질문 (FAQ)');
    expect(staticInfoFor('en', 'offline').title).toBe('You are offline');
    expect(staticInfoFor('ko', 'offline').title).toBe('오프라인 상태입니다');
  });

  it('selects light and dark color palettes', () => {
    expect(getThemeColors('light')).toBe(LightColors);
    expect(getThemeColors('dark')).toBe(DarkColors);
    expect(getThemeColors(null)).toBe(LightColors);
  });

  it('keeps actions, selections, and links semantically distinct', () => {
    expect(LightColors.action).toBe('#ff9933');
    expect(DarkColors.action).toBe('#ff9933');
    expect(LightColors.onAction).toBe('#0f0f0f');
    expect(DarkColors.onAction).toBe('#0f0f0f');
    expect(LightColors.selectedSurface).toBe('#faf5d7');
    expect(DarkColors.selectedSurface).toBe('#3a3027');
    expect(LightColors.link).toBe('#1e4d8c');
    expect(DarkColors.link).toBe(DarkColors.onSurfaceVariant);
    expect(LightColors.selectedSurface).not.toBe(LightColors.action);
    expect(LightColors.link).not.toBe(LightColors.action);
    expect(LightColors.onSelected).not.toBe(LightColors.action);
    expect(DarkColors.selectedSurface).not.toBe(DarkColors.action);
    expect(DarkColors.link).not.toBe(DarkColors.action);
    expect(DarkColors.onSelected).not.toBe(DarkColors.action);
  });
});
