// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'title_search_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_TitleSearchItem _$TitleSearchItemFromJson(Map<String, dynamic> json) =>
    _TitleSearchItem(
      provider: json['provider'] as String,
      providerId: json['providerId'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
      year: json['year'] as String?,
      posterUrl: json['posterUrl'] as String?,
      overview: json['overview'] as String?,
    );

Map<String, dynamic> _$TitleSearchItemToJson(_TitleSearchItem instance) =>
    <String, dynamic>{
      'provider': instance.provider,
      'providerId': instance.providerId,
      'type': instance.type,
      'name': instance.name,
      'year': instance.year,
      'posterUrl': instance.posterUrl,
      'overview': instance.overview,
    };
