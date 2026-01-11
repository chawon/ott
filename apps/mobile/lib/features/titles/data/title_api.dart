import 'package:dio/dio.dart';

import '../../../core/models/title.dart';
import '../../../core/models/title_search_item.dart';

class TitleApi {
  TitleApi(this._dio);

  final Dio _dio;

  Future<List<TitleSearchItem>> search(String query) async {
    final response = await _dio.get('/api/titles/search', queryParameters: {
      'q': query,
    });
    final data = response.data as List<dynamic>;
    return data
        .map((item) => TitleSearchItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Title> getById(String id) async {
    final response = await _dio.get('/api/titles/$id');
    return Title.fromJson(response.data as Map<String, dynamic>);
  }
}
