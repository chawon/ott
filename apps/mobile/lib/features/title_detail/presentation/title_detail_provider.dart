import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/title.dart';
import 'package:mobile/core/models/watch_log.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/logs/data/log_repository.dart';
import 'package:mobile/features/history/data/log_history_api.dart';
import 'package:mobile/features/titles/data/title_repository.dart';

class TitleDetailState {
  TitleDetailState({
    required this.title,
    required this.log,
    required this.history,
  });

  final Title title;
  final WatchLog? log;
  final List<WatchLog> history;
}

final logHistoryApiProvider = Provider<LogHistoryApi>((ref) {
  final dio = ref.watch(dioProvider);
  return LogHistoryApi(dio);
});

final titleDetailProvider =
    FutureProvider.family<TitleDetailState, String>((ref, titleId) async {
  final titles = ref.watch(titleRepositoryProvider);
  final logs = ref.watch(logRepositoryProvider);
  final historyApi = ref.watch(logHistoryApiProvider);

  final title = await titles.fetchById(titleId);
  final logList = await logs.fetchByTitle(titleId: titleId);
  final log = logList.isEmpty ? null : logList.first;

  final history = log == null
      ? <WatchLog>[]
      : await historyApi.fetchHistory(log.id, limit: 50);

  return TitleDetailState(title: title, log: log, history: history);
});

final titleDetailRefresherProvider = Provider.family<void Function(), String>((ref, titleId) {
  return () => ref.invalidate(titleDetailProvider(titleId));
});
