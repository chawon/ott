// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'watch_log.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$WatchLog {

 String get id; String get titleId; String get status; double? get rating; String? get note; String? get ott; DateTime? get watchedAt; Place? get place; Occasion? get occasion; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of WatchLog
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WatchLogCopyWith<WatchLog> get copyWith => _$WatchLogCopyWithImpl<WatchLog>(this as WatchLog, _$identity);

  /// Serializes this WatchLog to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WatchLog&&(identical(other.id, id) || other.id == id)&&(identical(other.titleId, titleId) || other.titleId == titleId)&&(identical(other.status, status) || other.status == status)&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.note, note) || other.note == note)&&(identical(other.ott, ott) || other.ott == ott)&&(identical(other.watchedAt, watchedAt) || other.watchedAt == watchedAt)&&(identical(other.place, place) || other.place == place)&&(identical(other.occasion, occasion) || other.occasion == occasion)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,titleId,status,rating,note,ott,watchedAt,place,occasion,createdAt,updatedAt);

@override
String toString() {
  return 'WatchLog(id: $id, titleId: $titleId, status: $status, rating: $rating, note: $note, ott: $ott, watchedAt: $watchedAt, place: $place, occasion: $occasion, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $WatchLogCopyWith<$Res>  {
  factory $WatchLogCopyWith(WatchLog value, $Res Function(WatchLog) _then) = _$WatchLogCopyWithImpl;
@useResult
$Res call({
 String id, String titleId, String status, double? rating, String? note, String? ott, DateTime? watchedAt, Place? place, Occasion? occasion, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$WatchLogCopyWithImpl<$Res>
    implements $WatchLogCopyWith<$Res> {
  _$WatchLogCopyWithImpl(this._self, this._then);

  final WatchLog _self;
  final $Res Function(WatchLog) _then;

/// Create a copy of WatchLog
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? titleId = null,Object? status = null,Object? rating = freezed,Object? note = freezed,Object? ott = freezed,Object? watchedAt = freezed,Object? place = freezed,Object? occasion = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,titleId: null == titleId ? _self.titleId : titleId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,rating: freezed == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as double?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,ott: freezed == ott ? _self.ott : ott // ignore: cast_nullable_to_non_nullable
as String?,watchedAt: freezed == watchedAt ? _self.watchedAt : watchedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,place: freezed == place ? _self.place : place // ignore: cast_nullable_to_non_nullable
as Place?,occasion: freezed == occasion ? _self.occasion : occasion // ignore: cast_nullable_to_non_nullable
as Occasion?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [WatchLog].
extension WatchLogPatterns on WatchLog {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WatchLog value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WatchLog() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WatchLog value)  $default,){
final _that = this;
switch (_that) {
case _WatchLog():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WatchLog value)?  $default,){
final _that = this;
switch (_that) {
case _WatchLog() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String titleId,  String status,  double? rating,  String? note,  String? ott,  DateTime? watchedAt,  Place? place,  Occasion? occasion,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WatchLog() when $default != null:
return $default(_that.id,_that.titleId,_that.status,_that.rating,_that.note,_that.ott,_that.watchedAt,_that.place,_that.occasion,_that.createdAt,_that.updatedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String titleId,  String status,  double? rating,  String? note,  String? ott,  DateTime? watchedAt,  Place? place,  Occasion? occasion,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _WatchLog():
return $default(_that.id,_that.titleId,_that.status,_that.rating,_that.note,_that.ott,_that.watchedAt,_that.place,_that.occasion,_that.createdAt,_that.updatedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String titleId,  String status,  double? rating,  String? note,  String? ott,  DateTime? watchedAt,  Place? place,  Occasion? occasion,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _WatchLog() when $default != null:
return $default(_that.id,_that.titleId,_that.status,_that.rating,_that.note,_that.ott,_that.watchedAt,_that.place,_that.occasion,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WatchLog implements WatchLog {
  const _WatchLog({required this.id, required this.titleId, required this.status, this.rating, this.note, this.ott, this.watchedAt, this.place, this.occasion, this.createdAt, this.updatedAt});
  factory _WatchLog.fromJson(Map<String, dynamic> json) => _$WatchLogFromJson(json);

@override final  String id;
@override final  String titleId;
@override final  String status;
@override final  double? rating;
@override final  String? note;
@override final  String? ott;
@override final  DateTime? watchedAt;
@override final  Place? place;
@override final  Occasion? occasion;
@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of WatchLog
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WatchLogCopyWith<_WatchLog> get copyWith => __$WatchLogCopyWithImpl<_WatchLog>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WatchLogToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WatchLog&&(identical(other.id, id) || other.id == id)&&(identical(other.titleId, titleId) || other.titleId == titleId)&&(identical(other.status, status) || other.status == status)&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.note, note) || other.note == note)&&(identical(other.ott, ott) || other.ott == ott)&&(identical(other.watchedAt, watchedAt) || other.watchedAt == watchedAt)&&(identical(other.place, place) || other.place == place)&&(identical(other.occasion, occasion) || other.occasion == occasion)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,titleId,status,rating,note,ott,watchedAt,place,occasion,createdAt,updatedAt);

@override
String toString() {
  return 'WatchLog(id: $id, titleId: $titleId, status: $status, rating: $rating, note: $note, ott: $ott, watchedAt: $watchedAt, place: $place, occasion: $occasion, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$WatchLogCopyWith<$Res> implements $WatchLogCopyWith<$Res> {
  factory _$WatchLogCopyWith(_WatchLog value, $Res Function(_WatchLog) _then) = __$WatchLogCopyWithImpl;
@override @useResult
$Res call({
 String id, String titleId, String status, double? rating, String? note, String? ott, DateTime? watchedAt, Place? place, Occasion? occasion, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$WatchLogCopyWithImpl<$Res>
    implements _$WatchLogCopyWith<$Res> {
  __$WatchLogCopyWithImpl(this._self, this._then);

  final _WatchLog _self;
  final $Res Function(_WatchLog) _then;

/// Create a copy of WatchLog
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? titleId = null,Object? status = null,Object? rating = freezed,Object? note = freezed,Object? ott = freezed,Object? watchedAt = freezed,Object? place = freezed,Object? occasion = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_WatchLog(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,titleId: null == titleId ? _self.titleId : titleId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,rating: freezed == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as double?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,ott: freezed == ott ? _self.ott : ott // ignore: cast_nullable_to_non_nullable
as String?,watchedAt: freezed == watchedAt ? _self.watchedAt : watchedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,place: freezed == place ? _self.place : place // ignore: cast_nullable_to_non_nullable
as Place?,occasion: freezed == occasion ? _self.occasion : occasion // ignore: cast_nullable_to_non_nullable
as Occasion?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
