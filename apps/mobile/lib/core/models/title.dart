import 'package:freezed_annotation/freezed_annotation.dart';

part 'title.freezed.dart';
part 'title.g.dart';

@freezed
abstract class Title with _$Title {
  const factory Title({
    required String id,
    required String provider,
    required String providerId,
    required String type,
    required String name,
    String? year,
    String? posterUrl,
    String? overview,
  }) = _Title;

  factory Title.fromJson(Map<String, dynamic> json) => _$TitleFromJson(json);
}
