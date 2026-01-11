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
  bool _showOptions = false;

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
        _showOptions = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(KrText.saved)),
      );
    }
  }

  String _labelForStatus(String value) {
    switch (value) {
      case 'DONE':
        return KrText.statusDone;
      case 'DROPPED':
        return KrText.statusDropped;
      case 'PAUSED':
        return KrText.statusPaused;
      default:
        return KrText.statusInProgress;
    }
  }

  String _labelForPlace(String value) {
    switch (value) {
      case 'THEATER':
        return KrText.placeTheater;
      case 'TRANSIT':
        return KrText.placeTransit;
      case 'CAFE':
        return KrText.placeCafe;
      case 'OFFICE':
        return KrText.placeOffice;
      case 'ETC':
        return KrText.placeEtc;
      default:
        return KrText.placeHome;
    }
  }

  String _labelForOccasion(String value) {
    switch (value) {
      case 'DATE':
        return KrText.occDate;
      case 'FAMILY':
        return KrText.occFamily;
      case 'FRIENDS':
        return KrText.occFriends;
      case 'BREAK':
        return KrText.occBreak;
      case 'ETC':
        return KrText.occEtc;
      default:
        return KrText.occAlone;
    }
  }

  String _labelForRating(double? value) {
    if (value == null) return KrText.ratingNone;
    if (value >= 5) return KrText.ratingBest;
    if (value >= 3) return KrText.ratingOk;
    return KrText.ratingBad;
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
            if (_selected != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceVariant,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selected!.name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text('${_selected!.type} ${_selected!.year ?? ''}'.trim()),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => setState(() => _selected = null),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            if (_selected != null) const SizedBox(height: 12),
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
              Container(
                constraints: const BoxConstraints(maxHeight: 240),
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _results.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = _results[index];
                    return ListTile(
                      title: Text(item.name),
                      subtitle: Text('${item.type} ${item.year ?? ''}'.trim()),
                      trailing: _selected == item
                          ? const Icon(Icons.check)
                          : null,
                      onTap: () => setState(() => _selected = item),
                    );
                  },
                ),
              ),
            if (_results.isNotEmpty) const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(label: KrText.status, value: _labelForStatus(_status)),
                _InfoChip(label: KrText.rating, value: _labelForRating(_rating)),
                _InfoChip(label: KrText.place, value: _labelForPlace(_place)),
                _InfoChip(label: KrText.occasion, value: _labelForOccasion(_occasion)),
                if (_ottController.text.trim().isNotEmpty)
                  _InfoChip(label: KrText.ott, value: _ottController.text.trim()),
              ],
            ),
            const SizedBox(height: 8),
            ExpansionTile(
              initiallyExpanded: _showOptions,
              onExpansionChanged: (value) => setState(() => _showOptions = value),
              title: const Text('옵션'),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              children: [
                _DropdownField(
                  label: KrText.status,
                  value: _status,
                  items: statusItems,
                  onChanged: (value) => setState(() => _status = value ?? 'IN_PROGRESS'),
                ),
                const SizedBox(height: 12),
                _DropdownField<double?>(
                  label: KrText.rating,
                  value: _rating,
                  items: ratingItems,
                  onChanged: (value) => setState(() => _rating = value),
                ),
                const SizedBox(height: 12),
                _DropdownField(
                  label: KrText.place,
                  value: _place,
                  items: placeItems,
                  onChanged: (value) => setState(() => _place = value ?? 'HOME'),
                ),
                const SizedBox(height: 12),
                _DropdownField(
                  label: KrText.occasion,
                  value: _occasion,
                  items: occasionItems,
                  onChanged: (value) => setState(() => _occasion = value ?? 'ALONE'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _ottController,
                  decoration: const InputDecoration(labelText: KrText.ott),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _noteController,
                  decoration: const InputDecoration(labelText: KrText.note),
                  minLines: 2,
                  maxLines: 4,
                ),
              ],
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
    return InputDecorator(
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isDense: true,
          isExpanded: true,
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text('$label: $value'),
      backgroundColor: Theme.of(context).colorScheme.surfaceVariant,
    );
  }
}
