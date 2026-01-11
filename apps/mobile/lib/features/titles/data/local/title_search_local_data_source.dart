import 'package:drift/drift.dart';

import 'package:mobile/core/db/app_database.dart' as db;
import 'package:mobile/core/models/title_search_item.dart' as model;

class TitleSearchLocalDataSource {
  TitleSearchLocalDataSource(this._db);

  final db.AppDatabase _db;

  Future<void> upsertAll(List<model.TitleSearchItem> items) async {
    await _db.batch((batch) {
      batch.insertAllOnConflictUpdate(
        _db.titleSearchCache,
        items.map(_toCompanion).toList(),
      );
    });
  }

  Future<List<model.TitleSearchItem>> searchLocal(String query) async {
    final q = query.trim();
    if (q.isEmpty) return [];
    final results = await (_db.select(_db.titleSearchCache)
          ..where((t) => t.name.like('%$q%'))
          ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
          ..limit(20))
        .get();
    return results.map(_toModel).toList();
  }

  model.TitleSearchItem _toModel(db.TitleSearchCacheData data) {
    return model.TitleSearchItem(
      provider: data.provider,
      providerId: data.providerId,
      type: data.type,
      name: data.name,
      year: data.year,
      posterUrl: data.posterUrl,
      overview: data.overview,
    );
  }

  db.TitleSearchCacheCompanion _toCompanion(model.TitleSearchItem item) {
    return db.TitleSearchCacheCompanion(
      provider: Value(item.provider),
      providerId: Value(item.providerId),
      type: Value(item.type),
      name: Value(item.name),
      year: Value(item.year),
      posterUrl: Value(item.posterUrl),
      overview: Value(item.overview),
      updatedAt: Value(DateTime.now()),
    );
  }
}
