import 'package:flutter/material.dart';

import 'package:mobile/core/ui/texts_kr.dart';

class PublicPage extends StatelessWidget {
  const PublicPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(KrText.publicTab)),
      body: const Center(child: Text('공개 기록 - 준비중')),
    );
  }
}
