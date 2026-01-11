import 'package:dio/dio.dart';

import '../../../core/models/watch_log.dart';

class LogApi {
  LogApi(this._dio);

  final Dio _dio;

  Future<List<WatchLog>> fetchLogs({
    int limit = 20,
    String? status,
    String? ott,
    String? place,
    String? occasion,
    String? titleId,
  }) async {
    final response = await _dio.get(
      '/api/logs',
      queryParameters: {
        'limit': limit,
        if (status != null) 'status': status,
        if (ott != null) 'ott': ott,
        if (place != null) 'place': place,
        if (occasion != null) 'occasion': occasion,
        if (titleId != null) 'titleId': titleId,
      },
    );

    final data = response.data as List<dynamic>;
    return data
        .map((item) => WatchLog.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<WatchLog> createLog(Map<String, dynamic> payload) async {
    final response = await _dio.post('/api/logs', data: payload);
    return WatchLog.fromJson(response.data as Map<String, dynamic>);
  }

  Future<WatchLog> updateLog(String id, Map<String, dynamic> payload) async {
    final response = await _dio.patch('/api/logs/$id', data: payload);
    return WatchLog.fromJson(response.data as Map<String, dynamic>);
  }
}
