// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $TitlesTable extends Titles with TableInfo<$TitlesTable, TitleRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TitlesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _providerMeta = const VerificationMeta(
    'provider',
  );
  @override
  late final GeneratedColumn<String> provider = GeneratedColumn<String>(
    'provider',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _providerIdMeta = const VerificationMeta(
    'providerId',
  );
  @override
  late final GeneratedColumn<String> providerId = GeneratedColumn<String>(
    'provider_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _yearMeta = const VerificationMeta('year');
  @override
  late final GeneratedColumn<String> year = GeneratedColumn<String>(
    'year',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _posterUrlMeta = const VerificationMeta(
    'posterUrl',
  );
  @override
  late final GeneratedColumn<String> posterUrl = GeneratedColumn<String>(
    'poster_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _overviewMeta = const VerificationMeta(
    'overview',
  );
  @override
  late final GeneratedColumn<String> overview = GeneratedColumn<String>(
    'overview',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deletedAtMeta = const VerificationMeta(
    'deletedAt',
  );
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
    'deleted_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    provider,
    providerId,
    type,
    name,
    year,
    posterUrl,
    overview,
    updatedAt,
    deletedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'titles';
  @override
  VerificationContext validateIntegrity(
    Insertable<TitleRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('provider')) {
      context.handle(
        _providerMeta,
        provider.isAcceptableOrUnknown(data['provider']!, _providerMeta),
      );
    } else if (isInserting) {
      context.missing(_providerMeta);
    }
    if (data.containsKey('provider_id')) {
      context.handle(
        _providerIdMeta,
        providerId.isAcceptableOrUnknown(data['provider_id']!, _providerIdMeta),
      );
    } else if (isInserting) {
      context.missing(_providerIdMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('year')) {
      context.handle(
        _yearMeta,
        year.isAcceptableOrUnknown(data['year']!, _yearMeta),
      );
    }
    if (data.containsKey('poster_url')) {
      context.handle(
        _posterUrlMeta,
        posterUrl.isAcceptableOrUnknown(data['poster_url']!, _posterUrlMeta),
      );
    }
    if (data.containsKey('overview')) {
      context.handle(
        _overviewMeta,
        overview.isAcceptableOrUnknown(data['overview']!, _overviewMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(
        _deletedAtMeta,
        deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  TitleRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TitleRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      provider: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider'],
      )!,
      providerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider_id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      year: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}year'],
      ),
      posterUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}poster_url'],
      ),
      overview: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}overview'],
      ),
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      deletedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}deleted_at'],
      ),
    );
  }

  @override
  $TitlesTable createAlias(String alias) {
    return $TitlesTable(attachedDatabase, alias);
  }
}

class TitleRow extends DataClass implements Insertable<TitleRow> {
  final String id;
  final String provider;
  final String providerId;
  final String type;
  final String name;
  final String? year;
  final String? posterUrl;
  final String? overview;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  const TitleRow({
    required this.id,
    required this.provider,
    required this.providerId,
    required this.type,
    required this.name,
    this.year,
    this.posterUrl,
    this.overview,
    required this.updatedAt,
    this.deletedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['provider'] = Variable<String>(provider);
    map['provider_id'] = Variable<String>(providerId);
    map['type'] = Variable<String>(type);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || year != null) {
      map['year'] = Variable<String>(year);
    }
    if (!nullToAbsent || posterUrl != null) {
      map['poster_url'] = Variable<String>(posterUrl);
    }
    if (!nullToAbsent || overview != null) {
      map['overview'] = Variable<String>(overview);
    }
    map['updated_at'] = Variable<DateTime>(updatedAt);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    return map;
  }

  TitlesCompanion toCompanion(bool nullToAbsent) {
    return TitlesCompanion(
      id: Value(id),
      provider: Value(provider),
      providerId: Value(providerId),
      type: Value(type),
      name: Value(name),
      year: year == null && nullToAbsent ? const Value.absent() : Value(year),
      posterUrl: posterUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(posterUrl),
      overview: overview == null && nullToAbsent
          ? const Value.absent()
          : Value(overview),
      updatedAt: Value(updatedAt),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
    );
  }

  factory TitleRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TitleRow(
      id: serializer.fromJson<String>(json['id']),
      provider: serializer.fromJson<String>(json['provider']),
      providerId: serializer.fromJson<String>(json['providerId']),
      type: serializer.fromJson<String>(json['type']),
      name: serializer.fromJson<String>(json['name']),
      year: serializer.fromJson<String?>(json['year']),
      posterUrl: serializer.fromJson<String?>(json['posterUrl']),
      overview: serializer.fromJson<String?>(json['overview']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'provider': serializer.toJson<String>(provider),
      'providerId': serializer.toJson<String>(providerId),
      'type': serializer.toJson<String>(type),
      'name': serializer.toJson<String>(name),
      'year': serializer.toJson<String?>(year),
      'posterUrl': serializer.toJson<String?>(posterUrl),
      'overview': serializer.toJson<String?>(overview),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
    };
  }

