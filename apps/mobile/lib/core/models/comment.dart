class Comment {
  Comment({
    required this.id,
    required this.discussionId,
    required this.authorName,
    required this.body,
    this.userId,
    this.createdAt,
  });

  final String id;
  final String discussionId;
  final String? userId;
  final String authorName;
  final String body;
  final DateTime? createdAt;

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['id'] as String,
      discussionId: json['discussionId'] as String,
      userId: json['userId'] as String?,
      authorName: json['authorName'] as String,
      body: json['body'] as String,
      createdAt: _parseDate(json['createdAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
