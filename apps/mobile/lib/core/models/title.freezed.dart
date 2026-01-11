// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'title.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Title {

 String get id; String get provider; String get providerId; String get type; String get name; String? get year; String? get posterUrl; String? get overview;
/// Create a copy of Title
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TitleCopyWith<Title> get copyWith => _$TitleCopyWithImpl<Title>(this as Title, _$identity);

  /// Serializes this Title to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Title&&(identical(other.id, id) || other.id == id)&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.year, year) || other.year == year)&&(identical(other.posterUrl, posterUrl) || other.posterUrl == posterUrl)&&(identical(other.overview, overview) || other.overview == overview));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,provider,providerId,type,name,year,posterUrl,overview);

@override
String toString() {
  return 'Title(id: $id, provider: $provider, providerId: $providerId, type: $type, name: $name, year: $year, posterUrl: $posterUrl, overview: $overview)';
}


}

/// @nodoc
abstract mixin class $TitleCopyWith<$Res>  {
  factory $TitleCopyWith(Title value, $Res Function(Title) _then) = _$TitleCopyWithImpl;
@useResult
$Res call({
 String id, String provider, String providerId, String type, String name, String? year, String? posterUrl, String? overview
});




}
/// @nodoc
class _$TitleCopyWithImpl<$Res>
    implements $TitleCopyWith<$Res> {
  _$TitleCopyWithImpl(this._self, this._then);

  final Title _self;
  final $Res Function(Title) _then;

/// Create a copy of Title
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? provider = null,Object? providerId = null,Object? type = null,Object? name = null,Object? year = freezed,Object? posterUrl = freezed,Object? overview = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
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


/// Adds pattern-matching-related methods to [Title].
extension TitlePatterns on Title {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Title value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Title() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Title value)  $default,){
final _that = this;
switch (_that) {
case _Title():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Title value)?  $default,){
final _that = this;
switch (_that) {
case _Title() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Title() when $default != null:
return $default(_that.id,_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)  $default,) {final _that = this;
switch (_that) {
case _Title():
return $default(_that.id,_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String provider,  String providerId,  String type,  String name,  String? year,  String? posterUrl,  String? overview)?  $default,) {final _that = this;
switch (_that) {
case _Title() when $default != null:
return $default(_that.id,_that.provider,_that.providerId,_that.type,_that.name,_that.year,_that.posterUrl,_that.overview);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Title implements Title {
  const _Title({required this.id, required this.provider, required this.providerId, required this.type, required this.name, this.year, this.posterUrl, this.overview});
  factory _Title.fromJson(Map<String, dynamic> json) => _$TitleFromJson(json);

@override final  String id;
@override final  String provider;
@override final  String providerId;
@override final  String type;
@override final  String name;
@override final  String? year;
@override final  String? posterUrl;
@override final  String? overview;

/// Create a copy of Title
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TitleCopyWith<_Title> get copyWith => __$TitleCopyWithImpl<_Title>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TitleToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Title&&(identical(other.id, id) || other.id == id)&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.year, year) || other.year == year)&&(identical(other.posterUrl, posterUrl) || other.posterUrl == posterUrl)&&(identical(other.overview, overview) || other.overview == overview));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,provider,providerId,type,name,year,posterUrl,overview);

@override
String toString() {
  return 'Title(id: $id, provider: $provider, providerId: $providerId, type: $type, name: $name, year: $year, posterUrl: $posterUrl, overview: $overview)';
}


}

/// @nodoc
abstract mixin class _$TitleCopyWith<$Res> implements $TitleCopyWith<$Res> {
  factory _$TitleCopyWith(_Title value, $Res Function(_Title) _then) = __$TitleCopyWithImpl;
@override @useResult
$Res call({
 String id, String provider, String providerId, String type, String name, String? year, String? posterUrl, String? overview
});




}
/// @nodoc
class __$TitleCopyWithImpl<$Res>
    implements _$TitleCopyWith<$Res> {
  __$TitleCopyWithImpl(this._self, this._then);

  final _Title _self;
  final $Res Function(_Title) _then;

/// Create a copy of Title
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? provider = null,Object? providerId = null,Object? type = null,Object? name = null,Object? year = freezed,Object? posterUrl = freezed,Object? overview = freezed,}) {
  return _then(_Title(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
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
