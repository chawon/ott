import {
  logCopy,
  occasionLabels,
  placeLabels,
  type NativeLocale,
} from './i18n';
import type { Occasion, Place, TitleType } from './types';

export type LogSelectOption = {
  value: string;
  label: string;
};

export type LogSelectSection = {
  label?: string;
  options: LogSelectOption[];
};

export const VIDEO_PLACE_VALUES: Place[] = [
  'HOME',
  'THEATER',
  'TRANSIT',
  'CAFE',
  'OFFICE',
  'ETC',
];

export const BOOK_PLACE_VALUES: Place[] = [
  'HOME',
  'CAFE',
  'LIBRARY',
  'BOOKSTORE',
  'SCHOOL',
  'PARK',
  'OUTDOOR',
  'TRANSIT',
  'ETC',
];

export const OCCASION_VALUES: Occasion[] = ['ALONE', 'DATE', 'FAMILY', 'FRIENDS', 'BREAK', 'ETC'];

function optionType(type?: TitleType) {
  return type === 'book' ? 'book' : 'movie';
}

export function placeOptionsForTitleType(type: TitleType | undefined, locale: NativeLocale): LogSelectOption[] {
  const values = optionType(type) === 'book' ? BOOK_PLACE_VALUES : VIDEO_PLACE_VALUES;
  return values.map((value) => ({ value, label: placeLabels[locale][value] }));
}

export function occasionOptions(locale: NativeLocale): LogSelectOption[] {
  return OCCASION_VALUES.map((value) => ({ value, label: occasionLabels[locale][value] }));
}

export function ratingOptionsForTitleType(type: TitleType | undefined, locale: NativeLocale): LogSelectOption[] {
  const copy = logCopy[locale];
  return optionType(type) === 'book'
    ? [
        { value: '5', label: `📚 ${copy.ratingBestBook}` },
        { value: '3', label: `🙂 ${copy.ratingSosoBook}` },
        { value: '1', label: `😕 ${copy.ratingBadBook}` },
      ]
    : [
        { value: '5', label: `😍 ${copy.ratingBestVideo}` },
        { value: '3', label: `🙂 ${copy.ratingSosoVideo}` },
        { value: '1', label: `😕 ${copy.ratingBadVideo}` },
      ];
}

export function ratingLabelForValue(
  value: string | number | null | undefined,
  type: TitleType | undefined,
  locale: NativeLocale,
) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const bucket = parsed >= 5 ? 5 : parsed >= 3 ? 3 : 1;
  return ratingOptionsForTitleType(type, locale).find((option) => Number(option.value) === bucket)?.label ?? null;
}

export function platformSectionsForTitleType(type: TitleType | undefined, locale: NativeLocale): LogSelectSection[] {
  const copy = logCopy[locale];

  if (optionType(type) === 'book') {
    return [
      {
        label: copy.groupBookstore,
        options: [
          { value: copy.platformKyobo, label: copy.platformKyobo },
          { value: copy.platformYeongpung, label: copy.platformYeongpung },
          { value: copy.platformYes24, label: copy.platformYes24 },
          { value: copy.platformAladin, label: copy.platformAladin },
        ],
      },
      {
        label: copy.groupEbook,
        options: [
          { value: copy.platformRidi, label: copy.platformRidi },
          { value: copy.platformMillie, label: copy.platformMillie },
          { value: copy.platformWilla, label: copy.platformWilla },
          { value: copy.platformPlaybook, label: copy.platformPlaybook },
        ],
      },
      {
        label: copy.groupLibrary,
        options: [
          { value: copy.platformPublicLib, label: copy.platformPublicLib },
          { value: copy.platformUnivLib, label: copy.platformUnivLib },
          { value: copy.platformSchoolLib, label: copy.platformSchoolLib },
        ],
      },
    ];
  }

  return [
    {
      label: copy.groupOtt,
      options: [
        { value: copy.platformNetflix, label: copy.platformNetflix },
        { value: copy.platformDisney, label: copy.platformDisney },
        { value: copy.platformTving, label: copy.platformTving },
        { value: copy.platformWavve, label: copy.platformWavve },
        { value: copy.platformCoupang, label: copy.platformCoupang },
        { value: copy.platformApple, label: copy.platformApple },
        { value: copy.platformPrime, label: copy.platformPrime },
        { value: copy.platformWatcha, label: copy.platformWatcha },
      ],
    },
    {
      label: copy.groupPaidTv,
      options: [
        { value: copy.platformChannel, label: copy.platformChannel },
        { value: copy.platformVod, label: copy.platformVod },
      ],
    },
    {
      label: copy.groupPhysical,
      options: [
        { value: copy.platformDvd, label: copy.platformDvd },
        { value: copy.platformBluray, label: copy.platformBluray },
      ],
    },
    {
      label: copy.groupTheater,
      options: [
        { value: copy.platformCgv, label: copy.platformCgv },
        { value: copy.platformLotte, label: copy.platformLotte },
        { value: copy.platformMegabox, label: copy.platformMegabox },
        { value: copy.platformCineQ, label: copy.platformCineQ },
      ],
    },
  ];
}

export function flatPlatformOptions(type: TitleType | undefined, locale: NativeLocale): LogSelectOption[] {
  return platformSectionsForTitleType(type, locale).flatMap((section) => section.options);
}
