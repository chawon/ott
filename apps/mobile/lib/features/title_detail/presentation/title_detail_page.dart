import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/models/watch_log.dart';
import 'package:mobile/core/ui/options.dart';
import 'package:mobile/core/ui/texts_kr.dart';
import 'package:mobile/features/title_detail/presentation/title_detail_provider.dart';
import 'package:mobile/features/logs/data/log_repository.dart';

class TitleDetailPage extends ConsumerWidget {
  const TitleDetailPage({super.key, required this.titleId});

  final String titleId;

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    final mm = date.month.toString().padLeft(2, '0');
    final dd = date.day.toString().padLeft(2, '0');
    return '${date.year}.$mm.$dd';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(titleDetailProvider(titleId));

    return Scaffold(
      appBar: AppBar(title: const Text(KrText.appTitle)),
      body: state.when(
        data: (detail) {
          final log = detail.log;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Text(detail.title.name, style: Theme.of(context).textTheme.headlineSmall),
              if (detail.title.year != null)
                Text(detail.title.year!, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              if (log != null)
                _LogEditor(log: log, titleId: titleId)
              else
                const Text(KrText.noLogYet),
              const SizedBox(height: 20),
              const Text(KrText.history, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (detail.history.isEmpty)
                const Text(KrText.historyEmpty)
              else
                ...detail.history.map(
                  (h) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(h.status),
                      subtitle: Text(h.ott ?? ''),
                      trailing: h.watchedAt == null ? null : Text(_formatDate(h.watchedAt)),
                    ),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _LogEditor extends ConsumerStatefulWidget {
  const _LogEditor({required this.log, required this.titleId});

  final WatchLog log;
  final String titleId;

  @override
  ConsumerState<_LogEditor> createState() => _LogEditorState();
}

class _LogEditorState extends ConsumerState<_LogEditor> {
  late String _status;
  late double? _rating;
  final _noteController = TextEditingController();
  final _ottController = TextEditingController();
  bool _showOptions = false;

  @override
  void initState() {
    super.initState();
    _status = widget.log.status;
    _rating = widget.log.rating;
    _noteController.text = widget.log.note ?? '';
    _ottController.text = widget.log.ott ?? '';
  }

  @override
  void dispose() {
    _noteController.dispose();
    _ottController.dispose();
    super.dispose();
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

  String _labelForRating(double? value) {
    if (value == null) return KrText.ratingNone;
    if (value >= 5) return KrText.ratingBest;
    if (value >= 3) return KrText.ratingOk;
    return KrText.ratingBad;
  }

  Future<void> _save() async {
    final repo = ref.read(logRepositoryProvider);
    await repo.updateLog(widget.log.id, {
      'status': _status,
      'rating': _rating,
      'note': _noteController.text.trim().isEmpty ? null : _noteController.text,
      'ott': _ottController.text.trim().isEmpty ? null : _ottController.text,
    });

    ref.read(titleDetailRefresherProvider(widget.titleId))();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(KrText.updated)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('내 기록', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(label: KrText.status, value: _labelForStatus(_status)),
                _InfoChip(label: KrText.rating, value: _labelForRating(_rating)),
                if (_ottController.text.trim().isNotEmpty)
                  _InfoChip(label: KrText.ott, value: _ottController.text.trim()),
              ],
            ),
            const SizedBox(height: 8),
            ExpansionTile(
              initiallyExpanded: _showOptions,
              onExpansionChanged: (value) => setState(() => _showOptions = value),
              title: const Text('편집'),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              children: [
                DropdownButtonFormField<String>(
                  value: _status,
                  decoration: const InputDecoration(labelText: KrText.status),
                  items: statusItems,
                  onChanged: (value) => setState(() => _status = value ?? _status),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<double?>(
                  value: _rating,
                  decoration: const InputDecoration(labelText: KrText.rating),
                  items: ratingItems,
                  onChanged: (value) => setState(() => _rating = value),
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
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _save,
                    child: const Text('업데이트'),
                  ),
                ),
              ],
            ),
          ],
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
