import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/account/presentation/account_page.dart';
import 'package:mobile/features/home/presentation/home_page.dart';
import 'package:mobile/features/public/presentation/public_detail_page.dart';
import 'package:mobile/features/public/presentation/public_page.dart';
import 'package:mobile/features/timeline/presentation/timeline_page.dart';
import 'package:mobile/features/title_detail/presentation/title_detail_page.dart';

final appRouter = GoRouter(
  routes: [
    ShellRoute(
      builder: (context, state, child) {
        return AppShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: HomePage(),
          ),
        ),
        GoRoute(
          path: '/timeline',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: TimelinePage(),
          ),
        ),
        GoRoute(
          path: '/public',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: PublicPage(),
          ),
        ),
        GoRoute(
          path: '/public/:id',
          builder: (context, state) =>
              PublicDetailPage(discussionId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/account',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: AccountPage(),
          ),
        ),
        GoRoute(
          path: '/title/:id',
          builder: (context, state) =>
              TitleDetailPage(titleId: state.pathParameters['id']!),
        ),
      ],
    ),
  ],
);

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _indexFromLocation(String location) {
    if (location.startsWith('/timeline')) return 1;
    if (location.startsWith('/public')) return 2;
    if (location.startsWith('/account')) return 3;
    return 0;
  }

  void _onTap(int index) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/timeline');
        break;
      case 2:
        context.go('/public');
        break;
      case 3:
        context.go('/account');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final currentIndex = _indexFromLocation(location);

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: _onTap,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: KrText.appTitle),
          NavigationDestination(icon: Icon(Icons.timeline_outlined), label: KrText.timeline),
          NavigationDestination(icon: Icon(Icons.forum_outlined), label: KrText.publicTab),
          NavigationDestination(icon: Icon(Icons.person_outline), label: KrText.account),
        ],
      ),
    );
  }
}
