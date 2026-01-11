import 'package:drift/drift.dart';

import 'package:mobile/core/db/app_database.dart' as db;
import 'package:mobile/core/models/enums.dart';
import 'package:mobile/core/models/watch_log.dart' as model;

class LogLocalDataSource {
  LogLocalDataSource(this._db);

  final db.AppDatabase _db;

  Stream<List<model.WatchLog>> watchRecent({int limit = 20}) {
    final query = (_db.select(_db.watchLogs)
          ..orderBy([(t) => OrderingTerm.desc(t.watchedAt)])
          ..limit(limit))
        .watch();

    return query.map((rows) => rows.map(_toModel).toList());
  }

  Future<void> upsertAll(List<model.WatchLog> logs) async {
    await _db.batch((batch) {
      batch.insertAllOnConflictUpdate(
        _db.watchLogs,
        logs.map(_toCompanion).toList(),
      );
    });
  }

  model.WatchLog _toModel(db.WatchLogRow data) {
    return model.WatchLog(
      id: data.id,
      titleId: data.titleId,
      status: data.status,
      rating: data.rating,
      note: data.note,
      ott: data.ott,
      watchedAt: data.watchedAt,
      place: _parsePlace(data.place),
      occasion: _parseOccasion(data.occasion),
      updatedAt: data.updatedAt,
    );
  }

  db.WatchLogsCompanion _toCompanion(model.WatchLog log) {
    return db.WatchLogsCompanion(
      id: Value(log.id),
      titleId: Value(log.titleId),
      status: Value(log.status),
      rating: Value(log.rating),
      note: Value(log.note),
      ott: Value(log.ott),
      watchedAt: Value(log.watchedAt),
      place: Value(_enumToDb(log.place)),
      occasion: Value(_enumToDb(log.occasion)),
      updatedAt: Value(log.updatedAt ?? DateTime.now()),
      deletedAt: const Value(null),
    );
  }

  Place? _parsePlace(String? raw) {
    if (raw == null) return null;
    return Place.values.firstWhere(
      (e) => e.name.toUpperCase() == raw,
      orElse: () => Place.etc,
    );
  }

  Occasion? _parseOccasion(String? raw) {
    if (raw == null) return null;
    return Occasion.values.firstWhere(
      (e) => e.name.toUpperCase() == raw,
      orElse: () => Occasion.etc,
    );
  }

  String? _enumToDb(dynamic value) {
    if (value == null) return null;
    return value.name.toUpperCase();
  }
}
