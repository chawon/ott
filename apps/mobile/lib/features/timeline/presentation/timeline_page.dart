import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/timeline/presentation/timeline_logs_provider.dart';

class TimelinePage extends ConsumerWidget {
  const TimelinePage({super.key});

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
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(),
              itemBuilder: (context, index) {
                final item = items[index];
                final title = item.title?.name ?? item.log.titleId;
                final subtitle = item.log.ott == null
                    ? item.log.status
                    : '${item.log.status} · ${item.log.ott}';

                return ListTile(
                  title: Text(title),
                  subtitle: Text(subtitle),
                  trailing: item.log.watchedAt == null
                      ? null
                      : Text('${item.log.watchedAt}'),
                  onTap: () => context.go('/title/${item.log.titleId}'),
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
