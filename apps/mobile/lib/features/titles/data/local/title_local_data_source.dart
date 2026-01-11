import 'package:drift/drift.dart';

import 'package:mobile/core/db/app_database.dart' as db;
import 'package:mobile/core/models/title.dart' as model;

class TitleLocalDataSource {
  TitleLocalDataSource(this._db);

  final db.AppDatabase _db;

  Future<void> upsertAll(List<model.Title> titles) async {
    await _db.batch((batch) {
      batch.insertAllOnConflictUpdate(
        _db.titles,
        titles.map(_toCompanion).toList(),
      );
    });
  }

  Future<model.Title?> findById(String id) async {
    final query = _db.select(_db.titles)..where((t) => t.id.equals(id));
    final row = await query.getSingleOrNull();
    if (row == null) return null;
    return _toModel(row);
  }

  model.Title _toModel(db.TitleRow data) {
    return model.Title(
      id: data.id,
      provider: data.provider,
      providerId: data.providerId,
      type: data.type,
      name: data.name,
      year: data.year,
      posterUrl: data.posterUrl,
      overview: data.overview,
    );
  }

  db.TitlesCompanion _toCompanion(model.Title title) {
    return db.TitlesCompanion(
      id: Value(title.id),
      provider: Value(title.provider),
      providerId: Value(title.providerId),
      type: Value(title.type),
      name: Value(title.name),
      year: Value(title.year),
      posterUrl: Value(title.posterUrl),
      overview: Value(title.overview),
      updatedAt: Value(DateTime.now()),
      deletedAt: const Value(null),
    );
  }
}
