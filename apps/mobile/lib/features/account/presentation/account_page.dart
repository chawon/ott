import 'package:flutter/material.dart';

import 'package:mobile/core/ui/texts_kr.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(KrText.account)),
      body: const Center(child: Text('계정 - 준비중')),
    );
  }
}
