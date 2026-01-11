// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'watch_log.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_WatchLog _$WatchLogFromJson(Map<String, dynamic> json) => _WatchLog(
  id: json['id'] as String,
  titleId: json['titleId'] as String,
  status: json['status'] as String,
  rating: (json['rating'] as num?)?.toDouble(),
  note: json['note'] as String?,
  ott: json['ott'] as String?,
  watchedAt: json['watchedAt'] == null
      ? null
      : DateTime.parse(json['watchedAt'] as String),
  place: $enumDecodeNullable(_$PlaceEnumMap, json['place']),
  occasion: $enumDecodeNullable(_$OccasionEnumMap, json['occasion']),
  createdAt: json['createdAt'] == null
      ? null
      : DateTime.parse(json['createdAt'] as String),
  updatedAt: json['updatedAt'] == null
      ? null
      : DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$WatchLogToJson(_WatchLog instance) => <String, dynamic>{
  'id': instance.id,
  'titleId': instance.titleId,
  'status': instance.status,
  'rating': instance.rating,
  'note': instance.note,
  'ott': instance.ott,
  'watchedAt': instance.watchedAt?.toIso8601String(),
  'place': _$PlaceEnumMap[instance.place],
  'occasion': _$OccasionEnumMap[instance.occasion],
  'createdAt': instance.createdAt?.toIso8601String(),
  'updatedAt': instance.updatedAt?.toIso8601String(),
};

const _$PlaceEnumMap = {
  Place.home: 'HOME',
  Place.theater: 'THEATER',
  Place.transit: 'TRANSIT',
  Place.cafe: 'CAFE',
  Place.office: 'OFFICE',
  Place.etc: 'ETC',
};

const _$OccasionEnumMap = {
  Occasion.alone: 'ALONE',
  Occasion.date: 'DATE',
  Occasion.family: 'FAMILY',
  Occasion.friends: 'FRIENDS',
  Occasion.breakTime: 'BREAK_TIME',
  Occasion.etc: 'ETC',
};
