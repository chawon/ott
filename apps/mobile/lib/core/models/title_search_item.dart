import 'package:freezed_annotation/freezed_annotation.dart';

part 'title_search_item.freezed.dart';
part 'title_search_item.g.dart';

@freezed
abstract class TitleSearchItem with _$TitleSearchItem {
  const factory TitleSearchItem({
    required String provider,
    required String providerId,
    required String type,
    required String name,
    String? year,
    String? posterUrl,
    String? overview,
  }) = _TitleSearchItem;

  factory TitleSearchItem.fromJson(Map<String, dynamic> json) =>
      _$TitleSearchItemFromJson(json);
}
