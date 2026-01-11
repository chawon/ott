import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/logs/presentation/recent_logs_provider.dart';
import 'package:mobile/features/quicklog/presentation/quick_log_card.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(recentLogsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(KrText.appTitle),
      ),
      body: logs.when(
        data: (items) {
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(recentLogsProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length + 1,
              separatorBuilder: (_, __) => const Divider(),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return const QuickLogCard();
                }

                final item = items[index - 1];
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
