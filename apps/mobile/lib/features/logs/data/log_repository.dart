import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/app/providers/db_provider.dart';
import 'package:mobile/core/models/watch_log.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/logs/data/log_api.dart';
import 'package:mobile/features/logs/data/local/log_local_data_source.dart';
import 'package:mobile/features/logs/data/remote/log_remote_data_source.dart';

final logApiProvider = Provider<LogApi>((ref) {
  final dio = ref.watch(dioProvider);
  return LogApi(dio);
});

final logRepositoryProvider = Provider<LogRepository>((ref) {
  final api = ref.watch(logApiProvider);
  final db = ref.watch(dbProvider);
  final local = LogLocalDataSource(db);
  final remote = LogRemoteDataSource(api);
  return LogRepository(local: local, remote: remote);
});

class LogRepository {
  LogRepository({required this.local, required this.remote});

  final LogLocalDataSource local;
  final LogRemoteDataSource remote;

  Stream<List<WatchLog>> watchRecent({int limit = 20}) {
    return local.watchRecent(limit: limit);
  }

  Future<void> refreshRecent({int limit = 20}) async {
    final logs = await remote.fetchRecent(limit: limit);
    await local.upsertAll(logs);
  }

  Future<List<WatchLog>> fetchByTitle({required String titleId}) {
    return remote.fetchByTitle(titleId: titleId);
  }

  Future<WatchLog> createLog(Map<String, dynamic> payload) async {
    final created = await remote.createLog(payload);
    await local.upsertAll([created]);
    return created;
  }

  Future<WatchLog> updateLog(String id, Map<String, dynamic> payload) async {
    final updated = await remote.updateLog(id, payload);
    await local.upsertAll([updated]);
    return updated;
  }
}
