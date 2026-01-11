// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'title.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Title _$TitleFromJson(Map<String, dynamic> json) => _Title(
  id: json['id'] as String,
  provider: json['provider'] as String,
  providerId: json['providerId'] as String,
  type: json['type'] as String,
  name: json['name'] as String,
  year: json['year'] as String?,
  posterUrl: json['posterUrl'] as String?,
  overview: json['overview'] as String?,
);

Map<String, dynamic> _$TitleToJson(_Title instance) => <String, dynamic>{
  'id': instance.id,
  'provider': instance.provider,
  'providerId': instance.providerId,
  'type': instance.type,
  'name': instance.name,
  'year': instance.year,
  'posterUrl': instance.posterUrl,
  'overview': instance.overview,
};
