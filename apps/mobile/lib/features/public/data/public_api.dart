import 'package:dio/dio.dart';

import 'package:mobile/core/models/comment.dart';
import 'package:mobile/core/models/discussion.dart';
import 'package:mobile/core/models/discussion_list_item.dart';

class PublicApi {
  PublicApi(this._dio);

  final Dio _dio;

  Future<List<DiscussionListItem>> fetchLatest({int limit = 6}) async {
    final response = await _dio.get(
      '/api/discussions/latest',
      queryParameters: {'limit': limit},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((item) =>
            DiscussionListItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<DiscussionListItem>> fetchAll({int limit = 100}) async {
    final response = await _dio.get(
      '/api/discussions/all',
      queryParameters: {'limit': limit},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((item) =>
            DiscussionListItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<DiscussionListItem> fetchById(String id) async {
    final response = await _dio.get('/api/discussions/$id');
    return DiscussionListItem.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<Discussion?> fetchByTitle(String titleId) async {
    final response = await _dio.get(
      '/api/discussions',
      queryParameters: {'titleId': titleId},
    );
    if (response.data == null) return null;
    return Discussion.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<Comment>> fetchComments(String discussionId, {int limit = 100}) async {
    final response = await _dio.get(
      '/api/discussions/$discussionId/comments',
      queryParameters: {'limit': limit},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((item) => Comment.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Comment> createComment(
    String discussionId,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.post(
      '/api/discussions/$discussionId/comments',
      data: payload,
    );
    return Comment.fromJson(response.data as Map<String, dynamic>);
  }
}
