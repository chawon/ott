import 'package:mobile/core/models/watch_log.dart';
import 'package:mobile/features/logs/data/log_api.dart';

class LogRemoteDataSource {
  LogRemoteDataSource(this._api);

  final LogApi _api;

  Future<List<WatchLog>> fetchRecent({int limit = 20}) {
    return _api.fetchLogs(limit: limit);
  }

  Future<List<WatchLog>> fetchByTitle({required String titleId}) {
    return _api.fetchLogs(limit: 1, titleId: titleId);
  }

  Future<WatchLog> createLog(Map<String, dynamic> payload) {
    return _api.createLog(payload);
  }

  Future<WatchLog> updateLog(String id, Map<String, dynamic> payload) {
    return _api.updateLog(id, payload);
  }
}
