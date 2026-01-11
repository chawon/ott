import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/title_search_item.dart';
import 'package:mobile/core/ui/options.dart';
import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/quicklog/presentation/quick_log_provider.dart';
import 'package:mobile/features/titles/data/title_repository.dart';

class QuickLogCard extends ConsumerStatefulWidget {
  const QuickLogCard({super.key});

  @override
  ConsumerState<QuickLogCard> createState() => _QuickLogCardState();
}

class _QuickLogCardState extends ConsumerState<QuickLogCard> {
  final _controller = TextEditingController();
  final _ottController = TextEditingController();
  final _noteController = TextEditingController();

  List<TitleSearchItem> _results = [];
  TitleSearchItem? _selected;
  bool _loading = false;

  String _status = 'IN_PROGRESS';
  double? _rating;
  String _place = 'HOME';
  String _occasion = 'ALONE';

  @override
  void dispose() {
    _controller.dispose();
    _ottController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final repo = ref.read(titleRepositoryProvider);
      final results = await repo.search(query);
      setState(() {
        _results = results;
      });
    } catch (_) {
      final repo = ref.read(titleRepositoryProvider);
      final results = await repo.searchLocal(query);
      setState(() {
        _results = results;
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final item = _selected;
    if (item == null) return;

    final controller = ref.read(quickLogControllerProvider.notifier);
    await controller.submit(
      QuickLogParams(
        provider: item.provider,
        providerId: item.providerId,
        titleType: item.type,
        status: _status,
        rating: _rating,
        ott: _ottController.text.trim().isEmpty ? null : _ottController.text,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text,
        place: _place,
        occasion: _occasion,
      ),
    );

    if (mounted) {
      setState(() {
        _selected = null;
        _results = [];
        _controller.clear();
        _ottController.clear();
        _noteController.clear();
        _status = 'IN_PROGRESS';
        _rating = null;
        _place = 'HOME';
        _occasion = 'ALONE';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(KrText.saved)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final quickState = ref.watch(quickLogControllerProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(KrText.quickLogTitle, style: TextStyle(fontSize: 18)),
            const SizedBox(height: 12),
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: KrText.searchHint,
                suffixIcon: _loading
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : IconButton(
                        icon: const Icon(Icons.search),
                        onPressed: () => _search(_controller.text),
                      ),
              ),
              onSubmitted: _search,
            ),
            const SizedBox(height: 12),
            if (_results.isNotEmpty)
              Column(
                children: _results
                    .map(
                      (item) => ListTile(
                        title: Text(item.name),
                        subtitle: Text('${item.type} ${item.year ?? ''}'.trim()),
                        trailing: _selected == item
                            ? const Icon(Icons.check)
                            : null,
                        onTap: () => setState(() => _selected = item),
                      ),
                    )
                    .toList(),
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _DropdownField(
                  label: KrText.status,
                  value: _status,
                  items: statusItems,
                  onChanged: (value) => setState(() => _status = value ?? 'IN_PROGRESS'),
                ),
                _DropdownField<double?>(
                  label: KrText.rating,
                  value: _rating,
                  items: ratingItems,
                  onChanged: (value) => setState(() => _rating = value),
                ),
                _DropdownField(
                  label: KrText.place,
                  value: _place,
                  items: placeItems,
                  onChanged: (value) => setState(() => _place = value ?? 'HOME'),
                ),
                _DropdownField(
                  label: KrText.occasion,
                  value: _occasion,
                  items: occasionItems,
                  onChanged: (value) => setState(() => _occasion = value ?? 'ALONE'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ottController,
              decoration: const InputDecoration(
                labelText: KrText.ott,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteController,
              decoration: const InputDecoration(
                labelText: KrText.note,
              ),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed:
                    quickState.isLoading || _selected == null ? null : _submit,
                child: quickState.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(KrText.save),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<T>(
            value: value,
            isDense: true,
            items: items,
            onChanged: onChanged,
          ),
        ),
      ),
    );
  }
}
