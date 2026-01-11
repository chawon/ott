import 'package:json_annotation/json_annotation.dart';

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum Place {
  home,
  theater,
  transit,
  cafe,
  office,
  etc,
}

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum Occasion {
  alone,
  date,
  family,
  friends,
  breakTime,
  etc,
}
