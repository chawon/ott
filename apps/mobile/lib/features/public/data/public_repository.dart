import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/comment.dart';
import 'package:mobile/core/models/discussion.dart';
import 'package:mobile/core/models/discussion_list_item.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/public/data/public_api.dart';

final publicApiProvider = Provider<PublicApi>((ref) {
  final dio = ref.watch(dioProvider);
  return PublicApi(dio);
});

final publicRepositoryProvider = Provider<PublicRepository>((ref) {
  final api = ref.watch(publicApiProvider);
  return PublicRepository(api);
});

class PublicFeed {
  const PublicFeed({required this.latest, required this.all});

  final List<DiscussionListItem> latest;
  final List<DiscussionListItem> all;
}

class PublicRepository {
  PublicRepository(this._api);

  final PublicApi _api;

  Future<PublicFeed> fetchFeed({int latestLimit = 6, int allLimit = 100}) async {
    final latest = await _api.fetchLatest(limit: latestLimit);
    final all = await _api.fetchAll(limit: allLimit);
    return PublicFeed(latest: latest, all: all);
  }

  Future<DiscussionListItem> fetchById(String id) => _api.fetchById(id);

  Future<Discussion?> fetchByTitle(String titleId) => _api.fetchByTitle(titleId);

  Future<List<Comment>> fetchComments(String discussionId, {int limit = 100}) {
    return _api.fetchComments(discussionId, limit: limit);
  }

  Future<Comment> createComment(String discussionId, Map<String, dynamic> payload) {
    return _api.createComment(discussionId, payload);
  }
}
