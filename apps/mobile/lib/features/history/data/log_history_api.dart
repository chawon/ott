import 'package:dio/dio.dart';

import '../../../core/models/watch_log.dart';

class LogHistoryApi {
  LogHistoryApi(this._dio);

  final Dio _dio;

  Future<List<WatchLog>> fetchHistory(String logId, {int limit = 50}) async {
    final response = await _dio.get(
      '/api/logs/$logId/history',
      queryParameters: {'limit': limit},
    );

    final data = response.data as List<dynamic>;
    return data
        .map((item) => WatchLog.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
