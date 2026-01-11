import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/comment.dart';
import 'package:mobile/core/models/discussion_list_item.dart';
import 'package:mobile/features/public/data/public_repository.dart';

final publicFeedProvider = FutureProvider.autoDispose<PublicFeed>((ref) async {
  final repository = ref.watch(publicRepositoryProvider);
  return repository.fetchFeed();
});

final publicDiscussionProvider = FutureProvider.autoDispose
    .family<DiscussionListItem, String>((ref, id) async {
  final repository = ref.watch(publicRepositoryProvider);
  return repository.fetchById(id);
});

final publicCommentsProvider = FutureProvider.autoDispose
    .family<List<Comment>, String>((ref, id) async {
  final repository = ref.watch(publicRepositoryProvider);
  return repository.fetchComments(id);
});
