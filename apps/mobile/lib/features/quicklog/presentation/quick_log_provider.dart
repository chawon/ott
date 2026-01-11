import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/features/logs/data/log_repository.dart';
import 'package:mobile/features/titles/data/title_repository.dart';

class QuickLogParams {
  QuickLogParams({
    required this.provider,
    required this.providerId,
    required this.titleType,
    required this.status,
    this.rating,
    this.note,
    this.ott,
    this.place,
    this.occasion,
  });

  final String provider;
  final String providerId;
  final String titleType;
  final String status;
  final double? rating;
  final String? note;
  final String? ott;
  final String? place;
  final String? occasion;

  Map<String, dynamic> toJson() {
    return {
      'provider': provider,
      'providerId': providerId,
      'titleType': titleType,
      'status': status,
      if (rating != null) 'rating': rating,
      if (note != null) 'note': note,
      if (ott != null) 'ott': ott,
      if (place != null) 'place': place,
      if (occasion != null) 'occasion': occasion,
    };
  }
}

final quickLogControllerProvider = AutoDisposeAsyncNotifierProvider<
    QuickLogController, void>(QuickLogController.new);

class QuickLogController extends AutoDisposeAsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<void> submit(QuickLogParams params) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final logs = ref.read(logRepositoryProvider);
      final titleRepo = ref.read(titleRepositoryProvider);
      final created = await logs.createLog(params.toJson());
      await titleRepo.fetchById(created.titleId);
    });
  }
}
