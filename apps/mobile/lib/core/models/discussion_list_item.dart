class DiscussionListItem {
  DiscussionListItem({
    required this.id,
    required this.titleId,
    required this.titleName,
    required this.titleType,
    required this.commentCount,
    this.titleYear,
    this.posterUrl,
    this.createdAt,
  });

  final String id;
  final String titleId;
  final String titleName;
  final String titleType;
  final int? titleYear;
  final String? posterUrl;
  final int commentCount;
  final DateTime? createdAt;

  factory DiscussionListItem.fromJson(Map<String, dynamic> json) {
    return DiscussionListItem(
      id: json['id'] as String,
      titleId: json['titleId'] as String,
      titleName: json['titleName'] as String,
      titleType: json['titleType'] as String,
      titleYear: (json['titleYear'] as num?)?.toInt(),
      posterUrl: json['posterUrl'] as String?,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      createdAt: _parseDate(json['createdAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
