import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/title.dart';
import 'package:mobile/core/models/watch_log.dart';
import 'package:mobile/features/logs/data/log_repository.dart';
import 'package:mobile/features/titles/data/title_repository.dart';

class TimelineLogItem {
  TimelineLogItem({required this.log, required this.title});

  final WatchLog log;
  final Title? title;
}

final timelineLogsProvider = StreamProvider.autoDispose<List<TimelineLogItem>>((ref) {
  final logsRepo = ref.watch(logRepositoryProvider);
  final titleRepo = ref.watch(titleRepositoryProvider);

  logsRepo.refreshRecent(limit: 50);

  return logsRepo.watchRecent(limit: 50).asyncMap((logs) async {
    final items = <TimelineLogItem>[];
    for (final log in logs) {
      var title = await titleRepo.findById(log.titleId);
      title ??= await titleRepo.fetchById(log.titleId);
      items.add(TimelineLogItem(log: log, title: title));
    }
    return items;
  });
});
