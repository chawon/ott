import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/ui/texts_kr.dart';
import 'providers/router_provider.dart';
import '../core/theme/app_theme.dart';

class OttApp extends ConsumerWidget {
  const OttApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: KrText.appTitle,
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}
