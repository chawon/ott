import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/models/comment.dart';
import 'package:mobile/core/models/discussion_list_item.dart';
import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/public/presentation/public_providers.dart';

class PublicDetailPage extends ConsumerWidget {
  const PublicDetailPage({super.key, required this.discussionId});

  final String discussionId;

  String _formatDateTime(DateTime? date) {
    if (date == null) return '';
    final mm = date.month.toString().padLeft(2, '0');
    final dd = date.day.toString().padLeft(2, '0');
    final hh = date.hour.toString().padLeft(2, '0');
    final min = date.minute.toString().padLeft(2, '0');
    return '${date.year}.$mm.$dd $hh:$min';
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'movie':
        return '영화';
      case 'series':
        return '시리즈';
      default:
        return type;
    }
  }

  Widget _buildHeader(
    BuildContext context,
    DiscussionListItem item,
  ) {
    final subtitleParts = <String>[];
    final typeLabel = _typeLabel(item.titleType);
    if (typeLabel.isNotEmpty) subtitleParts.add(typeLabel);
    if (item.titleYear != null) subtitleParts.add('${item.titleYear}');

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.go('/title/${item.titleId}'),
      child: Ink(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 64,
                  height: 86,
                  color: Theme.of(context).colorScheme.surfaceVariant,
                  child: item.posterUrl == null
                      ? const Icon(Icons.movie_outlined)
                      : Image.network(
                          item.posterUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Icon(Icons.broken_image_outlined),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.titleName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitleParts.join(' · '),
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: Colors.grey[700]),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.chat_bubble_outline,
                            size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          '${item.commentCount}개 댓글',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCommentCard(BuildContext context, Comment comment) {
    final timeLabel = _formatDateTime(comment.createdAt);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                comment.authorName,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (timeLabel.isNotEmpty)
                Text(
                  timeLabel,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.grey[600]),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(comment.body),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final discussion = ref.watch(publicDiscussionProvider(discussionId));
    final comments = ref.watch(publicCommentsProvider(discussionId));

    return discussion.when(
      data: (item) {
        return Scaffold(
          appBar: AppBar(title: const Text(KrText.publicTab)),
          body: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(publicDiscussionProvider(discussionId));
              ref.invalidate(publicCommentsProvider(discussionId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                _buildHeader(context, item),
                const SizedBox(height: 16),
                const Text(
                  '댓글',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                comments.when(
                  data: (items) {
                    if (items.isEmpty) {
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceVariant,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text('댓글이 아직 없어요'),
                      );
                    }

                    return Column(
                      children: items
                          .map((comment) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _buildCommentCard(context, comment),
                              ))
                          .toList(),
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (err, _) => Text('Error: $err'),
                ),
              ],
            ),
          ),
        );
      },
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (err, _) => Scaffold(
        appBar: AppBar(title: const Text(KrText.publicTab)),
        body: Center(child: Text('Error: $err')),
      ),
    );
  }
}
