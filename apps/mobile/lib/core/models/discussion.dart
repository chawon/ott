class Discussion {
  Discussion({
    required this.id,
    required this.titleId,
    required this.commentSeq,
    this.createdAt,
  });

  final String id;
  final String titleId;
  final int commentSeq;
  final DateTime? createdAt;

  factory Discussion.fromJson(Map<String, dynamic> json) {
    return Discussion(
      id: json['id'] as String,
      titleId: json['titleId'] as String,
      commentSeq: (json['commentSeq'] as num?)?.toInt() ?? 0,
      createdAt: _parseDate(json['createdAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
