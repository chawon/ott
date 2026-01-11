import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/timeline/presentation/timeline_logs_provider.dart';

class TimelinePage extends ConsumerWidget {
  const TimelinePage({super.key});

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    final mm = date.month.toString().padLeft(2, '0');
    final dd = date.day.toString().padLeft(2, '0');
    return '${date.year}.$mm.$dd';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(timelineLogsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(KrText.timeline)),
      body: logs.when(
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text(KrText.homeEmpty));
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(timelineLogsProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = items[index];
                final title = item.title?.name ?? item.log.titleId;
                final dateLabel = _formatDate(item.log.watchedAt);
                final subtitle = item.log.ott == null
                    ? item.log.status
                    : '${item.log.status} · ${item.log.ott}';

                return InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => context.go('/title/${item.log.titleId}'),
                  child: Ink(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Theme.of(context).dividerColor),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  subtitle,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: Colors.grey[700]),
                                ),
                              ],
                            ),
                          ),
                          if (dateLabel.isNotEmpty)
                            Text(
                              dateLabel,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: Colors.grey[600]),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}
