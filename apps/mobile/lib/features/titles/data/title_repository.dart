import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/app/providers/db_provider.dart';
import 'package:mobile/core/models/title.dart';
import 'package:mobile/core/models/title_search_item.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/titles/data/local/title_local_data_source.dart';
import 'package:mobile/features/titles/data/local/title_search_local_data_source.dart';
import 'package:mobile/features/titles/data/title_api.dart';

final titleApiProvider = Provider<TitleApi>((ref) {
  final dio = ref.watch(dioProvider);
  return TitleApi(dio);
});

final titleRepositoryProvider = Provider<TitleRepository>((ref) {
  final api = ref.watch(titleApiProvider);
  final db = ref.watch(dbProvider);
  final local = TitleLocalDataSource(db);
  final searchLocal = TitleSearchLocalDataSource(db);
  return TitleRepository(api, local, searchLocal);
});

class TitleRepository {
  TitleRepository(this._api, this._local, this._searchLocal);

  final TitleApi _api;
  final TitleLocalDataSource _local;
  final TitleSearchLocalDataSource _searchLocal;

  Future<List<TitleSearchItem>> search(String query) async {
    final results = await _api.search(query);
    await _searchLocal.upsertAll(results);
    return results;
  }

  Future<List<TitleSearchItem>> searchLocal(String query) {
    return _searchLocal.searchLocal(query);
  }

  Future<Title?> findById(String id) => _local.findById(id);

  Future<Title> fetchById(String id) async {
    final title = await _api.getById(id);
    await _local.upsertAll([title]);
    return title;
  }
}
