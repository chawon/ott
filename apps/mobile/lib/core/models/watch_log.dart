import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'watch_log.freezed.dart';
part 'watch_log.g.dart';

@freezed
abstract class WatchLog with _$WatchLog {
  const factory WatchLog({
    required String id,
    required String titleId,
    required String status,
    double? rating,
    String? note,
    String? ott,
    DateTime? watchedAt,
    Place? place,
    Occasion? occasion,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _WatchLog;

  factory WatchLog.fromJson(Map<String, dynamic> json) =>
      _$WatchLogFromJson(json);
}
