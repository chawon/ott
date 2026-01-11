// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'title_search_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$TitleSearchItem {

 String get provider; String get providerId; String get type; String get name; String? get year; String? get posterUrl; String? get overview;
/// Create a copy of TitleSearchItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TitleSearchItemCopyWith<TitleSearchItem> get copyWith => _$TitleSearchItemCopyWithImpl<TitleSearchItem>(this as TitleSearchItem, _$identity);

  /// Serializes this TitleSearchItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TitleSearchItem&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.year, year) || other.year == year)&&(identical(other.posterUrl, posterUrl) || other.posterUrl == posterUrl)&&(identical(other.overview, overview) || other.overview == overview));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,provider,providerId,type,name,year,posterUrl,overview);

@override
String toString() {
  return 'TitleSearchItem(provider: $provider, providerId: $providerId, type: $type, name: $name, year: $year, posterUrl: $posterUrl, overview: $overview)';
}


}

/// @nodoc
abstract mixin class $TitleSearchItemCopyWith<$Res>  {
  factory $TitleSearchItemCopyWith(TitleSearchItem value, $Res Function(TitleSearchItem) _then) = _$TitleSearchItemCopyWithImpl;
@useResult
$Res call({
 String provider, String providerId, String type, String name, String? year, String? posterUrl, String? overview
});




}
/// @nodoc
class _$TitleSearchItemCopyWithImpl<$Res>
    implements $TitleSearchItemCopyWith<$Res> {
  _$TitleSearchItemCopyWithImpl(this._self, this._then);

  final TitleSearchItem _self;
  final $Res Function(TitleSearchItem) _then;

/// Create a copy of TitleSearchItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? provider = null,Object? providerId = null,Object? type = null,Object? name = null,Object? year = freezed,Object? posterUrl = freezed,Object? overview = freezed,}) {
  return _then(_self.copyWith(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,providerId: null == providerId ? _self.providerId : providerId // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as String?,posterUrl: freezed == posterUrl ? _self.posterUrl : posterUrl // ignore: cast_nullable_to_non_nullable
as String?,overview: freezed == overview ? _self.overview : overview // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [TitleSearchItem].
extension TitleSearchItemPatterns on TitleSearchItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TitleSearchItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TitleSearchItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TitleSearchItem value)  $default,){
final _that = this;
switch (_that) {
case _TitleSearchItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TitleSearchItem value)?  $default,){
final _that = this;
switch (_that) {
case _TitleSearchItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TitleSearchItem() when $default != null:
return $default(_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)  $default,) {final _that = this;
switch (_that) {
case _TitleSearchItem():
return $default(_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)?  $default,) {final _that = this;
switch (_that) {
case _TitleSearchItem() when $default != null:
return $default(_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TitleSearchItem implements TitleSearchItem {
  const _TitleSearchItem({required this.provider, required this.providerId, required this.type, required this.name, this.year, this.posterUrl, this.overview});
  factory _TitleSearchItem.fromJson(Map<String, dynamic> json) => _$TitleSearchItemFromJson(json);

@override final  String provider;
@override final  String providerId;
@override final  String type;
@override final  String name;
@override final  String? year;
@override final  String? posterUrl;
@override final  String? overview;

/// Create a copy of TitleSearchItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TitleSearchItemCopyWith<_TitleSearchItem> get copyWith => __$TitleSearchItemCopyWithImpl<_TitleSearchItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TitleSearchItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TitleSearchItem&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.year, year) || other.year == year)&&(identical(other.posterUrl, posterUrl) || other.posterUrl == posterUrl)&&(identical(other.overview, overview) || other.overview == overview));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,provider,providerId,type,name,year,posterUrl,overview);

@override
String toString() {
  return 'TitleSearchItem(provider: $provider, providerId: $providerId, type: $type, name: $name, year: $year, posterUrl: $posterUrl, overview: $overview)';
}


}

/// @nodoc
abstract mixin class _$TitleSearchItemCopyWith<$Res> implements $TitleSearchItemCopyWith<$Res> {
  factory _$TitleSearchItemCopyWith(_TitleSearchItem value, $Res Function(_TitleSearchItem) _then) = __$TitleSearchItemCopyWithImpl;
@override @useResult
$Res call({
 String provider, String providerId, String type, String name, String? year, String? posterUrl, String? overview
});




}
/// @nodoc
class __$TitleSearchItemCopyWithImpl<$Res>
    implements _$TitleSearchItemCopyWith<$Res> {
  __$TitleSearchItemCopyWithImpl(this._self, this._then);

  final _TitleSearchItem _self;
  final $Res Function(_TitleSearchItem) _then;

/// Create a copy of TitleSearchItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? provider = null,Object? providerId = null,Object? type = null,Object? name = null,Object? year = freezed,Object? posterUrl = freezed,Object? overview = freezed,}) {
  return _then(_TitleSearchItem(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,providerId: null == providerId ? _self.providerId : providerId // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as String?,posterUrl: freezed == posterUrl ? _self.posterUrl : posterUrl // ignore: cast_nullable_to_non_nullable
as String?,overview: freezed == overview ? _self.overview : overview // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