  TitleRow copyWith({
    String? id,
    String? provider,
    String? providerId,
    String? type,
    String? name,
    Value<String?> year = const Value.absent(),
    Value<String?> posterUrl = const Value.absent(),
    Value<String?> overview = const Value.absent(),
    DateTime? updatedAt,
    Value<DateTime?> deletedAt = const Value.absent(),
  }) => TitleRow(
    id: id ?? this.id,
    provider: provider ?? this.provider,
    providerId: providerId ?? this.providerId,
    type: type ?? this.type,
    name: name ?? this.name,
    year: year.present ? year.value : this.year,
    posterUrl: posterUrl.present ? posterUrl.value : this.posterUrl,
    overview: overview.present ? overview.value : this.overview,
    updatedAt: updatedAt ?? this.updatedAt,
    deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
  );
  TitleRow copyWithCompanion(TitlesCompanion data) {
    return TitleRow(
      id: data.id.present ? data.id.value : this.id,
      provider: data.provider.present ? data.provider.value : this.provider,
      providerId: data.providerId.present
          ? data.providerId.value
          : this.providerId,
      type: data.type.present ? data.type.value : this.type,
      name: data.name.present ? data.name.value : this.name,
      year: data.year.present ? data.year.value : this.year,
      posterUrl: data.posterUrl.present ? data.posterUrl.value : this.posterUrl,
      overview: data.overview.present ? data.overview.value : this.overview,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TitleRow(')
          ..write('id: $id, ')
          ..write('provider: $provider, ')
          ..write('providerId: $providerId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('year: $year, ')
          ..write('posterUrl: $posterUrl, ')
          ..write('overview: $overview, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    provider,
    providerId,
    type,
    name,
    year,
    posterUrl,
    overview,
    updatedAt,
    deletedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TitleRow &&
          other.id == this.id &&
          other.provider == this.provider &&
          other.providerId == this.providerId &&
          other.type == this.type &&
          other.name == this.name &&
          other.year == this.year &&
          other.posterUrl == this.posterUrl &&
          other.overview == this.overview &&
          other.updatedAt == this.updatedAt &&
          other.deletedAt == this.deletedAt);
}

class TitlesCompanion extends UpdateCompanion<TitleRow> {
  final Value<String> id;
  final Value<String> provider;
  final Value<String> providerId;
  final Value<String> type;
  final Value<String> name;
  final Value<String?> year;
  final Value<String?> posterUrl;
  final Value<String?> overview;
  final Value<DateTime> updatedAt;
  final Value<DateTime?> deletedAt;
  final Value<int> rowid;
  const TitlesCompanion({
    this.id = const Value.absent(),
    this.provider = const Value.absent(),
    this.providerId = const Value.absent(),
    this.type = const Value.absent(),
    this.name = const Value.absent(),
    this.year = const Value.absent(),
    this.posterUrl = const Value.absent(),
    this.overview = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TitlesCompanion.insert({
    required String id,
    required String provider,
    required String providerId,
    required String type,
    required String name,
    this.year = const Value.absent(),
    this.posterUrl = const Value.absent(),
    this.overview = const Value.absent(),
    required DateTime updatedAt,
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       provider = Value(provider),
       providerId = Value(providerId),
       type = Value(type),
       name = Value(name),
       updatedAt = Value(updatedAt);
  static Insertable<TitleRow> custom({
    Expression<String>? id,
    Expression<String>? provider,
    Expression<String>? providerId,
    Expression<String>? type,
    Expression<String>? name,
    Expression<String>? year,
    Expression<String>? posterUrl,
    Expression<String>? overview,
    Expression<DateTime>? updatedAt,
    Expression<DateTime>? deletedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (provider != null) 'provider': provider,
      if (providerId != null) 'provider_id': providerId,
      if (type != null) 'type': type,
      if (name != null) 'name': name,
      if (year != null) 'year': year,
      if (posterUrl != null) 'poster_url': posterUrl,
      if (overview != null) 'overview': overview,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TitlesCompanion copyWith({
    Value<String>? id,
    Value<String>? provider,
    Value<String>? providerId,
    Value<String>? type,
    Value<String>? name,
    Value<String?>? year,
    Value<String?>? posterUrl,
    Value<String?>? overview,
    Value<DateTime>? updatedAt,
    Value<DateTime?>? deletedAt,
    Value<int>? rowid,
  }) {
    return TitlesCompanion(
      id: id ?? this.id,
      provider: provider ?? this.provider,
      providerId: providerId ?? this.providerId,
      type: type ?? this.type,
      name: name ?? this.name,
      year: year ?? this.year,
      posterUrl: posterUrl ?? this.posterUrl,
      overview: overview ?? this.overview,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (provider.present) {
      map['provider'] = Variable<String>(provider.value);
    }
    if (providerId.present) {
      map['provider_id'] = Variable<String>(providerId.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (year.present) {
      map['year'] = Variable<String>(year.value);
    }
    if (posterUrl.present) {
      map['poster_url'] = Variable<String>(posterUrl.value);
    }
    if (overview.present) {
      map['overview'] = Variable<String>(overview.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TitlesCompanion(')
          ..write('id: $id, ')
          ..write('provider: $provider, ')
          ..write('providerId: $providerId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('year: $year, ')
          ..write('posterUrl: $posterUrl, ')
          ..write('overview: $overview, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TitleSearchCacheTable extends TitleSearchCache
    with TableInfo<$TitleSearchCacheTable, TitleSearchCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TitleSearchCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _providerMeta = const VerificationMeta(
    'provider',
  );
  @override
  late final GeneratedColumn<String> provider = GeneratedColumn<String>(
    'provider',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _providerIdMeta = const VerificationMeta(
    'providerId',
  );
  @override
  late final GeneratedColumn<String> providerId = GeneratedColumn<String>(
    'provider_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _yearMeta = const VerificationMeta('year');
  @override
  late final GeneratedColumn<String> year = GeneratedColumn<String>(
    'year',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _posterUrlMeta = const VerificationMeta(
    'posterUrl',
  );
  @override
  late final GeneratedColumn<String> posterUrl = GeneratedColumn<String>(
    'poster_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _overviewMeta = const VerificationMeta(
    'overview',
  );
  @override
  late final GeneratedColumn<String> overview = GeneratedColumn<String>(
    'overview',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    provider,
    providerId,
    type,
    name,
    year,
    posterUrl,
    overview,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'title_search_cache';
  @override
  VerificationContext validateIntegrity(
    Insertable<TitleSearchCacheData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('provider')) {
      context.handle(
        _providerMeta,
        provider.isAcceptableOrUnknown(data['provider']!, _providerMeta),
      );
    } else if (isInserting) {
      context.missing(_providerMeta);
    }
    if (data.containsKey('provider_id')) {
      context.handle(
        _providerIdMeta,
        providerId.isAcceptableOrUnknown(data['provider_id']!, _providerIdMeta),
      );
    } else if (isInserting) {
      context.missing(_providerIdMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('year')) {
      context.handle(
        _yearMeta,
        year.isAcceptableOrUnknown(data['year']!, _yearMeta),
      );
    }
    if (data.containsKey('poster_url')) {
      context.handle(
        _posterUrlMeta,
        posterUrl.isAcceptableOrUnknown(data['poster_url']!, _posterUrlMeta),
      );
    }
    if (data.containsKey('overview')) {
      context.handle(
        _overviewMeta,
        overview.isAcceptableOrUnknown(data['overview']!, _overviewMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {provider, providerId};
  @override
  TitleSearchCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TitleSearchCacheData(
      provider: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider'],
      )!,
      providerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider_id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      year: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}year'],
      ),
      posterUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}poster_url'],
      ),
      overview: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}overview'],
      ),
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $TitleSearchCacheTable createAlias(String alias) {
    return $TitleSearchCacheTable(attachedDatabase, alias);
  }
}

class TitleSearchCacheData extends DataClass
    implements Insertable<TitleSearchCacheData> {
  final String provider;
  final String providerId;
  final String type;
  final String name;
  final String? year;
  final String? posterUrl;
  final String? overview;
  final DateTime updatedAt;
  const TitleSearchCacheData({
    required this.provider,
    required this.providerId,
    required this.type,
    required this.name,
    this.year,
    this.posterUrl,
    this.overview,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['provider'] = Variable<String>(provider);
    map['provider_id'] = Variable<String>(providerId);
    map['type'] = Variable<String>(type);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || year != null) {
      map['year'] = Variable<String>(year);
    }
    if (!nullToAbsent || posterUrl != null) {
      map['poster_url'] = Variable<String>(posterUrl);
    }
    if (!nullToAbsent || overview != null) {
      map['overview'] = Variable<String>(overview);
    }
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  TitleSearchCacheCompanion toCompanion(bool nullToAbsent) {
    return TitleSearchCacheCompanion(
      provider: Value(provider),
      providerId: Value(providerId),
      type: Value(type),
      name: Value(name),
      year: year == null && nullToAbsent ? const Value.absent() : Value(year),
      posterUrl: posterUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(posterUrl),
      overview: overview == null && nullToAbsent
          ? const Value.absent()
          : Value(overview),
      updatedAt: Value(updatedAt),
    );
  }

  factory TitleSearchCacheData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TitleSearchCacheData(
      provider: serializer.fromJson<String>(json['provider']),
      providerId: serializer.fromJson<String>(json['providerId']),
      type: serializer.fromJson<String>(json['type']),
      name: serializer.fromJson<String>(json['name']),
      year: serializer.fromJson<String?>(json['year']),
      posterUrl: serializer.fromJson<String?>(json['posterUrl']),
      overview: serializer.fromJson<String?>(json['overview']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'provider': serializer.toJson<String>(provider),
      'providerId': serializer.toJson<String>(providerId),
      'type': serializer.toJson<String>(type),
      'name': serializer.toJson<String>(name),
      'year': serializer.toJson<String?>(year),
      'posterUrl': serializer.toJson<String?>(posterUrl),
      'overview': serializer.toJson<String?>(overview),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  TitleSearchCacheData copyWith({
    String? provider,
    String? providerId,
    String? type,
    String? name,
    Value<String?> year = const Value.absent(),
    Value<String?> posterUrl = const Value.absent(),
    Value<String?> overview = const Value.absent(),
    DateTime? updatedAt,
  }) => TitleSearchCacheData(
    provider: provider ?? this.provider,
    providerId: providerId ?? this.providerId,
    type: type ?? this.type,
    name: name ?? this.name,
    year: year.present ? year.value : this.year,
    posterUrl: posterUrl.present ? posterUrl.value : this.posterUrl,
    overview: overview.present ? overview.value : this.overview,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  TitleSearchCacheData copyWithCompanion(TitleSearchCacheCompanion data) {
    return TitleSearchCacheData(
      provider: data.provider.present ? data.provider.value : this.provider,
      providerId: data.providerId.present
          ? data.providerId.value
          : this.providerId,
      type: data.type.present ? data.type.value : this.type,
      name: data.name.present ? data.name.value : this.name,
      year: data.year.present ? data.year.value : this.year,
      posterUrl: data.posterUrl.present ? data.posterUrl.value : this.posterUrl,
      overview: data.overview.present ? data.overview.value : this.overview,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TitleSearchCacheData(')
          ..write('provider: $provider, ')
          ..write('providerId: $providerId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('year: $year, ')
          ..write('posterUrl: $posterUrl, ')
          ..write('overview: $overview, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    provider,
    providerId,
    type,
    name,
    year,
    posterUrl,
    overview,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TitleSearchCacheData &&
          other.provider == this.provider &&
          other.providerId == this.providerId &&
          other.type == this.type &&
          other.name == this.name &&
          other.year == this.year &&
          other.posterUrl == this.posterUrl &&
          other.overview == this.overview &&
          other.updatedAt == this.updatedAt);
}

class TitleSearchCacheCompanion extends UpdateCompanion<TitleSearchCacheData> {
  final Value<String> provider;
  final Value<String> providerId;
  final Value<String> type;
  final Value<String> name;
  final Value<String?> year;
  final Value<String?> posterUrl;
  final Value<String?> overview;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const TitleSearchCacheCompanion({
    this.provider = const Value.absent(),
    this.providerId = const Value.absent(),
    this.type = const Value.absent(),
    this.name = const Value.absent(),
    this.year = const Value.absent(),
    this.posterUrl = const Value.absent(),
    this.overview = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TitleSearchCacheCompanion.insert({
    required String provider,
    required String providerId,
    required String type,
    required String name,
    this.year = const Value.absent(),
    this.posterUrl = const Value.absent(),
    this.overview = const Value.absent(),
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : provider = Value(provider),
       providerId = Value(providerId),
       type = Value(type),
       name = Value(name),
       updatedAt = Value(updatedAt);
  static Insertable<TitleSearchCacheData> custom({
    Expression<String>? provider,
    Expression<String>? providerId,
    Expression<String>? type,
    Expression<String>? name,
    Expression<String>? year,
    Expression<String>? posterUrl,
    Expression<String>? overview,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (provider != null) 'provider': provider,
      if (providerId != null) 'provider_id': providerId,
      if (type != null) 'type': type,
      if (name != null) 'name': name,
      if (year != null) 'year': year,
      if (posterUrl != null) 'poster_url': posterUrl,
      if (overview != null) 'overview': overview,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TitleSearchCacheCompanion copyWith({
    Value<String>? provider,
    Value<String>? providerId,
    Value<String>? type,
    Value<String>? name,
    Value<String?>? year,
    Value<String?>? posterUrl,
    Value<String?>? overview,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return TitleSearchCacheCompanion(
      provider: provider ?? this.provider,
      providerId: providerId ?? this.providerId,
      type: type ?? this.type,
      name: name ?? this.name,
      year: year ?? this.year,
      posterUrl: posterUrl ?? this.posterUrl,
      overview: overview ?? this.overview,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (provider.present) {
      map['provider'] = Variable<String>(provider.value);
    }
    if (providerId.present) {
      map['provider_id'] = Variable<String>(providerId.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (year.present) {
      map['year'] = Variable<String>(year.value);
    }
    if (posterUrl.present) {
      map['poster_url'] = Variable<String>(posterUrl.value);
    }
    if (overview.present) {
      map['overview'] = Variable<String>(overview.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TitleSearchCacheCompanion(')
          ..write('provider: $provider, ')
          ..write('providerId: $providerId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('year: $year, ')
          ..write('posterUrl: $posterUrl, ')
          ..write('overview: $overview, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $WatchLogsTable extends WatchLogs
    with TableInfo<$WatchLogsTable, WatchLogRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $WatchLogsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleIdMeta = const VerificationMeta(
    'titleId',
  );
  @override
  late final GeneratedColumn<String> titleId = GeneratedColumn<String>(
    'title_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<double> rating = GeneratedColumn<double>(
    'rating',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _ottMeta = const VerificationMeta('ott');
  @override
  late final GeneratedColumn<String> ott = GeneratedColumn<String>(
    'ott',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _watchedAtMeta = const VerificationMeta(
    'watchedAt',
  );
  @override
  late final GeneratedColumn<DateTime> watchedAt = GeneratedColumn<DateTime>(
    'watched_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _placeMeta = const VerificationMeta('place');
  @override
  late final GeneratedColumn<String> place = GeneratedColumn<String>(
    'place',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _occasionMeta = const VerificationMeta(
    'occasion',
  );
  @override
  late final GeneratedColumn<String> occasion = GeneratedColumn<String>(
    'occasion',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deletedAtMeta = const VerificationMeta(
    'deletedAt',
  );
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
    'deleted_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    titleId,
    status,
    rating,
    note,
    ott,
    watchedAt,
    place,
    occasion,
    updatedAt,
    deletedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'watch_logs';
  @override
  VerificationContext validateIntegrity(
    Insertable<WatchLogRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title_id')) {
      context.handle(
        _titleIdMeta,
        titleId.isAcceptableOrUnknown(data['title_id']!, _titleIdMeta),
      );
    } else if (isInserting) {
      context.missing(_titleIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('ott')) {
      context.handle(
        _ottMeta,
        ott.isAcceptableOrUnknown(data['ott']!, _ottMeta),
      );
    }
    if (data.containsKey('watched_at')) {
      context.handle(
        _watchedAtMeta,
        watchedAt.isAcceptableOrUnknown(data['watched_at']!, _watchedAtMeta),
      );
    }
    if (data.containsKey('place')) {
      context.handle(
        _placeMeta,
        place.isAcceptableOrUnknown(data['place']!, _placeMeta),
      );
    }
    if (data.containsKey('occasion')) {
      context.handle(
        _occasionMeta,
        occasion.isAcceptableOrUnknown(data['occasion']!, _occasionMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(
        _deletedAtMeta,
        deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  WatchLogRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return WatchLogRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      titleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}rating'],
      ),
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      ),
      ott: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ott'],
      ),
      watchedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}watched_at'],
      ),
      place: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}place'],
      ),
      occasion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}occasion'],
      ),
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      deletedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}deleted_at'],
      ),
    );
  }

  @override
  $WatchLogsTable createAlias(String alias) {
    return $WatchLogsTable(attachedDatabase, alias);
  }
}

class WatchLogRow extends DataClass implements Insertable<WatchLogRow> {
  final String id;
  final String titleId;
  final String status;
  final double? rating;
  final String? note;
  final String? ott;
  final DateTime? watchedAt;
  final String? place;
  final String? occasion;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  const WatchLogRow({
    required this.id,
    required this.titleId,
    required this.status,
    this.rating,
    this.note,
    this.ott,
    this.watchedAt,
    this.place,
    this.occasion,
    required this.updatedAt,
    this.deletedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title_id'] = Variable<String>(titleId);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || rating != null) {
      map['rating'] = Variable<double>(rating);
    }
    if (!nullToAbsent || note != null) {
      map['note'] = Variable<String>(note);
    }
    if (!nullToAbsent || ott != null) {
      map['ott'] = Variable<String>(ott);
    }
    if (!nullToAbsent || watchedAt != null) {
      map['watched_at'] = Variable<DateTime>(watchedAt);
    }
    if (!nullToAbsent || place != null) {
      map['place'] = Variable<String>(place);
    }
    if (!nullToAbsent || occasion != null) {
      map['occasion'] = Variable<String>(occasion);
    }
    map['updated_at'] = Variable<DateTime>(updatedAt);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    return map;
  }

  WatchLogsCompanion toCompanion(bool nullToAbsent) {
    return WatchLogsCompanion(
      id: Value(id),
      titleId: Value(titleId),
      status: Value(status),
      rating: rating == null && nullToAbsent
          ? const Value.absent()
          : Value(rating),
      note: note == null && nullToAbsent ? const Value.absent() : Value(note),
      ott: ott == null && nullToAbsent ? const Value.absent() : Value(ott),
      watchedAt: watchedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(watchedAt),
      place: place == null && nullToAbsent
          ? const Value.absent()
          : Value(place),
      occasion: occasion == null && nullToAbsent
          ? const Value.absent()
          : Value(occasion),
      updatedAt: Value(updatedAt),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
    );
  }

  factory WatchLogRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return WatchLogRow(
      id: serializer.fromJson<String>(json['id']),
      titleId: serializer.fromJson<String>(json['titleId']),
      status: serializer.fromJson<String>(json['status']),
      rating: serializer.fromJson<double?>(json['rating']),
      note: serializer.fromJson<String?>(json['note']),
      ott: serializer.fromJson<String?>(json['ott']),
      watchedAt: serializer.fromJson<DateTime?>(json['watchedAt']),
      place: serializer.fromJson<String?>(json['place']),
      occasion: serializer.fromJson<String?>(json['occasion']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'titleId': serializer.toJson<String>(titleId),
      'status': serializer.toJson<String>(status),
      'rating': serializer.toJson<double?>(rating),
      'note': serializer.toJson<String?>(note),
      'ott': serializer.toJson<String?>(ott),
      'watchedAt': serializer.toJson<DateTime?>(watchedAt),
      'place': serializer.toJson<String?>(place),
      'occasion': serializer.toJson<String?>(occasion),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
    };
  }

  WatchLogRow copyWith({
    String? id,
    String? titleId,
    String? status,
    Value<double?> rating = const Value.absent(),
    Value<String?> note = const Value.absent(),
    Value<String?> ott = const Value.absent(),
    Value<DateTime?> watchedAt = const Value.absent(),
    Value<String?> place = const Value.absent(),
    Value<String?> occasion = const Value.absent(),
    DateTime? updatedAt,
    Value<DateTime?> deletedAt = const Value.absent(),
  }) => WatchLogRow(
    id: id ?? this.id,
    titleId: titleId ?? this.titleId,
    status: status ?? this.status,
    rating: rating.present ? rating.value : this.rating,
    note: note.present ? note.value : this.note,
    ott: ott.present ? ott.value : this.ott,
    watchedAt: watchedAt.present ? watchedAt.value : this.watchedAt,
    place: place.present ? place.value : this.place,
    occasion: occasion.present ? occasion.value : this.occasion,
    updatedAt: updatedAt ?? this.updatedAt,
    deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
  );
  WatchLogRow copyWithCompanion(WatchLogsCompanion data) {
    return WatchLogRow(
      id: data.id.present ? data.id.value : this.id,
      titleId: data.titleId.present ? data.titleId.value : this.titleId,
      status: data.status.present ? data.status.value : this.status,
      rating: data.rating.present ? data.rating.value : this.rating,
      note: data.note.present ? data.note.value : this.note,
      ott: data.ott.present ? data.ott.value : this.ott,
      watchedAt: data.watchedAt.present ? data.watchedAt.value : this.watchedAt,
      place: data.place.present ? data.place.value : this.place,
      occasion: data.occasion.present ? data.occasion.value : this.occasion,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('WatchLogRow(')
          ..write('id: $id, ')
          ..write('titleId: $titleId, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('note: $note, ')
          ..write('ott: $ott, ')
          ..write('watchedAt: $watchedAt, ')
          ..write('place: $place, ')
          ..write('occasion: $occasion, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    titleId,
    status,
    rating,
    note,
    ott,
    watchedAt,
    place,
    occasion,
    updatedAt,
    deletedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WatchLogRow &&
          other.id == this.id &&
          other.titleId == this.titleId &&
          other.status == this.status &&
          other.rating == this.rating &&
          other.note == this.note &&
          other.ott == this.ott &&
          other.watchedAt == this.watchedAt &&
          other.place == this.place &&
          other.occasion == this.occasion &&
          other.updatedAt == this.updatedAt &&
          other.deletedAt == this.deletedAt);
}

class WatchLogsCompanion extends UpdateCompanion<WatchLogRow> {
  final Value<String> id;
  final Value<String> titleId;
  final Value<String> status;
  final Value<double?> rating;
  final Value<String?> note;
  final Value<String?> ott;
  final Value<DateTime?> watchedAt;
  final Value<String?> place;
  final Value<String?> occasion;
  final Value<DateTime> updatedAt;
  final Value<DateTime?> deletedAt;
  final Value<int> rowid;
  const WatchLogsCompanion({
    this.id = const Value.absent(),
    this.titleId = const Value.absent(),
    this.status = const Value.absent(),
    this.rating = const Value.absent(),
    this.note = const Value.absent(),
    this.ott = const Value.absent(),
    this.watchedAt = const Value.absent(),
    this.place = const Value.absent(),
    this.occasion = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  WatchLogsCompanion.insert({
    required String id,
    required String titleId,
    required String status,
    this.rating = const Value.absent(),
    this.note = const Value.absent(),
    this.ott = const Value.absent(),
    this.watchedAt = const Value.absent(),
    this.place = const Value.absent(),
    this.occasion = const Value.absent(),
    required DateTime updatedAt,
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       titleId = Value(titleId),
       status = Value(status),
       updatedAt = Value(updatedAt);
  static Insertable<WatchLogRow> custom({
    Expression<String>? id,
    Expression<String>? titleId,
    Expression<String>? status,
    Expression<double>? rating,
    Expression<String>? note,
    Expression<String>? ott,
    Expression<DateTime>? watchedAt,
    Expression<String>? place,
    Expression<String>? occasion,
    Expression<DateTime>? updatedAt,
    Expression<DateTime>? deletedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (titleId != null) 'title_id': titleId,
      if (status != null) 'status': status,
      if (rating != null) 'rating': rating,
      if (note != null) 'note': note,
      if (ott != null) 'ott': ott,
      if (watchedAt != null) 'watched_at': watchedAt,
      if (place != null) 'place': place,
      if (occasion != null) 'occasion': occasion,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  WatchLogsCompanion copyWith({
    Value<String>? id,
    Value<String>? titleId,
    Value<String>? status,
    Value<double?>? rating,
    Value<String?>? note,
    Value<String?>? ott,
    Value<DateTime?>? watchedAt,
    Value<String?>? place,
    Value<String?>? occasion,
    Value<DateTime>? updatedAt,
    Value<DateTime?>? deletedAt,
    Value<int>? rowid,
  }) {
    return WatchLogsCompanion(
      id: id ?? this.id,
      titleId: titleId ?? this.titleId,
      status: status ?? this.status,
      rating: rating ?? this.rating,
      note: note ?? this.note,
      ott: ott ?? this.ott,
      watchedAt: watchedAt ?? this.watchedAt,
      place: place ?? this.place,
      occasion: occasion ?? this.occasion,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (titleId.present) {
      map['title_id'] = Variable<String>(titleId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rating.present) {
      map['rating'] = Variable<double>(rating.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (ott.present) {
      map['ott'] = Variable<String>(ott.value);
    }
    if (watchedAt.present) {
      map['watched_at'] = Variable<DateTime>(watchedAt.value);
    }
    if (place.present) {
      map['place'] = Variable<String>(place.value);
    }
    if (occasion.present) {
      map['occasion'] = Variable<String>(occasion.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('WatchLogsCompanion(')
          ..write('id: $id, ')
          ..write('titleId: $titleId, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('note: $note, ')
          ..write('ott: $ott, ')
          ..write('watchedAt: $watchedAt, ')
          ..write('place: $place, ')
          ..write('occasion: $occasion, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $WatchLogHistoryTable extends WatchLogHistory
    with TableInfo<$WatchLogHistoryTable, WatchLogHistoryData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $WatchLogHistoryTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _logIdMeta = const VerificationMeta('logId');
  @override
  late final GeneratedColumn<String> logId = GeneratedColumn<String>(
    'log_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _recordedAtMeta = const VerificationMeta(
    'recordedAt',
  );
  @override
  late final GeneratedColumn<DateTime> recordedAt = GeneratedColumn<DateTime>(
    'recorded_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<double> rating = GeneratedColumn<double>(
    'rating',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _ottMeta = const VerificationMeta('ott');
  @override
  late final GeneratedColumn<String> ott = GeneratedColumn<String>(
    'ott',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _watchedAtMeta = const VerificationMeta(
    'watchedAt',
  );
  @override
  late final GeneratedColumn<DateTime> watchedAt = GeneratedColumn<DateTime>(
    'watched_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _placeMeta = const VerificationMeta('place');
  @override
  late final GeneratedColumn<String> place = GeneratedColumn<String>(
    'place',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _occasionMeta = const VerificationMeta(
    'occasion',
  );
  @override
  late final GeneratedColumn<String> occasion = GeneratedColumn<String>(
    'occasion',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    logId,
    recordedAt,
    status,
    rating,
    note,
    ott,
    watchedAt,
    place,
    occasion,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'watch_log_history';
  @override
  VerificationContext validateIntegrity(
    Insertable<WatchLogHistoryData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('log_id')) {
      context.handle(
        _logIdMeta,
        logId.isAcceptableOrUnknown(data['log_id']!, _logIdMeta),
      );
    } else if (isInserting) {
      context.missing(_logIdMeta);
    }
    if (data.containsKey('recorded_at')) {
      context.handle(
        _recordedAtMeta,
        recordedAt.isAcceptableOrUnknown(data['recorded_at']!, _recordedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_recordedAtMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('ott')) {
      context.handle(
        _ottMeta,
        ott.isAcceptableOrUnknown(data['ott']!, _ottMeta),
      );
    }
    if (data.containsKey('watched_at')) {
      context.handle(
        _watchedAtMeta,
        watchedAt.isAcceptableOrUnknown(data['watched_at']!, _watchedAtMeta),
      );
    }
    if (data.containsKey('place')) {
      context.handle(
        _placeMeta,
        place.isAcceptableOrUnknown(data['place']!, _placeMeta),
      );
    }
    if (data.containsKey('occasion')) {
      context.handle(
        _occasionMeta,
        occasion.isAcceptableOrUnknown(data['occasion']!, _occasionMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  WatchLogHistoryData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return WatchLogHistoryData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      logId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}log_id'],
      )!,
      recordedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}recorded_at'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}rating'],
      ),
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      ),
      ott: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ott'],
      ),
      watchedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}watched_at'],
      ),
      place: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}place'],
      ),
      occasion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}occasion'],
      ),
    );
  }

  @override
  $WatchLogHistoryTable createAlias(String alias) {
    return $WatchLogHistoryTable(attachedDatabase, alias);
  }
}

class WatchLogHistoryData extends DataClass
    implements Insertable<WatchLogHistoryData> {
  final int id;
  final String logId;
  final DateTime recordedAt;
  final String status;
  final double? rating;
  final String? note;
  final String? ott;
  final DateTime? watchedAt;
  final String? place;
  final String? occasion;
  const WatchLogHistoryData({
    required this.id,
    required this.logId,
    required this.recordedAt,
    required this.status,
    this.rating,
    this.note,
    this.ott,
    this.watchedAt,
    this.place,
    this.occasion,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['log_id'] = Variable<String>(logId);
    map['recorded_at'] = Variable<DateTime>(recordedAt);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || rating != null) {
      map['rating'] = Variable<double>(rating);
    }
    if (!nullToAbsent || note != null) {
      map['note'] = Variable<String>(note);
    }
    if (!nullToAbsent || ott != null) {
      map['ott'] = Variable<String>(ott);
    }
    if (!nullToAbsent || watchedAt != null) {
      map['watched_at'] = Variable<DateTime>(watchedAt);
    }
    if (!nullToAbsent || place != null) {
      map['place'] = Variable<String>(place);
    }
    if (!nullToAbsent || occasion != null) {
      map['occasion'] = Variable<String>(occasion);
    }
    return map;
  }

  WatchLogHistoryCompanion toCompanion(bool nullToAbsent) {
    return WatchLogHistoryCompanion(
      id: Value(id),
      logId: Value(logId),
      recordedAt: Value(recordedAt),
      status: Value(status),
      rating: rating == null && nullToAbsent
          ? const Value.absent()
          : Value(rating),
      note: note == null && nullToAbsent ? const Value.absent() : Value(note),
      ott: ott == null && nullToAbsent ? const Value.absent() : Value(ott),
      watchedAt: watchedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(watchedAt),
      place: place == null && nullToAbsent
          ? const Value.absent()
          : Value(place),
      occasion: occasion == null && nullToAbsent
          ? const Value.absent()
          : Value(occasion),
    );
  }

  factory WatchLogHistoryData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return WatchLogHistoryData(
      id: serializer.fromJson<int>(json['id']),
      logId: serializer.fromJson<String>(json['logId']),
      recordedAt: serializer.fromJson<DateTime>(json['recordedAt']),
      status: serializer.fromJson<String>(json['status']),
      rating: serializer.fromJson<double?>(json['rating']),
      note: serializer.fromJson<String?>(json['note']),
      ott: serializer.fromJson<String?>(json['ott']),
      watchedAt: serializer.fromJson<DateTime?>(json['watchedAt']),
      place: serializer.fromJson<String?>(json['place']),
      occasion: serializer.fromJson<String?>(json['occasion']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'logId': serializer.toJson<String>(logId),
      'recordedAt': serializer.toJson<DateTime>(recordedAt),
      'status': serializer.toJson<String>(status),
      'rating': serializer.toJson<double?>(rating),
      'note': serializer.toJson<String?>(note),
      'ott': serializer.toJson<String?>(ott),
      'watchedAt': serializer.toJson<DateTime?>(watchedAt),
      'place': serializer.toJson<String?>(place),
      'occasion': serializer.toJson<String?>(occasion),
    };
  }

  WatchLogHistoryData copyWith({
    int? id,
    String? logId,
    DateTime? recordedAt,
    String? status,
    Value<double?> rating = const Value.absent(),
    Value<String?> note = const Value.absent(),
    Value<String?> ott = const Value.absent(),
    Value<DateTime?> watchedAt = const Value.absent(),
    Value<String?> place = const Value.absent(),
    Value<String?> occasion = const Value.absent(),
  }) => WatchLogHistoryData(
    id: id ?? this.id,
    logId: logId ?? this.logId,
    recordedAt: recordedAt ?? this.recordedAt,
    status: status ?? this.status,
    rating: rating.present ? rating.value : this.rating,
    note: note.present ? note.value : this.note,
    ott: ott.present ? ott.value : this.ott,
    watchedAt: watchedAt.present ? watchedAt.value : this.watchedAt,
    place: place.present ? place.value : this.place,
    occasion: occasion.present ? occasion.value : this.occasion,
  );
  WatchLogHistoryData copyWithCompanion(WatchLogHistoryCompanion data) {
    return WatchLogHistoryData(
      id: data.id.present ? data.id.value : this.id,
      logId: data.logId.present ? data.logId.value : this.logId,
      recordedAt: data.recordedAt.present
          ? data.recordedAt.value
          : this.recordedAt,
      status: data.status.present ? data.status.value : this.status,
      rating: data.rating.present ? data.rating.value : this.rating,
      note: data.note.present ? data.note.value : this.note,
      ott: data.ott.present ? data.ott.value : this.ott,
      watchedAt: data.watchedAt.present ? data.watchedAt.value : this.watchedAt,
      place: data.place.present ? data.place.value : this.place,
      occasion: data.occasion.present ? data.occasion.value : this.occasion,
    );
  }

  @override
  String toString() {
    return (StringBuffer('WatchLogHistoryData(')
          ..write('id: $id, ')
          ..write('logId: $logId, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('note: $note, ')
          ..write('ott: $ott, ')
          ..write('watchedAt: $watchedAt, ')
          ..write('place: $place, ')
          ..write('occasion: $occasion')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    logId,
    recordedAt,
    status,
    rating,
    note,
    ott,
    watchedAt,
    place,
    occasion,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WatchLogHistoryData &&
          other.id == this.id &&
          other.logId == this.logId &&
          other.recordedAt == this.recordedAt &&
          other.status == this.status &&
          other.rating == this.rating &&
          other.note == this.note &&
          other.ott == this.ott &&
          other.watchedAt == this.watchedAt &&
          other.place == this.place &&
          other.occasion == this.occasion);
}

class WatchLogHistoryCompanion extends UpdateCompanion<WatchLogHistoryData> {
  final Value<int> id;
  final Value<String> logId;
  final Value<DateTime> recordedAt;
  final Value<String> status;
  final Value<double?> rating;
  final Value<String?> note;
  final Value<String?> ott;
  final Value<DateTime?> watchedAt;
  final Value<String?> place;
  final Value<String?> occasion;
  const WatchLogHistoryCompanion({
    this.id = const Value.absent(),
    this.logId = const Value.absent(),
    this.recordedAt = const Value.absent(),
    this.status = const Value.absent(),
    this.rating = const Value.absent(),
    this.note = const Value.absent(),
    this.ott = const Value.absent(),
    this.watchedAt = const Value.absent(),
    this.place = const Value.absent(),
    this.occasion = const Value.absent(),
  });
  WatchLogHistoryCompanion.insert({
    this.id = const Value.absent(),
    required String logId,
    required DateTime recordedAt,
    required String status,
    this.rating = const Value.absent(),
    this.note = const Value.absent(),
    this.ott = const Value.absent(),
    this.watchedAt = const Value.absent(),
    this.place = const Value.absent(),
    this.occasion = const Value.absent(),
  }) : logId = Value(logId),
       recordedAt = Value(recordedAt),
       status = Value(status);
  static Insertable<WatchLogHistoryData> custom({
    Expression<int>? id,
    Expression<String>? logId,
    Expression<DateTime>? recordedAt,
    Expression<String>? status,
    Expression<double>? rating,
    Expression<String>? note,
    Expression<String>? ott,
    Expression<DateTime>? watchedAt,
    Expression<String>? place,
    Expression<String>? occasion,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (logId != null) 'log_id': logId,
      if (recordedAt != null) 'recorded_at': recordedAt,
      if (status != null) 'status': status,
      if (rating != null) 'rating': rating,
      if (note != null) 'note': note,
      if (ott != null) 'ott': ott,
      if (watchedAt != null) 'watched_at': watchedAt,
      if (place != null) 'place': place,
      if (occasion != null) 'occasion': occasion,
    });
  }

  WatchLogHistoryCompanion copyWith({
    Value<int>? id,
    Value<String>? logId,
    Value<DateTime>? recordedAt,
    Value<String>? status,
    Value<double?>? rating,
    Value<String?>? note,
    Value<String?>? ott,
    Value<DateTime?>? watchedAt,
    Value<String?>? place,
    Value<String?>? occasion,
  }) {
    return WatchLogHistoryCompanion(
      id: id ?? this.id,
      logId: logId ?? this.logId,
      recordedAt: recordedAt ?? this.recordedAt,
      status: status ?? this.status,
      rating: rating ?? this.rating,
      note: note ?? this.note,
      ott: ott ?? this.ott,
      watchedAt: watchedAt ?? this.watchedAt,
      place: place ?? this.place,
      occasion: occasion ?? this.occasion,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (logId.present) {
      map['log_id'] = Variable<String>(logId.value);
    }
    if (recordedAt.present) {
      map['recorded_at'] = Variable<DateTime>(recordedAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rating.present) {
      map['rating'] = Variable<double>(rating.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (ott.present) {
      map['ott'] = Variable<String>(ott.value);
    }
    if (watchedAt.present) {
      map['watched_at'] = Variable<DateTime>(watchedAt.value);
    }
    if (place.present) {
      map['place'] = Variable<String>(place.value);
    }
    if (occasion.present) {
      map['occasion'] = Variable<String>(occasion.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('WatchLogHistoryCompanion(')
          ..write('id: $id, ')
          ..write('logId: $logId, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('note: $note, ')
          ..write('ott: $ott, ')
          ..write('watchedAt: $watchedAt, ')
          ..write('place: $place, ')
          ..write('occasion: $occasion')
          ..write(')'))
        .toString();
  }
}

class $OutboxTable extends Outbox with TableInfo<$OutboxTable, OutboxData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _entityMeta = const VerificationMeta('entity');
  @override
  late final GeneratedColumn<String> entity = GeneratedColumn<String>(
    'entity',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _opMeta = const VerificationMeta('op');
  @override
  late final GeneratedColumn<String> op = GeneratedColumn<String>(
    'op',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _errorMeta = const VerificationMeta('error');
  @override
  late final GeneratedColumn<String> error = GeneratedColumn<String>(
    'error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    entity,
    op,
    payloadJson,
    createdAt,
    status,
    error,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('entity')) {
      context.handle(
        _entityMeta,
        entity.isAcceptableOrUnknown(data['entity']!, _entityMeta),
      );
    } else if (isInserting) {
      context.missing(_entityMeta);
    }
    if (data.containsKey('op')) {
      context.handle(_opMeta, op.isAcceptableOrUnknown(data['op']!, _opMeta));
    } else if (isInserting) {
      context.missing(_opMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('error')) {
      context.handle(
        _errorMeta,
        error.isAcceptableOrUnknown(data['error']!, _errorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OutboxData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      entity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity'],
      )!,
      op: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}op'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      error: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error'],
      ),
    );
  }

  @override
  $OutboxTable createAlias(String alias) {
    return $OutboxTable(attachedDatabase, alias);
  }
}

class OutboxData extends DataClass implements Insertable<OutboxData> {
  final int id;
  final String entity;
  final String op;
  final String payloadJson;
  final DateTime createdAt;
  final String status;
  final String? error;
  const OutboxData({
    required this.id,
    required this.entity,
    required this.op,
    required this.payloadJson,
    required this.createdAt,
    required this.status,
    this.error,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['entity'] = Variable<String>(entity);
    map['op'] = Variable<String>(op);
    map['payload_json'] = Variable<String>(payloadJson);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || error != null) {
      map['error'] = Variable<String>(error);
    }
    return map;
  }

  OutboxCompanion toCompanion(bool nullToAbsent) {
    return OutboxCompanion(
      id: Value(id),
      entity: Value(entity),
      op: Value(op),
      payloadJson: Value(payloadJson),
      createdAt: Value(createdAt),
      status: Value(status),
      error: error == null && nullToAbsent
          ? const Value.absent()
          : Value(error),
    );
  }

  factory OutboxData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxData(
      id: serializer.fromJson<int>(json['id']),
      entity: serializer.fromJson<String>(json['entity']),
      op: serializer.fromJson<String>(json['op']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      status: serializer.fromJson<String>(json['status']),
      error: serializer.fromJson<String?>(json['error']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'entity': serializer.toJson<String>(entity),
      'op': serializer.toJson<String>(op),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'status': serializer.toJson<String>(status),
      'error': serializer.toJson<String?>(error),
    };
  }

  OutboxData copyWith({
    int? id,
    String? entity,
    String? op,
    String? payloadJson,
    DateTime? createdAt,
    String? status,
    Value<String?> error = const Value.absent(),
  }) => OutboxData(
    id: id ?? this.id,
    entity: entity ?? this.entity,
    op: op ?? this.op,
    payloadJson: payloadJson ?? this.payloadJson,
    createdAt: createdAt ?? this.createdAt,
    status: status ?? this.status,
    error: error.present ? error.value : this.error,
  );
  OutboxData copyWithCompanion(OutboxCompanion data) {
    return OutboxData(
      id: data.id.present ? data.id.value : this.id,
      entity: data.entity.present ? data.entity.value : this.entity,
      op: data.op.present ? data.op.value : this.op,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      status: data.status.present ? data.status.value : this.status,
      error: data.error.present ? data.error.value : this.error,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxData(')
          ..write('id: $id, ')
          ..write('entity: $entity, ')
          ..write('op: $op, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, entity, op, payloadJson, createdAt, status, error);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxData &&
          other.id == this.id &&
          other.entity == this.entity &&
          other.op == this.op &&
          other.payloadJson == this.payloadJson &&
          other.createdAt == this.createdAt &&
          other.status == this.status &&
          other.error == this.error);
}

class OutboxCompanion extends UpdateCompanion<OutboxData> {
  final Value<int> id;
  final Value<String> entity;
  final Value<String> op;
  final Value<String> payloadJson;
  final Value<DateTime> createdAt;
  final Value<String> status;
  final Value<String?> error;
  const OutboxCompanion({
    this.id = const Value.absent(),
    this.entity = const Value.absent(),
    this.op = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.status = const Value.absent(),
    this.error = const Value.absent(),
  });
  OutboxCompanion.insert({
    this.id = const Value.absent(),
    required String entity,
    required String op,
    required String payloadJson,
    required DateTime createdAt,
    required String status,
    this.error = const Value.absent(),
  }) : entity = Value(entity),
       op = Value(op),
       payloadJson = Value(payloadJson),
       createdAt = Value(createdAt),
       status = Value(status);
  static Insertable<OutboxData> custom({
    Expression<int>? id,
    Expression<String>? entity,
    Expression<String>? op,
    Expression<String>? payloadJson,
    Expression<DateTime>? createdAt,
    Expression<String>? status,
    Expression<String>? error,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (entity != null) 'entity': entity,
      if (op != null) 'op': op,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (createdAt != null) 'created_at': createdAt,
      if (status != null) 'status': status,
      if (error != null) 'error': error,
    });
  }

  OutboxCompanion copyWith({
    Value<int>? id,
    Value<String>? entity,
    Value<String>? op,
    Value<String>? payloadJson,
    Value<DateTime>? createdAt,
    Value<String>? status,
    Value<String?>? error,
  }) {
    return OutboxCompanion(
      id: id ?? this.id,
      entity: entity ?? this.entity,
      op: op ?? this.op,
      payloadJson: payloadJson ?? this.payloadJson,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
      error: error ?? this.error,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (entity.present) {
      map['entity'] = Variable<String>(entity.value);
    }
    if (op.present) {
      map['op'] = Variable<String>(op.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (error.present) {
      map['error'] = Variable<String>(error.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxCompanion(')
          ..write('id: $id, ')
          ..write('entity: $entity, ')
          ..write('op: $op, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $TitlesTable titles = $TitlesTable(this);
  late final $TitleSearchCacheTable titleSearchCache = $TitleSearchCacheTable(
    this,
  );
  late final $WatchLogsTable watchLogs = $WatchLogsTable(this);
  late final $WatchLogHistoryTable watchLogHistory = $WatchLogHistoryTable(
    this,
  );
  late final $OutboxTable outbox = $OutboxTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    titles,
    titleSearchCache,
    watchLogs,
    watchLogHistory,
    outbox,
  ];
}

typedef $$TitlesTableCreateCompanionBuilder =
    TitlesCompanion Function({
      required String id,
      required String provider,
      required String providerId,
      required String type,
      required String name,
      Value<String?> year,
      Value<String?> posterUrl,
      Value<String?> overview,
      required DateTime updatedAt,
      Value<DateTime?> deletedAt,
      Value<int> rowid,
    });
typedef $$TitlesTableUpdateCompanionBuilder =
    TitlesCompanion Function({
      Value<String> id,
      Value<String> provider,
      Value<String> providerId,
      Value<String> type,
      Value<String> name,
      Value<String?> year,
      Value<String?> posterUrl,
      Value<String?> overview,
      Value<DateTime> updatedAt,
      Value<DateTime?> deletedAt,
      Value<int> rowid,
    });

class $$TitlesTableFilterComposer
    extends Composer<_$AppDatabase, $TitlesTable> {
  $$TitlesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get provider => $composableBuilder(
    column: $table.provider,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get posterUrl => $composableBuilder(
    column: $table.posterUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get overview => $composableBuilder(
    column: $table.overview,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TitlesTableOrderingComposer
    extends Composer<_$AppDatabase, $TitlesTable> {
  $$TitlesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get provider => $composableBuilder(
    column: $table.provider,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get posterUrl => $composableBuilder(
    column: $table.posterUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get overview => $composableBuilder(
    column: $table.overview,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TitlesTableAnnotationComposer
    extends Composer<_$AppDatabase, $TitlesTable> {
  $$TitlesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get provider =>
      $composableBuilder(column: $table.provider, builder: (column) => column);

  GeneratedColumn<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get year =>
      $composableBuilder(column: $table.year, builder: (column) => column);

  GeneratedColumn<String> get posterUrl =>
      $composableBuilder(column: $table.posterUrl, builder: (column) => column);

  GeneratedColumn<String> get overview =>
      $composableBuilder(column: $table.overview, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);
}

class $$TitlesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TitlesTable,
          TitleRow,
          $$TitlesTableFilterComposer,
          $$TitlesTableOrderingComposer,
          $$TitlesTableAnnotationComposer,
          $$TitlesTableCreateCompanionBuilder,
          $$TitlesTableUpdateCompanionBuilder,
          (TitleRow, BaseReferences<_$AppDatabase, $TitlesTable, TitleRow>),
          TitleRow,
          PrefetchHooks Function()
        > {
  $$TitlesTableTableManager(_$AppDatabase db, $TitlesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TitlesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TitlesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TitlesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> provider = const Value.absent(),
                Value<String> providerId = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> year = const Value.absent(),
                Value<String?> posterUrl = const Value.absent(),
                Value<String?> overview = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<DateTime?> deletedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TitlesCompanion(
                id: id,
                provider: provider,
                providerId: providerId,
                type: type,
                name: name,
                year: year,
                posterUrl: posterUrl,
                overview: overview,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String provider,
                required String providerId,
                required String type,
                required String name,
                Value<String?> year = const Value.absent(),
                Value<String?> posterUrl = const Value.absent(),
                Value<String?> overview = const Value.absent(),
                required DateTime updatedAt,
                Value<DateTime?> deletedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TitlesCompanion.insert(
                id: id,
                provider: provider,
                providerId: providerId,
                type: type,
                name: name,
                year: year,
                posterUrl: posterUrl,
                overview: overview,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TitlesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TitlesTable,
      TitleRow,
      $$TitlesTableFilterComposer,
      $$TitlesTableOrderingComposer,
      $$TitlesTableAnnotationComposer,
      $$TitlesTableCreateCompanionBuilder,
      $$TitlesTableUpdateCompanionBuilder,
      (TitleRow, BaseReferences<_$AppDatabase, $TitlesTable, TitleRow>),
      TitleRow,
      PrefetchHooks Function()
    >;
typedef $$TitleSearchCacheTableCreateCompanionBuilder =
    TitleSearchCacheCompanion Function({
      required String provider,
      required String providerId,
      required String type,
      required String name,
      Value<String?> year,
      Value<String?> posterUrl,
      Value<String?> overview,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$TitleSearchCacheTableUpdateCompanionBuilder =
    TitleSearchCacheCompanion Function({
      Value<String> provider,
      Value<String> providerId,
      Value<String> type,
      Value<String> name,
      Value<String?> year,
      Value<String?> posterUrl,
      Value<String?> overview,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$TitleSearchCacheTableFilterComposer
    extends Composer<_$AppDatabase, $TitleSearchCacheTable> {
  $$TitleSearchCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get provider => $composableBuilder(
    column: $table.provider,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get posterUrl => $composableBuilder(
    column: $table.posterUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get overview => $composableBuilder(
    column: $table.overview,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TitleSearchCacheTableOrderingComposer
    extends Composer<_$AppDatabase, $TitleSearchCacheTable> {
  $$TitleSearchCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get provider => $composableBuilder(
    column: $table.provider,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get posterUrl => $composableBuilder(
    column: $table.posterUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get overview => $composableBuilder(
    column: $table.overview,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TitleSearchCacheTableAnnotationComposer
    extends Composer<_$AppDatabase, $TitleSearchCacheTable> {
  $$TitleSearchCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get provider =>
      $composableBuilder(column: $table.provider, builder: (column) => column);

  GeneratedColumn<String> get providerId => $composableBuilder(
    column: $table.providerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get year =>
      $composableBuilder(column: $table.year, builder: (column) => column);

  GeneratedColumn<String> get posterUrl =>
      $composableBuilder(column: $table.posterUrl, builder: (column) => column);

  GeneratedColumn<String> get overview =>
      $composableBuilder(column: $table.overview, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$TitleSearchCacheTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TitleSearchCacheTable,
          TitleSearchCacheData,
          $$TitleSearchCacheTableFilterComposer,
          $$TitleSearchCacheTableOrderingComposer,
          $$TitleSearchCacheTableAnnotationComposer,
          $$TitleSearchCacheTableCreateCompanionBuilder,
          $$TitleSearchCacheTableUpdateCompanionBuilder,
          (
            TitleSearchCacheData,
            BaseReferences<
              _$AppDatabase,
              $TitleSearchCacheTable,
              TitleSearchCacheData
            >,
          ),
          TitleSearchCacheData,
          PrefetchHooks Function()
        > {
  $$TitleSearchCacheTableTableManager(
    _$AppDatabase db,
    $TitleSearchCacheTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TitleSearchCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TitleSearchCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TitleSearchCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> provider = const Value.absent(),
                Value<String> providerId = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> year = const Value.absent(),
                Value<String?> posterUrl = const Value.absent(),
                Value<String?> overview = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TitleSearchCacheCompanion(
                provider: provider,
                providerId: providerId,
                type: type,
                name: name,
                year: year,
                posterUrl: posterUrl,
                overview: overview,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String provider,
                required String providerId,
                required String type,
                required String name,
                Value<String?> year = const Value.absent(),
                Value<String?> posterUrl = const Value.absent(),
                Value<String?> overview = const Value.absent(),
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => TitleSearchCacheCompanion.insert(
                provider: provider,
                providerId: providerId,
                type: type,
                name: name,
                year: year,
                posterUrl: posterUrl,
                overview: overview,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TitleSearchCacheTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TitleSearchCacheTable,
      TitleSearchCacheData,
      $$TitleSearchCacheTableFilterComposer,
      $$TitleSearchCacheTableOrderingComposer,
      $$TitleSearchCacheTableAnnotationComposer,
      $$TitleSearchCacheTableCreateCompanionBuilder,
      $$TitleSearchCacheTableUpdateCompanionBuilder,
      (
        TitleSearchCacheData,
        BaseReferences<
          _$AppDatabase,
          $TitleSearchCacheTable,
          TitleSearchCacheData
        >,
      ),
      TitleSearchCacheData,
      PrefetchHooks Function()
    >;
typedef $$WatchLogsTableCreateCompanionBuilder =
    WatchLogsCompanion Function({
      required String id,
      required String titleId,
      required String status,
      Value<double?> rating,
      Value<String?> note,
      Value<String?> ott,
      Value<DateTime?> watchedAt,
      Value<String?> place,
      Value<String?> occasion,
      required DateTime updatedAt,
      Value<DateTime?> deletedAt,
      Value<int> rowid,
    });
typedef $$WatchLogsTableUpdateCompanionBuilder =
    WatchLogsCompanion Function({
      Value<String> id,
      Value<String> titleId,
      Value<String> status,
      Value<double?> rating,
      Value<String?> note,
      Value<String?> ott,
      Value<DateTime?> watchedAt,
      Value<String?> place,
      Value<String?> occasion,
      Value<DateTime> updatedAt,
      Value<DateTime?> deletedAt,
      Value<int> rowid,
    });

class $$WatchLogsTableFilterComposer
    extends Composer<_$AppDatabase, $WatchLogsTable> {
  $$WatchLogsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get titleId => $composableBuilder(
    column: $table.titleId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ott => $composableBuilder(
    column: $table.ott,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get watchedAt => $composableBuilder(
    column: $table.watchedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get place => $composableBuilder(
    column: $table.place,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get occasion => $composableBuilder(
    column: $table.occasion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$WatchLogsTableOrderingComposer
    extends Composer<_$AppDatabase, $WatchLogsTable> {
  $$WatchLogsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get titleId => $composableBuilder(
    column: $table.titleId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ott => $composableBuilder(
    column: $table.ott,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get watchedAt => $composableBuilder(
    column: $table.watchedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get place => $composableBuilder(
    column: $table.place,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get occasion => $composableBuilder(
    column: $table.occasion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$WatchLogsTableAnnotationComposer
    extends Composer<_$AppDatabase, $WatchLogsTable> {
  $$WatchLogsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get titleId =>
      $composableBuilder(column: $table.titleId, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<double> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<String> get ott =>
      $composableBuilder(column: $table.ott, builder: (column) => column);

  GeneratedColumn<DateTime> get watchedAt =>
      $composableBuilder(column: $table.watchedAt, builder: (column) => column);

  GeneratedColumn<String> get place =>
      $composableBuilder(column: $table.place, builder: (column) => column);

  GeneratedColumn<String> get occasion =>
      $composableBuilder(column: $table.occasion, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);
}

class $$WatchLogsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $WatchLogsTable,
          WatchLogRow,
          $$WatchLogsTableFilterComposer,
          $$WatchLogsTableOrderingComposer,
          $$WatchLogsTableAnnotationComposer,
          $$WatchLogsTableCreateCompanionBuilder,
          $$WatchLogsTableUpdateCompanionBuilder,
          (
            WatchLogRow,
            BaseReferences<_$AppDatabase, $WatchLogsTable, WatchLogRow>,
          ),
          WatchLogRow,
          PrefetchHooks Function()
        > {
  $$WatchLogsTableTableManager(_$AppDatabase db, $WatchLogsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$WatchLogsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$WatchLogsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$WatchLogsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> titleId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<double?> rating = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String?> ott = const Value.absent(),
                Value<DateTime?> watchedAt = const Value.absent(),
                Value<String?> place = const Value.absent(),
                Value<String?> occasion = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<DateTime?> deletedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => WatchLogsCompanion(
                id: id,
                titleId: titleId,
                status: status,
                rating: rating,
                note: note,
                ott: ott,
                watchedAt: watchedAt,
                place: place,
                occasion: occasion,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String titleId,
                required String status,
                Value<double?> rating = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String?> ott = const Value.absent(),
                Value<DateTime?> watchedAt = const Value.absent(),
                Value<String?> place = const Value.absent(),
                Value<String?> occasion = const Value.absent(),
                required DateTime updatedAt,
                Value<DateTime?> deletedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => WatchLogsCompanion.insert(
                id: id,
                titleId: titleId,
                status: status,
                rating: rating,
                note: note,
                ott: ott,
                watchedAt: watchedAt,
                place: place,
                occasion: occasion,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$WatchLogsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $WatchLogsTable,
      WatchLogRow,
      $$WatchLogsTableFilterComposer,
      $$WatchLogsTableOrderingComposer,
      $$WatchLogsTableAnnotationComposer,
      $$WatchLogsTableCreateCompanionBuilder,
      $$WatchLogsTableUpdateCompanionBuilder,
      (
        WatchLogRow,
        BaseReferences<_$AppDatabase, $WatchLogsTable, WatchLogRow>,
      ),
      WatchLogRow,
      PrefetchHooks Function()
    >;
typedef $$WatchLogHistoryTableCreateCompanionBuilder =
    WatchLogHistoryCompanion Function({
      Value<int> id,
      required String logId,
      required DateTime recordedAt,
      required String status,
      Value<double?> rating,
      Value<String?> note,
      Value<String?> ott,
      Value<DateTime?> watchedAt,
      Value<String?> place,
      Value<String?> occasion,
    });
typedef $$WatchLogHistoryTableUpdateCompanionBuilder =
    WatchLogHistoryCompanion Function({
      Value<int> id,
      Value<String> logId,
      Value<DateTime> recordedAt,
      Value<String> status,
      Value<double?> rating,
      Value<String?> note,
      Value<String?> ott,
      Value<DateTime?> watchedAt,
      Value<String?> place,
      Value<String?> occasion,
    });

class $$WatchLogHistoryTableFilterComposer
    extends Composer<_$AppDatabase, $WatchLogHistoryTable> {
  $$WatchLogHistoryTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get logId => $composableBuilder(
    column: $table.logId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ott => $composableBuilder(
    column: $table.ott,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get watchedAt => $composableBuilder(
    column: $table.watchedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get place => $composableBuilder(
    column: $table.place,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get occasion => $composableBuilder(
    column: $table.occasion,
    builder: (column) => ColumnFilters(column),
  );
}

class $$WatchLogHistoryTableOrderingComposer
    extends Composer<_$AppDatabase, $WatchLogHistoryTable> {
  $$WatchLogHistoryTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get logId => $composableBuilder(
    column: $table.logId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ott => $composableBuilder(
    column: $table.ott,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get watchedAt => $composableBuilder(
    column: $table.watchedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get place => $composableBuilder(
    column: $table.place,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get occasion => $composableBuilder(
    column: $table.occasion,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$WatchLogHistoryTableAnnotationComposer
    extends Composer<_$AppDatabase, $WatchLogHistoryTable> {
  $$WatchLogHistoryTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get logId =>
      $composableBuilder(column: $table.logId, builder: (column) => column);

  GeneratedColumn<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<double> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<String> get ott =>
      $composableBuilder(column: $table.ott, builder: (column) => column);

  GeneratedColumn<DateTime> get watchedAt =>
      $composableBuilder(column: $table.watchedAt, builder: (column) => column);

  GeneratedColumn<String> get place =>
      $composableBuilder(column: $table.place, builder: (column) => column);

  GeneratedColumn<String> get occasion =>
      $composableBuilder(column: $table.occasion, builder: (column) => column);
}

class $$WatchLogHistoryTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $WatchLogHistoryTable,
          WatchLogHistoryData,
          $$WatchLogHistoryTableFilterComposer,
          $$WatchLogHistoryTableOrderingComposer,
          $$WatchLogHistoryTableAnnotationComposer,
          $$WatchLogHistoryTableCreateCompanionBuilder,
          $$WatchLogHistoryTableUpdateCompanionBuilder,
          (
            WatchLogHistoryData,
            BaseReferences<
              _$AppDatabase,
              $WatchLogHistoryTable,
              WatchLogHistoryData
            >,
          ),
          WatchLogHistoryData,
          PrefetchHooks Function()
        > {
  $$WatchLogHistoryTableTableManager(
    _$AppDatabase db,
    $WatchLogHistoryTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$WatchLogHistoryTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$WatchLogHistoryTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$WatchLogHistoryTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> logId = const Value.absent(),
                Value<DateTime> recordedAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<double?> rating = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String?> ott = const Value.absent(),
                Value<DateTime?> watchedAt = const Value.absent(),
                Value<String?> place = const Value.absent(),
                Value<String?> occasion = const Value.absent(),
              }) => WatchLogHistoryCompanion(
                id: id,
                logId: logId,
                recordedAt: recordedAt,
                status: status,
                rating: rating,
                note: note,
                ott: ott,
                watchedAt: watchedAt,
                place: place,
                occasion: occasion,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String logId,
                required DateTime recordedAt,
                required String status,
                Value<double?> rating = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String?> ott = const Value.absent(),
                Value<DateTime?> watchedAt = const Value.absent(),
                Value<String?> place = const Value.absent(),
                Value<String?> occasion = const Value.absent(),
              }) => WatchLogHistoryCompanion.insert(
                id: id,
                logId: logId,
                recordedAt: recordedAt,
                status: status,
                rating: rating,
                note: note,
                ott: ott,
                watchedAt: watchedAt,
                place: place,
                occasion: occasion,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$WatchLogHistoryTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $WatchLogHistoryTable,
      WatchLogHistoryData,
      $$WatchLogHistoryTableFilterComposer,
      $$WatchLogHistoryTableOrderingComposer,
      $$WatchLogHistoryTableAnnotationComposer,
      $$WatchLogHistoryTableCreateCompanionBuilder,
      $$WatchLogHistoryTableUpdateCompanionBuilder,
      (
        WatchLogHistoryData,
        BaseReferences<
          _$AppDatabase,
          $WatchLogHistoryTable,
          WatchLogHistoryData
        >,
      ),
      WatchLogHistoryData,
      PrefetchHooks Function()
    >;
typedef $$OutboxTableCreateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      required String entity,
      required String op,
      required String payloadJson,
      required DateTime createdAt,
      required String status,
      Value<String?> error,
    });
typedef $$OutboxTableUpdateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      Value<String> entity,
      Value<String> op,
      Value<String> payloadJson,
      Value<DateTime> createdAt,
      Value<String> status,
      Value<String?> error,
    });

class $$OutboxTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get op => $composableBuilder(
    column: $table.op,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get op => $composableBuilder(
    column: $table.op,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get entity =>
      $composableBuilder(column: $table.entity, builder: (column) => column);

  GeneratedColumn<String> get op =>
      $composableBuilder(column: $table.op, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get error =>
      $composableBuilder(column: $table.error, builder: (column) => column);
}

class $$OutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxTable,
          OutboxData,
          $$OutboxTableFilterComposer,
          $$OutboxTableOrderingComposer,
          $$OutboxTableAnnotationComposer,
          $$OutboxTableCreateCompanionBuilder,
          $$OutboxTableUpdateCompanionBuilder,
          (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
          OutboxData,
          PrefetchHooks Function()
        > {
  $$OutboxTableTableManager(_$AppDatabase db, $OutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> entity = const Value.absent(),
                Value<String> op = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> error = const Value.absent(),
              }) => OutboxCompanion(
                id: id,
                entity: entity,
                op: op,
                payloadJson: payloadJson,
                createdAt: createdAt,
                status: status,
                error: error,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String entity,
                required String op,
                required String payloadJson,
                required DateTime createdAt,
                required String status,
                Value<String?> error = const Value.absent(),
              }) => OutboxCompanion.insert(
                id: id,
                entity: entity,
                op: op,
                payloadJson: payloadJson,
                createdAt: createdAt,
                status: status,
                error: error,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxTable,
      OutboxData,
      $$OutboxTableFilterComposer,
      $$OutboxTableOrderingComposer,
      $$OutboxTableAnnotationComposer,
      $$OutboxTableCreateCompanionBuilder,
      $$OutboxTableUpdateCompanionBuilder,
      (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
      OutboxData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$TitlesTableTableManager get titles =>
      $$TitlesTableTableManager(_db, _db.titles);
  $$TitleSearchCacheTableTableManager get titleSearchCache =>
      $$TitleSearchCacheTableTableManager(_db, _db.titleSearchCache);
  $$WatchLogsTableTableManager get watchLogs =>
      $$WatchLogsTableTableManager(_db, _db.watchLogs);
  $$WatchLogHistoryTableTableManager get watchLogHistory =>
      $$WatchLogHistoryTableTableManager(_db, _db.watchLogHistory);
  $$OutboxTableTableManager get outbox =>
      $$OutboxTableTableManager(_db, _db.outbox);
}
