import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

@DataClassName('TitleRow')
class Titles extends Table {
  TextColumn get id => text()();
  TextColumn get provider => text()();
  TextColumn get providerId => text()();
  TextColumn get type => text()();
  TextColumn get name => text()();
  TextColumn get year => text().nullable()();
  TextColumn get posterUrl => text().nullable()();
  TextColumn get overview => text().nullable()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class TitleSearchCache extends Table {
  TextColumn get provider => text()();
  TextColumn get providerId => text()();
  TextColumn get type => text()();
  TextColumn get name => text()();
  TextColumn get year => text().nullable()();
  TextColumn get posterUrl => text().nullable()();
  TextColumn get overview => text().nullable()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {provider, providerId};
}

@DataClassName('WatchLogRow')
class WatchLogs extends Table {
  TextColumn get id => text()();
  TextColumn get titleId => text()();
  TextColumn get status => text()();
  RealColumn get rating => real().nullable()();
  TextColumn get note => text().nullable()();
  TextColumn get ott => text().nullable()();
  DateTimeColumn get watchedAt => dateTime().nullable()();
  TextColumn get place => text().nullable()();
  TextColumn get occasion => text().nullable()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class WatchLogHistory extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get logId => text()();
  DateTimeColumn get recordedAt => dateTime()();
  TextColumn get status => text()();
  RealColumn get rating => real().nullable()();
  TextColumn get note => text().nullable()();
  TextColumn get ott => text().nullable()();
  DateTimeColumn get watchedAt => dateTime().nullable()();
  TextColumn get place => text().nullable()();
  TextColumn get occasion => text().nullable()();
}

class Outbox extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entity => text()();
  TextColumn get op => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get createdAt => dateTime()();
  TextColumn get status => text()();
  TextColumn get error => text().nullable()();
}

@DriftDatabase(tables: [Titles, TitleSearchCache, WatchLogs, WatchLogHistory, Outbox])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.createTable(titleSearchCache);
          }
        },
      );
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'ott.sqlite'));
    return NativeDatabase(file);
  });
}
